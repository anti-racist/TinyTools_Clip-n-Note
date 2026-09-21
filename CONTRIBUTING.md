# Working on Clip'n'Note

What the extension is and does is in [`README.md`](README.md). This file is
about the source.

## Running it from source

There is nothing to build and there are no dependencies. Open
`chrome://extensions`, turn on Developer mode, and Load unpacked against
this directory. After editing a file, press Reload on the card; the popup
picks the change up the next time it opens.

`tests/` is a headless-Chrome harness that drives the popup. It is not part
of what ships and `.gitignore` keeps it out of the repo, so a fresh clone
has no tests in it.

## How it is put together

Four files and an icon directory. `popup.html` is the markup, `style.css`
holds the styling and the colour tokens, and `script.js` is everything else:
storage, search, editing, the row menu and the 1.0 migration.

The popup is two columns. The left one is the note list, its search box and
the New note button. The right one is a single slot holding either the
scratch pad or the open note's editor — `showPane()` swaps them on `openId`,
and reloads the editor's fields only when the selection changes, so typing
does not fight the caret on every re-render.

Search does not thin the list out. `matching()` is used for the counter, for
the Enter shortcut and for the offer to create a note that is not there; the
list itself always renders every note, with `marked()` painting the hits
where they sit.

## Storage

One sync key per note (`n:<id>`), and the scratch pad split across `pad:0`,
`pad:1`, …

`chrome.storage.sync` caps a single item at 8 KB, allows 512 items, and
limits writes to 120 a minute. One key per note turns the 8 KB cap into a
per-note limit instead of a limit on the whole notebook, and editing one
note rewrites one key. Writes are debounced by 500 ms, so a paragraph is one
write rather than one per keystroke. `MAX_NOTES` is 480, leaving room under
the 512 for the pad's keys.

Data from version 1.0 (`savedUrls`, `savedNotes`) is migrated the first time
a version 2 build runs. The old keys are only removed once the new ones are
written.

## Colour

Every colour is a token at the top of `style.css`, measured against WCAG 2.2
and against simulated protanopia, deuteranopia and tritanopia. Before
changing one, re-measure: text needs 4.5:1 and a control's own boundary
needs 3:1, under all three simulations rather than normal vision alone.

## Source layout

| File | What it is |
| --- | --- |
| `manifest.json` | MV3 manifest. |
| `popup.html` | The popup's markup. |
| `style.css` | All of the styling, including the colour tokens. |
| `script.js` | Storage, search, editing, the menu, migration. |
| `icons/` | The three toolbar sizes the manifest asks for, and the 300px logo they are cut from. |

## Releasing

Bump `version` in `manifest.json`, and check that README still describes
what the code does before pasting it into the Developer Dashboard. Copy
and behaviour change in the same commit.
