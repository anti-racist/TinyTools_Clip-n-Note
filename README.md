# Clip'n'Note

A Chrome extension with two halves in one popup: a notepad that is already
open when you click the icon, and a searchable list of the snippets you paste
over and over — a login page, a dial-in number, a standing reply, a template.

## What it does

- **Notes list (left).** Each note is a name and a piece of content. Click one
  to open it; the name and the content are editable in place and save
  themselves as you type. Typing in the search box filters the list, and
  Enter copies the first match to the clipboard.
- **Pad (right).** A plain notepad, always visible, saved as you type.
- **New note.** Creates a note from the page you are on, with its title and URL
  already filled in, and puts the cursor on the name. If you search for
  something that is not there, the list offers to create it instead.
- **Delete** is undoable for a few seconds.

Everything stays in `chrome.storage.sync`, which means Chrome carries it
between your own signed-in machines. Nothing is sent anywhere else.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Holds the notes and the pad. |
| `clipboardWrite` | Copies a note when you ask it to. |
| `activeTab` | Reads the title and URL of the current tab, only when you click **New note**. |

There is no background page, no content script, no host permission, and no
network access of any kind.

## How it is stored

One sync key per note (`n:<id>`), and the pad split across `pad:0`, `pad:1`, …

`chrome.storage.sync` caps a single item at 8 KB, allows 512 items, and limits
writes to 120 a minute. One key per note turns the 8 KB cap into a per-note
limit instead of a limit on the whole notebook, and editing one note rewrites
one key. Writes are debounced, so a paragraph is one write rather than one per
keystroke.

Data from version 1.0 (`savedUrls`, `savedNotes`) is migrated the first time
2.0 runs. The old keys are only removed once the new ones are written.

## Source layout

| File | What it is |
| --- | --- |
| `manifest.json` | MV3 manifest. |
| `popup.html` | The popup's markup. |
| `style.css` | All of the styling, including the colour tokens. |
| `script.js` | Storage, search, editing, the menu, migration. |
| `icons/` | Toolbar icons (not tracked in git). |

## Colour

| | | |
| --- | --- | --- |
| 鱼肚白 `#f7f4ed` | the page | |
| 影青 `#bdcbd2` | the notes column | a card's own edge makes it a card here |
| 靛青 `#1661ab` | New note, the focus stroke, the menu glyph | |
| 靛青 → 青黛 `#1a3a5f` | the open note's wash | starts on the button's own colour |
| 杏仁黄 `#f7e8aa` | search marks, Copied, Undo | everything transient, and nothing else |
| 赤 `#981e22` | Delete note | darkened; the original is 3.40:1 under tritanopia |

Every pair on screen is measured against WCAG 2.2 — 4.5:1 for text, 3:1 for a
control's boundary or its state — and measured again under simulated
protanopia, deuteranopia and tritanopia, because several of the originals pass
in normal vision and fail in one of those. Nothing in the interface depends on
colour alone to be understood. `tests/palette.py` reads the tokens out of
`style.css` and fails if any of it drifts.

One pair is recorded rather than required: a white card sits 1.64:1 on
影青. A card is not a control, so 1.4.11 asks nothing of that pair — the
card is separated by its own 14% ink ring instead. Everything 1.4.11 does
ask about, the focus ring and the picked row, is measured against the
column and passes.

## What is new in 2.0

- Five fixed URL slots became an unlimited, searchable list of named notes.
- The pad and the list are both visible at once, as they were in 1.0.
- Notes are editable in place instead of being retyped.
- Deleting is undoable.
- 1.0 saved on every keystroke and rewrote all five slots each time; writes are
  now debounced and touch one key.
- 1.0 stripped `utm_` parameters and appended a `?` to everything it stored,
  including text that was not a URL. A note is now stored exactly as given.
- The yellow header button (white on `#ffb61e`, 1.6:1) is gone.

## Testing

The harness lives in `tests/` and is not part of the extension. It stubs
`chrome.storage.sync` with the real quotas, drives the popup in headless
Chrome, and fails on any uncaught error as well as on any wrong behaviour.

```
python tests/run.py             # migration, search, editing, delete and undo
python tests/run.py empty.html  # first run, with nothing saved
python tests/palette.py         # contrast, including three kinds of colour blindness
```
