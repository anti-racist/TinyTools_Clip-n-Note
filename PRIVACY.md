# Privacy policy: Clip'n'Note

Last updated: 24 September 2026

Clip'n'Note is a browser extension published by Maggie Mao. This policy
describes what data the extension handles, where that data goes, and how
long it is kept.

## In short

- The developer collects nothing. The extension has no server, no account,
  no analytics and no network code, and its content security policy blocks
  network requests.
- Your notes and scratch pad are kept by your browser, and synced by your
  browser account if you use browser sync.

## What it handles

| Data | When | Where it goes | How long it is kept |
| --- | --- | --- | --- |
| Your notes (name and content) and your scratch pad | As you type | Saved by your browser with `chrome.storage.sync`. If you are signed in to your browser with sync on, your browser account syncs them to your other signed-in browsers | Until you delete them or remove the extension |
| The title and address of the page you are on | Only when you click **New note**, which starts the note with them | Saved as part of that note, as above. You can edit or delete them | As for the note |
| The note you copy | When you copy a note | Your clipboard | Until something else is copied |

Notes saved by version 1.0 are moved into this layout the first time
version 2 runs, inside the same browser storage.

## What it does not do

- It does not send any data to the developer or to anyone else.
- It does not sell data, show ads, or track you across sites.
- It does not read the pages you visit. It sees a page's title and address
  only when you click **New note**.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | To keep your notes and scratch pad |
| `activeTab` | To start a new note with the current page's title and address, when you click **New note** |
| `clipboardWrite` | To copy a note when you ask |

## Syncing

Notes are synced by your browser, not by this extension. How your browser
account stores synced data is covered by your browser's own privacy policy
(for Chrome, [Google's privacy policy](https://policies.google.com/privacy)).

## Your choices

- Delete a note from its ⋮ menu to remove it from storage.
- Clear the scratch pad to remove its text.
- Remove the extension to delete what it stored in this browser.

## Contact

Questions about this policy:
[open an issue](https://github.com/anti-racist/TinyTools_Clip-n-Note/issues).

## Changes

If this policy changes, the new version will be posted here with a new date.
