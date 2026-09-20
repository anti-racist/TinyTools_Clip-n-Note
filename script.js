'use strict';

/* Storage layout
 * --------------
 * One sync key per note, `n:<id>` -> {t, b, c}.  The 8 KB per-item cap is
 * therefore a per-note cap rather than a cap on the whole notebook, and
 * typing in one note rewrites one key instead of all of them.
 *
 * The pad is split across `pad:0`, `pad:1`, ... for the same reason: a single
 * key could not hold more than about 2,700 Chinese characters.
 */

const NOTE_PREFIX = 'n:';
const PAD_PREFIX = 'pad:';
const PAD_COUNT = 'padN';

/* sync allows 120 writes a minute and 1,800 an hour, so every keystroke
 * cannot become a write. */
const SAVE_DELAY = 500;
const UNDO_DELAY = 7000;

/* QUOTA_BYTES_PER_ITEM is 8,192 for the key and its JSON value together.
 * Leaving headroom keeps a note that is right on the line from failing to
 * save after it has already been typed. */
const ITEM_BUDGET = 7800;
const MAX_NOTES = 480; /* MAX_ITEMS is 512, and the pad needs keys too. */



const $ = (id) => document.getElementById(id);

let notes = [];
let query = '';
let openId = null;
let menuId = null;
let copiedId = null;
let pendingUndo = null;

/* ---------- storage helpers ---------- */

const get = (keys) => new Promise((res) => chrome.storage.sync.get(keys, res));
const set = (obj) => new Promise((res, rej) => {
  chrome.storage.sync.set(obj, () => {
    const err = chrome.runtime.lastError;
    if (err) rej(new Error(err.message)); else res();
  });
});
const remove = (keys) => new Promise((res) => chrome.storage.sync.remove(keys, res));

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 4000);
}

/* How many bytes this note will occupy once chrome.storage serialises it. */
function noteSize(id, note) {
  const key = NOTE_PREFIX + id;
  return new TextEncoder().encode(key + JSON.stringify(note)).length;
}

/* ---------- notes ---------- */

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function loadNotes() {
  const all = await get(null);
  notes = Object.keys(all)
    .filter((k) => k.startsWith(NOTE_PREFIX))
    .map((k) => {
      const v = all[k] || {};
      return {
        id: k.slice(NOTE_PREFIX.length),
        t: typeof v.t === 'string' ? v.t : '',
        b: typeof v.b === 'string' ? v.b : '',
        c: typeof v.c === 'number' ? v.c : 0,
      };
    })
    /* Newest first: a note you just captured is the one you are looking at. */
    .sort((a, b) => b.c - a.c);
  return all;
}

function isEmpty(note) {
  return !note.t.trim() && !note.b.trim();
}

async function writeNote(note) {
  /* A note with no name and no content is not a note. Storing it would leave
   * a blank row behind every time New note is pressed on a page worth nothing. */
  if (isEmpty(note)) {
    await remove([NOTE_PREFIX + note.id]);
    return true;
  }
  const value = { t: note.t, b: note.b, c: note.c };
  if (noteSize(note.id, value) > ITEM_BUDGET) {
    toast('This note is too long to sync. Shorten it, or keep it in the pad.');
    return false;
  }
  try {
    await set({ [NOTE_PREFIX + note.id]: value });
    return true;
  } catch (err) {
    toast('Could not save: ' + err.message);
    return false;
  }
}

const savers = new Map();
function saveNoteSoon(note, done) {
  clearTimeout(savers.get(note.id));
  savers.set(note.id, setTimeout(async () => {
    const ok = await writeNote(note);
    if (done) done(ok);
  }, SAVE_DELAY));
}

/* Closing an empty note throws it away rather than leaving a blank row. */
function discardIfEmpty() {
  if (openId === null) return;
  const note = notes.find((n) => n.id === openId);
  if (!note || !isEmpty(note)) return;
  clearTimeout(savers.get(note.id));
  savers.delete(note.id);
  remove([NOTE_PREFIX + note.id]);
  notes = notes.filter((n) => n.id !== note.id);
}

function closeOpen() {
  discardIfEmpty();
  openId = null;
}

/* ---------- the pad ---------- */

function chunkPad(text) {
  const enc = new TextEncoder();
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let lo = 1;
    let hi = text.length - start;
    /* Grow the slice while its serialised form still fits one item. */
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const size = enc.encode(PAD_PREFIX + '99' + JSON.stringify(
        text.slice(start, start + mid))).length;
      if (size <= ITEM_BUDGET) lo = mid; else hi = mid - 1;
    }
    chunks.push(text.slice(start, start + lo));
    start += lo;
  }
  return chunks.length ? chunks : [''];
}

