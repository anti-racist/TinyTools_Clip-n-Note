# Clip'n'Note

A Chrome extension with two halves in one popup: a notepad that is already
open when you click the icon, and a searchable list of the snippets you paste
over and over — a login page, a dial-in number, a standing reply, a template.

## What it does

- **Notes list (left).** Each note is a name and a piece of content. Click one
  to open it; the name and the content are editable in place and save
  themselves as you type. Typing in the search box marks the matches where
  they sit rather than hiding anything, and Enter copies the first match to
  the clipboard.
- **Pad (right).** A plain notepad, saved as you type. It shares the right-hand
  side of the popup with whichever note is open, and comes back when you close
  that note.
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
| `icons/` | The three toolbar sizes the manifest asks for, and the 300px logo they are cut from. |

## What is new in 2.0

- Five fixed URL slots became a searchable list of named notes - as many as
  sync has room for, which is 480.
- The pad and the list share one popup, as they did in 1.0.
- Notes are editable in place instead of being retyped.
- Deleting is undoable.
- 1.0 rewrote all five URL slots on every keystroke. A note's writes now wait
  for a pause and touch one key. (1.0 already debounced the pad, at the same
  500 ms.)
- 1.0 stripped `utm_` parameters and appended a `?` to every URL it could
  parse; anything it could not parse as a URL it stored unchanged. A note is
  now stored exactly as given, whatever it is.
- The yellow Clear All URLs button (white on `#FFD700`, 1.40:1) is gone.
