# Chrome Web Store listing

The Developer Dashboard fields, kept here so the copy can be reviewed and
diffed with the code it describes. Nothing in this folder ships in the
extension package.

Every claim has to be true of the code in this repo. When behaviour changes,
this file changes in the same commit.

## Item name

Clip'n'Note

## Short description

Not written here. The Dashboard takes this field from `description` in
`manifest.json`, so that string is the one place it lives. Limit is 132
characters; it is currently at 69.

## Category

Productivity > Workflow & Planning

## Single purpose

Saving short pieces of text — notes, clips and a scratch pad — in the
browser toolbar popup, stored in the browser's own sync storage.

## Detailed description

Use [`README.md`](../README.md) from **What's New in 2.0.1** down to the
end of **Compatibility**, which is the one place this is written. Do not
carry over the opening paragraph: the store already shows a description
above this field, and the listing would repeat itself.

Paste it as plain text; the Dashboard does not render Markdown, so drop the
`**` around the lead-ins and keep the bullets as short lines.

Keeping it in one place is the point: the last time the description was
edited in the Dashboard alone, it drifted from the manifest and named a
browser the extension does not require.

## Permission justifications

Each field in the Dashboard takes one of these.

| Permission | Justification |
| --- | --- |
| `storage` | Holds the notes and the scratch pad. This is the only place the extension's data lives. |
| `clipboardWrite` | Copies a note's content to the clipboard when the user picks Copy, or presses Enter in the search box. |
| `activeTab` | Reads the title and address of the current tab, only when the user clicks New note, to prefill the note. Nothing is read from the page itself. |

No host permissions, no background page, no content script, no remote code.

## Data disclosure

The Dashboard asks what is collected. The answer is nothing: the extension
has no network access, so no category applies.

- Not sold to third parties.
- Not used or transferred for any purpose unrelated to the single purpose.
- Not used or transferred to determine creditworthiness or for lending.

## Assets

Screenshots and promo tiles are not tracked — `.gitignore` excludes `*.png`
outside `icons/`. They live in the Dashboard.