async function writePad(text, previousCount) {
  const chunks = chunkPad(text);
  const payload = { [PAD_COUNT]: chunks.length };
  chunks.forEach((c, i) => { payload[PAD_PREFIX + i] = c; });
  try {
    await set(payload);
  } catch (err) {
    toast('Could not save the pad: ' + err.message);
    return previousCount;
  }
  const stale = [];
  for (let i = chunks.length; i < previousCount; i += 1) stale.push(PAD_PREFIX + i);
  if (stale.length) await remove(stale);
  return chunks.length;
}

function readPad(all) {
  const n = typeof all[PAD_COUNT] === 'number' ? all[PAD_COUNT] : 0;
  let text = '';
  for (let i = 0; i < n; i += 1) text += all[PAD_PREFIX + i] || '';
  return { text, count: n };
}

/* ---------- migration from 1.0 ---------- */

/* 1.0 kept five fixed slots in `savedUrls` and one string in `savedNotes`.
 * The old keys are only dropped once the new ones are written, so a failure
 * half way through loses nothing. */
async function migrate(all) {
  const urls = Array.isArray(all.savedUrls) ? all.savedUrls : null;
  const oldPad = typeof all.savedNotes === 'string' ? all.savedNotes : null;
  if (!urls && oldPad === null) return false;

  const base = Date.now();
  let moved = 0;
  if (urls) {
    for (let i = urls.length - 1; i >= 0; i -= 1) {
      const value = (urls[i] || '').trim();
      if (!value) continue;
      const note = { t: 'URL ' + (i + 1), b: value, c: base - i };
      if (!await writeNote({ id: newId(), ...note })) return false;
      moved += 1;
    }
  }
  if (oldPad) {
    const existing = readPad(all);
    const merged = existing.text ? existing.text + '\n' + oldPad : oldPad;
    await writePad(merged, existing.count);
  }
  await remove(['savedUrls', 'savedNotes']);
  if (moved) toast('Moved ' + moved + ' saved URLs from version 1.0.');
  return true;
}

/* ---------- rendering ---------- */

function matches(note, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return note.t.toLowerCase().includes(needle)
    || note.b.toLowerCase().includes(needle);
}

/* Searching does not thin the list out: every clip stays where it was and
 * the ones that match say so. */
function hits(text, q) {
  const out = [];
  if (!q) return out;
  const hay = text.toLowerCase();
  const needle = q.toLowerCase();
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
    out.push(i);
  }
  return out;
}

/* Text with the matched runs wrapped in <mark>, built as nodes so a clip's
 * own contents can never be read as markup. */
function marked(text, q) {
  const frag = document.createDocumentFragment();
  const found = hits(text, q);
  let at = 0;
  for (const i of found) {
    if (i > at) frag.append(text.slice(at, i));
    const m = document.createElement('mark');
    m.textContent = text.slice(i, i + q.length);
    frag.append(m);
    at = i + q.length;
  }
  frag.append(text.slice(at));
  return frag;
}

function matching() {
  return notes.filter((n) => matches(n, query));
}

function looksLikeUrl(text) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+\//.test(text);
}

function dotsButton(note) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'dots';
  b.setAttribute('aria-label', 'More actions for this note');
  b.setAttribute('aria-expanded', String(menuId === note.id));
  /* Stacked, not in a row: a horizontal three-dot sits right beside the
     ellipsis that truncates a long title, and the two read as one smear. */
  b.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="#1661ab"'
    + ' aria-hidden="true"><circle cx="8" cy="3" r="1.4"></circle>'
    + '<circle cx="8" cy="8" r="1.4"></circle>'
    + '<circle cx="8" cy="13" r="1.4"></circle></svg>';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    menuId = menuId === note.id ? null : note.id;
    render();
  });
  return b;
}

function collapsedCard(note) {
  const card = document.createElement('div');
  card.className = note.id === openId ? 'card selected' : 'card';
  card.setAttribute('role', 'listitem');

  /* The card itself is not the button: a button inside a button is invalid,
   * and the three-dot control has to stay separately reachable. */
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'main';

  const t = document.createElement('div');
  t.className = 't';
  const title = note.t || 'Untitled';
  t.append(marked(title, note.t ? query : ''));
  const b = document.createElement('div');
  const isUrl = looksLikeUrl(note.b);
  if (note.id === copiedId) {
    /* The second line carries the confirmation for a moment, so the clip you
       copied is the thing that answers. */
    b.className = 'b copied';
    b.textContent = 'Copied';
  } else {
    b.className = isUrl ? 'b url' : 'b';
    /* The scheme is the least useful part of a long link in a 280px column,
       so the collapsed line drops it. What is stored and copied is
       untouched. */
    const shown = (isUrl ? note.b.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') : note.b)
      .replace(/\s+/g, ' ').trim();
    b.append(marked(shown, query));
  }
  main.append(t, b);
  main.setAttribute('aria-pressed', String(note.id === openId));
  main.addEventListener('click', (e) => {
    /* Without this the click carries on to the document handler, which reads
       it as clicking away and closes the note that was just picked. */
    e.stopPropagation();
    /* Clicking the note you are already in puts the pad back. */
    const wasOpen = note.id === openId;
    discardIfEmpty();
    openId = wasOpen ? null : note.id;
    menuId = null;
    render();
  });

  card.append(main, dotsButton(note));
  return card;
}

function createRow() {
  const row = document.createElement('div');
  row.className = 'card';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'main';
  const t = document.createElement('div');
  t.className = 't';
  t.textContent = '+ New note “' + query + '”';
  main.append(t);
  main.addEventListener('click', () => createNote(query, ''));
  row.append(main);
  return row;
}

function hintRow(message) {
  const row = document.createElement('div');
  row.className = 'hint';
  row.textContent = message;
  return row;
}

function placeMenu(note, anchor) {
  const menu = document.createElement('div');
  menu.className = 'menu';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy to clipboard';
  copy.addEventListener('click', (e) => {
    e.stopPropagation();
    menuId = null;
    copyNote(note);
    render();
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'del';
  del.textContent = 'Delete note';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    menuId = null;
    deleteNote(note);
  });

  menu.append(copy, del);
  menu.addEventListener('click', (e) => e.stopPropagation());

  const column = document.querySelector('.clips');
  const box = anchor.getBoundingClientRect();
  const frame = column.getBoundingClientRect();
  column.append(menu);
  const height = menu.offsetHeight;
  /* Flip above the button when there is not enough room below it. */
  let top = box.bottom - frame.top + 4;
  if (top + height > frame.height - 8) top = box.top - frame.top - height - 4;
  menu.style.top = Math.max(4, top) + 'px';
  menu.style.right = (frame.right - box.right) + 'px';
}

function render() {
  const list = $('list');
  list.textContent = '';
  document.querySelectorAll('.menu').forEach((m) => m.remove());

  const found = matching();
  if (query && !found.length) list.append(createRow());
  notes.forEach((note) => list.append(collapsedCard(note)));
  if (!query && !notes.length) list.append(hintRow('No notes yet.'));

    /* The notice takes the counter's line rather than adding a row of its own,
     so nothing on screen moves when a clip is deleted. */
  $('undo').hidden = pendingUndo === null;
  $('count').hidden = pendingUndo !== null || (!query && !notes.length);
  const inPad = hits($('notePad').value, query).length;
  $('count').textContent = query
    ? found.length + ' of ' + notes.length + ' notes'
    : notes.length + (notes.length === 1 ? ' note' : ' notes');

  /* The pad is a textarea, so a run of text inside it cannot be painted. The
     browser's own selection can show it instead, which also scrolls to it. */
  $('padHits').hidden = !query || !inPad;
  $('padHits').textContent = inPad === 1
    ? '1 in your notes' : inPad + ' in your notes';

  if (menuId) {
    const note = notes.find((n) => n.id === menuId);
    const anchor = list.querySelector('[aria-expanded="true"]');
    if (note && anchor) placeMenu(note, anchor); else menuId = null;
  }

  showPane();
}

/* The right-hand pane is the scratch sheet until a note is picked, and that
 * note while one is. Its fields are reloaded only when the selection changes,
 * so typing in them does not fight the caret on every re-render. */
let paneFor = null;

function showPane() {
  const note = openId === null ? null : notes.find((n) => n.id === openId);
  if (!note) openId = null;

  $('notePad').hidden = !!note;
  $('detail').hidden = !note;

  if (!note) {
    paneFor = null;
    return;
  }
  if (paneFor !== note.id) {
    $('openName').value = note.t;
    $('openBody').value = note.b;
    $('openState').hidden = true;
    paneFor = note.id;
    /* A new note needs naming, so the caret goes there. Picking an existing
       one is often just reading it, and auto-focusing the body would draw a
       focus ring around the whole sheet before anyone asked to type. */
    if (render.focusName) {
      $('openName').focus();
      $('openName').select();
      render.focusName = false;
    }
  }
}

/* ---------- actions ---------- */

async function copyNote(note) {
  const text = note.b || note.t;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    toast('Could not copy: ' + err.message);
    return;
  }
  /* The confirmation belongs on the clip that was copied, not on a bar that
     floats over the column for the most ordinary thing this tool does. */
  copiedId = note.id;
  render();
  clearTimeout(copyNote.timer);
  copyNote.timer = setTimeout(() => {
    copiedId = null;
    render();
  }, 1400);
}

async function createNote(title, body) {
  if (notes.length >= MAX_NOTES) {
    toast('Sync holds ' + MAX_NOTES + ' notes. Delete one to make room.');
    return;
  }
  discardIfEmpty();
  const note = { id: newId(), t: title, b: body, c: Date.now() };
  /* Nothing is written until there is something to write. */
  if (!isEmpty(note) && !await writeNote(note)) return;
  notes.unshift(note);
  query = '';
  $('q').value = '';
  openId = note.id;
  menuId = null;
  render.focusName = true;
  render();
}

async function deleteNote(note) {
  await remove([NOTE_PREFIX + note.id]);
  notes = notes.filter((n) => n.id !== note.id);
  if (openId === note.id) openId = null;

  pendingUndo = note;
  $('undoText').textContent = 'Deleted “' + (note.t || 'Untitled') + '”';
  clearTimeout(deleteNote.timer);
  deleteNote.timer = setTimeout(() => {
    pendingUndo = null;
    render();
  }, UNDO_DELAY);
  render();
}

async function undoDelete() {
  if (!pendingUndo) return;
  const note = pendingUndo;
  pendingUndo = null;
  clearTimeout(deleteNote.timer);
  if (!await writeNote(note)) {
    render();
    return;
  }
  notes.push(note);
  notes.sort((a, b) => b.c - a.c);
  render();
}

async function newFromPage() {
  let title = '';
  let url = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      title = tab.title || '';
      url = tab.url || '';
    }
  } catch (err) {
    /* No access to the tab: still make an empty note rather than nothing. */
  }
  /* On a browser page there is nothing worth keeping: the URL is useless to
   * paste and the title names the browser, not anything of yours. Better an
   * empty note waiting for a name than three called "Extensions". */
  if (/^(chrome|edge|about|chrome-extension|devtools|view-source):/i.test(url)) {
    title = '';
    url = '';
  }
  /* Otherwise the page is stored verbatim. Trimming tracking parameters is
   * GetCleanURL's job; a note that silently differs from what you saved is
   * worse than a long one. */
  await createNote(title, url);
}

/* ---------- wiring ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  const all = await loadNotes();

  if (await migrate(all)) await loadNotes();

  const pad = readPad(await get(null));
  const padEl = $('notePad');
  padEl.value = pad.text;
  let padCount = pad.count;

  let padTimer;
  padEl.addEventListener('input', () => {
    clearTimeout(padTimer);
    padTimer = setTimeout(async () => {
      padCount = await writePad(padEl.value, padCount);
    }, SAVE_DELAY);
  });

  const q = $('q');
  q.addEventListener('input', () => {
    query = q.value.trim();
    closeOpen();
    menuId = null;
    render();
  });

  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const found = matching();
    if (found.length) copyNote(found[0]);
    else if (query) createNote(query, '');
  });

  /* Walk the pad's own matches, letting the browser highlight and scroll. */
  let padAt = 0;
  $('padHits').addEventListener('click', (e) => {
    e.stopPropagation();
    const found = hits(padEl.value, query);
    if (!found.length) return;
    padAt %= found.length;
    const i = found[padAt];
    padAt += 1;
    closeOpen();
    render();
    padEl.focus();
    padEl.setSelectionRange(i, i + query.length);
  });

  $('new').addEventListener('click', newFromPage);
  $('undoBtn').addEventListener('click', undoDelete);

  const edited = () => {
    const note = notes.find((n) => n.id === openId);
    if (!note) return;
    note.t = $('openName').value;
    note.b = $('openBody').value;
    /* The save lands half a second later; by then the pane may hold a
       different note, and this one's failure is no longer its business. */
    saveNoteSoon(note, (ok) => {
      if (paneFor === note.id) $('openState').hidden = ok;
    });
    render();
  };
  $('openName').addEventListener('input', edited);
  $('openBody').addEventListener('input', edited);

  /* Working inside a note must not count as clicking away from it. */
  $('detail').addEventListener('click', (e) => e.stopPropagation());

  /* Clicking away closes whatever is open; there is nothing to commit,
   * because editing saves itself. */
  document.addEventListener('click', () => {
    if (openId === null && menuId === null) return;
    closeOpen();
    menuId = null;
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuId === null && openId === null) return;
    /* Chrome closes the popup on Escape; this only wins when the event is
     * ours to cancel, which is why clicking away has to work too. */
    e.preventDefault();
    e.stopPropagation();
    menuId = null;
    closeOpen();
    render();
  });

  render();
  if (!q.hidden) q.focus();
});
