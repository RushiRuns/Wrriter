# Wrriter - Data Schema

> The data model is treated as sacred, and in Wrriter the data model is the user's own markdown files.
> No AI tool changes this file, a format version or the sample notes without Krishna reviewing the change.
> Every change here gets a version bump (or a rebuild, for caches), a test, and for anything written into a note, a new sample note in the round-trip check.
> Notes are plain .md files and the disk is the truth. Everything else is small vault metadata, settings on this PC, or a cache that can be deleted at any time.

---

## Read This First: Status

No code exists yet. This file is written from Features 1 to 9, the versions doc and the UI hand-off. These parts are **not settled** and are marked Open where they appear:

- How highlights and coloured text are written in a note (UI hand-off decision 1).
- Whether `>` is the pull quote or the blockquote (UI hand-off decision 2).
- What the Archive tile does and whether an `Archive` folder exists (UI hand-off decision 4).
- The format of the `created:` value. No doc fixes it.
- The file format of `.wrriter` files and app data files. Plain JSON is proposed, to be confirmed in M1. The file names in this doc are proposals too.
- The layout of the search index tables. It is a cache, so Antigravity proposes it in M1 and it can change freely later.

Nothing marked Open is written to a note or a vault until Krishna answers.

---

## Storage Scope Legend

Every store has a scope. The scope decides who writes it and whether it travels to other devices.

| Scope | Where | Travels with Syncthing | Written by |
|---|---|---|---|
| `note` | Files in the vault folder | Yes | The user through the editor, and jobs (link updates, folder moves, tag renames, imports) |
| `vault-meta` | The `.wrriter` folder inside the vault | Yes | Wrriter only |
| `local` | The app data folder on this PC | No | Wrriter only |
| `cache` | The app data folder on this PC | No | Wrriter only. Deleted and rebuilt at any time, with nothing lost |

---

## Format Versions

| Format | Version | Change rule |
|---|---|---|
| `.wrriter` files | 1 (nothing written yet) | Read older versions, upgrade on the next write. Never overwrite a file from a newer version |
| App data files | 1 | Same |
| Pending jobs list | 1 | Same. A list from an older version is finished, never dropped |
| Search index | 1 | A change bumps the version. The old index is deleted and rebuilt. No migrations |
| Encrypted note file (Version 2) | 1 | Written down in `docs/encrypted-format.md`. Readers keep every old version |

Note files have no Wrriter version. They are the user's markdown.

---

## Store Index

| Store | Purpose | Scope | From |
|---|---|---|---|
| Note files (`*.md`) | The notes | note | V1 |
| `attachments/` | Files copied in by drop or paste | note | V1 |
| `Inbox/` | Quick captures | note | V1 |
| `Journal/` | One note per day | note | V2 |
| `Templates/` | Templates | note | V2 |
| `Archive/` | Archived notes | note | Open (decision 4) |
| Encrypted note files | Locked notes and their attachments | note | V2 |
| `.wrriter/vault.json` | Vault id | vault-meta | V1 |
| `.wrriter/pins.json` | Pinned notes | vault-meta | V1 |
| `.wrriter/order.json` | Manual order per folder | vault-meta | V1 |
| `.wrriter/views.json` | Folder view per folder | vault-meta | V2 |
| `.wrriter/devices.json` | Which Syncthing device code is this computer | vault-meta | V2 |
| `.wrriter/reminders.json` | Missed reminders already handled | vault-meta | V2 |
| `.wrriter/encryption.json` | Wrapped vault key and scrypt settings | vault-meta | V2 |
| App data: `vaults.json` | Known vaults (folder paths, display names) | local | V1 |
| App data: `settings.json` | Every setting | local | V1 |
| App data: `window-state.json` | Window sizes and positions, pane widths, quick capture size and place | local | V1 |
| App data: `first-paint/<vault id>.json` | Open tabs and the first page of the note list, per vault | local | V1 |
| App data: `jobs/<vault id>.json` | Pending jobs list, one file per vault | local | V1 |
| App data: `index/<vault id>.sqlite` | Search index, one per vault | cache | V1 |
| App data: `graph/<vault id>.json` | Graph dot positions, one per vault | cache | V3 |
| App data: `logs/` | Problem log, opened by the Open log folder command | local | V1 |

File names marked `.json` are proposals (see Status).

---

## Note Files

**Encoding and line endings**
- UTF-8, with or without a byte order mark. Whatever a file has is kept.
- Line endings are kept as found. A note with Windows line endings is saved with Windows line endings.
- The final newline is kept as found, present or absent.
- New notes written by Wrriter use plain line feeds and no byte order mark.

**File names** (the only place they are built is `shared/domain/names`)
- The file name is the note title.
- Drops the characters Windows does not allow: `\ / : * ? " < > |`.
- Trims trailing spaces and dots.
- Avoids reserved names: `CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`.
- A title longer than 100 characters is shortened in the file name only, never in the note's first line.
- A clash in one folder adds a number: `Groceries 2.md`.
- Never two names in one folder that differ only by upper and lower case.
- Antigravity tests the Windows path length limit with long titles and deep folders.

**Title**
- The title is the first line with any heading marks removed.
- An empty first line gives `Untitled`, then `Untitled 2` and so on.
- The file follows the first line only if the file name matched the title when the note was opened. A number added to avoid a clash counts as a match. A note renamed by hand, or a note from another app whose name differs from its first line, keeps its name until renamed by hand.
- The file is renamed when the note is left (switching notes, closing the tab or window, quitting), never while typing.
- Journal notes always keep their date as the name.
- A quick capture with an empty first line is named `Quick note YYYY-MM-DD HH.mm`, for example `Quick note 2026-10-15 17.52`, because Windows does not allow colons.

**Folders**
- Real folders, nested as deep as the user likes, named by the same Windows rules.
- Folders starting with a dot are never shown, read or changed, except Wrriter's own `.wrriter`.
- `attachments/` is hidden from the folder tree.
- An empty folder stays visible.

---

## Frontmatter

The block between two `---` lines at the very top of the file. A note with no properties has no block. Wrriter adds one only when the first property is set.

| Key | Value | Written when | From |
|---|---|---|---|
| `tags` | A list of tags. The form already in the file is kept (bracket `tags: [work, ideas]` or one per line). A new key uses the list form | The user adds or removes a tag; a tag rename job | V1 |
| `status` | Any word. Words already used in the vault are suggested | The user sets it | V1 |
| `created` | Open format | A note is made in Wrriter; an import adds it from the original file's creation date if missing; an existing note without it gets it the next time it is saved for another reason | V1 |
| `cover` | A path inside the vault to an image | The user sets a cover | V2 |
| `remind` | `YYYY-MM-DDTHH:mm`, local time | The user sets a reminder. Removing the reminder removes the key | V2 |

- Every other key (for example Obsidian's `aliases` or `cssclasses`) is never touched. Key order and comments are kept.
- Broken frontmatter: the text is shown as it is, the file is left untouched, a small notice shows, and the note's properties count as empty.
- Modified is the file's modified time. It is never stored in a note.

**Tags**
- Come only from the `tags` key. A `#word` typed in the text is plain text, not a tag.
- No spaces. Letters, numbers, hyphens, underscores and slashes. A slash nests: `work/project`.
- Not case sensitive. `Work` and `work` are one tag. The first spelling used is shown.
- A tag's colour (one of five) is Open (UI hand-off decision 3). The recommendation stores nothing.

---

## Note Body

The editor shows these formatted. On disk they are standard markdown. Only edited blocks are ever written back, in the note's own style.

| Element | Written as | Notes |
|---|---|---|
| Headings 1 to 6 | `#` to `######` | |
| Bold, italic, strikethrough, inline code | Standard markdown | The note's own markers are kept |
| Bullet, numbered and task lists | `-`, `1.`, `- [ ]`, `- [x]` | The note's own bullet character, numbering and indentation are kept |
| Quote | `>` | Pull quote or blockquote is Open (decision 2). The recommendation: `>` is the blockquote, the pull quote is `> [!quote]` |
| Callout | `> [!type] Title`, then quoted lines | `[!type]-` starts folded, `[!type]+` open and foldable. Folding while reading never changes the file. An unknown type is kept by name |
| Table | GitHub-style table | |
| Code block | Fenced with three backticks and a language | `dataview` and `dataviewjs` blocks show a Not run label and are never run |
| Horizontal rule | `---` | Drawn as the five-dot divider |
| Image | `![alt|400|center](attachments/pic.png)` | Width in pixels only after a resize. Left alignment writes nothing extra. Path relative to the note: `../attachments/pic.png` from a subfolder. Moving a note rewrites its image paths |
| Attachment link | `[report.pdf](attachments/report%202.pdf)` | Percent-encoded, relative to the note |
| Wikilink | `[[Note]]`, `[[Note|text]]`, `[[Note#Heading]]` | `[[Folder/Note]]` is written when two notes share a name |
| Highlight, coloured text | Open (decision 1) | The recommendation is `<mark class="wr-m2">text</mark>` and `<span class="wr-c3">text</span>`. `==text==` stays pass-through either way |
| Columns | `::: columns` fenced blocks | Later. Not built |

**Kept word for word (pass-through).** Shown as plain text, saved exactly as found, highlighted by find but never changed by replace:
`%% comments %%`, block IDs such as `^abc123`, embeds such as `![[Other note]]` and `![[pic.png|300]]`, `==highlights==`, footnotes, raw HTML (a script tag shows as text and never runs), maths blocks, Mermaid blocks, custom task states such as `- [/]`, Templater tags `<% ... %>`, inline Dataview fields `key:: value`, block links `[[Note#^id]]`.

**The round-trip rules**
- A file is written only when its content was edited.
- Every block keeps its original markdown text. Only an edited block is rewritten. Editing one paragraph never reformats the rest.
- Find and replace changes only the visible text. Wikilinks and pass-through text are skipped and counted.
- Links changed by a rename job change only the link text, never anything around it.

---

## Attachments

- One `attachments/` folder at the vault root, whatever note or folder a file was added from.
- The file keeps its original name. A clash adds a number: `report 2.pdf`. Characters Windows does not allow become a hyphen.
- A file with exactly the same content already in the folder is reused, never copied twice. In Version 2, an encrypted note never shares an attachment with a plain note.
- Deleting or duplicating a note never deletes or copies its attachments.
- A pasted image is named `Pasted image YYYYMMDD-HHmmss.png`, for example `Pasted image 20261015-143210.png`.
- Shown inline: PNG, JPEG, GIF, WebP, SVG, BMP, plus any other type Antigravity confirms the built-in engine shows. Everything else, HEIC included, is a file chip.
- A missing file shows `File not found: name`. The link in the note is left as it is.

---

## Special Folders and Files

| Folder or file | Rule | From |
|---|---|---|
| `Inbox/` | At the vault root. Created at the first quick capture. An existing folder of that name is used as it is. Created again if deleted | V1 |
| `Journal/` | Notes named `YYYY-MM-DD.md`, for example `2026-10-15.md`. The PC's local date | V2 |
| `Templates/` | At the vault root, name changeable in settings. Placeholders `{{title}}`, `{{date}}` as `YYYY-MM-DD`, `{{time}}`. Templater tags are inserted as plain text | V2 |
| `Archive/` | Open (decision 4) | Open |
| Syncthing conflict copies | Names contain `sync-conflict` next to a note of the same name. Until the conflict screen exists they show as ordinary notes. In Version 2 they are hidden from the list, search, tags and backlinks, and the note shows a banner | V1 shown, V2 handled |
| PDFs in folders | Listed by file name only, never read for the list. Search finds them by name only | V2 |

---

## The `.wrriter` Folder (vault-meta)

- Only small text files. Never the password, never the text of a note.
- Added the first time a folder is opened as a vault. Opening a vault writes nothing else.
- Travels with Syncthing to other devices.

| File | Holds | Merge rule when two devices change it |
|---|---|---|
| `vault.json` | Vault id (UUID v4), format version | Never changes after it is made |
| `pins.json` | Pinned note paths | Newer file wins. Never opens the conflict screen |
| `order.json` | Per folder: note path to fractional key. A drag writes one entry. A renamed note keeps its key. A note moved to another folder lands at the top of it. Notes with no key show at the top by modified time | Newer file wins. Never opens the conflict screen |
| `views.json` (V2) | Per folder: list, table, gallery or wall | Newer file wins |
| `devices.json` (V2) | Which Syncthing device code is this computer, from the user's one-time answer | Newer file wins |
| `reminders.json` (V2) | Missed reminders already handled. Changing a reminder's time arms it again | Newer file wins |
| `encryption.json` (V2) | The vault key wrapped by the scrypt-derived key, the scrypt settings, the format version | Changing the password rewrites only this file |

---

## Encrypted Note Files (Version 2)

- One random vault key per vault. Notes and attachments are encrypted with AES-256-GCM using it. Every file gets its own new random nonce.
- The password is turned into a key with scrypt (settings that take about half a second on an ordinary PC). That key wraps the vault key. The password is never stored.
- An encrypted file has a random name with no title in it, sits in the same folder as before, and uses its own extension (chosen by Antigravity) so other apps do not treat it as markdown.
- Header: format version and nonce. Ciphertext: the whole note, frontmatter and title included.
- A wrong password, or a changed or damaged file, is caught by GCM. The file is never overwritten.
- Visible on disk and accepted: folder names, file sizes, modified times and the number of encrypted notes.
- When a note is encrypted, its plain file is removed permanently, not sent to the Recycle Bin.
- The format is written down in `docs/encrypted-format.md` with its version, so other tools and later versions can read it.

---

## The App Data Folder (local and cache)

Nothing here is synced. Deleting the whole folder loses settings only: notes are untouched and the index is rebuilt.

### Settings

Key names are proposals. Values and defaults come from the docs named.

| Key | Default | Values | From |
|---|---|---|---|
| `theme` | `follow-windows` | `light`, `dark`, `follow-windows` | Features 1 |
| `accent` | `yellow` | `sky`, `yellow`, `coral`, `mint`, `lilac` | UI hand-off |
| `motion` | `follow-windows` | `follow-windows`, `reduced`, `full` | Features 8 |
| `noteMargin` | `24` | 16 to 96, steps of 4 | UI hand-off |
| `keepRunningInBackground` | `true` | | Features 3 |
| `startWithWindows` | `false` | Offered only while the one above is on | Features 3 |
| `captureHotkey` | `Ctrl+Alt+N` | Any free combination | Features 3 |
| `captureVault` | `last-active` | `last-active` or a vault id | Features 3 |
| `noteList.sortBy` | `manual` | `manual`, `modified`, `created`, `title` | Features 1 |
| `noteList.showSortIcon` | `false` | | UI hand-off |
| `noteList.showPreviews` | `true` | | UI hand-off |
| `noteList.showDates` | `true` | | UI hand-off |
| `noteList.showImages` | `true` | | UI hand-off |
| `dragHintShown` | `false` | Set once the Drag to move tooltip has shown | UI hand-off |
| `backup.folder`, `backup.frequency`, `backup.keep` (V2) | none, `off`, `10` | `off`, `daily`, `weekly` | Features 6 |
| `templatesFolder` (V2) | `Templates` | | Features 2 |
| `journalTemplate` (V2) | none | A template path | Features 3 |
| `wakeForReminders` (V3) | Asked once | | Features 3 |

Removed and never created: the setting that pinned the auto-hiding bars (UI hand-off section 10).

### Saved first-paint state

Per vault: the open tabs, the pane widths and the first page of the note list for the current folder. Used so the window paints at once before the index is open. A cache in practice: if it is missing, the window starts without it.

### Pending jobs list

- One file per vault, written the safe way.
- Holds the job type, the change (for example the old and new note name), the list of files, and the ticks saved in batches of about 100.
- Holds file paths and names only, never the text of a note.
- In Version 2, a name of an encrypted note is stored encrypted with the vault key, and the job is finished at the next unlock.

### Search index (cache)

- SQLite through better-sqlite3, only inside the index worker, one file per vault.
- WAL mode, about 500 files per transaction, prepared statements, relaxed durability. Antigravity picks and reports the exact values.
- Full text search with FTS5 prefix indexes, so `meet` finds `meeting`. Only searched columns go in the search table. Snippets are built only for rows on screen.
- Holds, in a layout Antigravity proposes in M1: per note the path, title, folder, modified time, size, created, status, one preview line, the first image or cover, and in Version 2 the reminder time; the tags of each note; the links between notes; and the searchable title and body text.
- The worker also keeps every note's title, path and modified time in memory for the quick switcher.
- Never the only copy of anything. Missing, damaged or of an older version: deleted and rebuilt without asking.
- Later launches read again only files whose modified time or size changed.
- Encrypted notes (Version 2) never go into the SQLite file. Their index lives in memory while the vault is unlocked.

---

## Identifiers

- **Vault:** the vault id, a UUID v4 in `.wrriter/vault.json`.
- **Note:** its path inside the vault, with forward slashes. Wrriter writes no hidden ID into a note.
- **Index rows:** internal to the index. They never leave it and are never written anywhere else.

---

## Dates and Times

| Where | Format | Example |
|---|---|---|
| `remind` | `YYYY-MM-DDTHH:mm`, local time | `2026-10-20T10:00` |
| `created` | Open | |
| Journal note | `YYYY-MM-DD.md` | `2026-10-15.md` |
| Quick note name | `Quick note YYYY-MM-DD HH.mm` | `Quick note 2026-10-15 17.52` |
| Pasted image | `Pasted image YYYYMMDD-HHmmss.png` | `Pasted image 20261015-143210.png` |
| Template `{{date}}` | `YYYY-MM-DD` | `2026-10-15` |
| Backup zip (V2) | `<Vault name> YYYY-MM-DD.zip` | `Vault name 2026-10-15.zip` |
| Modified | The file's modified time. Never stored in a note | |
| Date line above the title | Display only: the modified date and time | `17 October 2026 at 08:12` |

---

## Relationships at a Glance

```
App data folder (this PC, never synced)
  vaults.json -> the vault folders
  settings.json, window-state.json, logs/
  per vault: first-paint state, pending jobs list,
             search index (cache), graph positions (cache, V3)

Vault folder (synced by Syncthing)
  .wrriter/        vault id, pins, manual order
                   (V2: folder views, device label, handled reminders, encryption)
  attachments/     copied files, hidden from the tree
  Inbox/           quick captures
  Journal/         daily notes (V2)
  Templates/       templates (V2)
  any folder/      notes (.md), PDFs (listed in V2), encrypted notes (V2)
  .stfolder, .stversions, .obsidian, .git and every other dot-folder:
                   never read, changed or shown

Notes point to notes by name ([[...]]) and to attachments by relative path.
Tags, backlinks, previews and all counts are worked out in the index.
They are never stored in the vault.
```

---

## Compatibility Checklist (the sample notes)

`tests/samples/` holds one hand-made note for each line below. For every one: opening and closing leaves it byte for byte the same, and editing one paragraph changes only that paragraph. It runs on every build and must pass before M2 counts as done. None of Krishna's own notes are used.

- [ ] Callouts with type, title and both fold markers, a callout nested in a callout, a callout holding a list and an image
- [ ] A callout of a type Wrriter does not know
- [ ] `dataview` and `dataviewjs` blocks, and inline fields `key:: value`
- [ ] Templater tags
- [ ] Footnotes
- [ ] Raw HTML, including a script tag
- [ ] Block IDs and block links
- [ ] Note embeds and image embeds with a size (`![[pic.png|300]]`)
- [ ] `==highlight==` and `%% comment %%`
- [ ] Maths and Mermaid blocks
- [ ] Custom task states such as `- [/]`
- [ ] Frontmatter with unknown keys, comments and both forms of `tags`
- [ ] Broken frontmatter
- [ ] Windows line endings
- [ ] No final newline
- [ ] UTF-8 with a byte order mark
- [ ] Mixed bullet characters, numbering styles and indentation
- [ ] Wikilinks with an alias, a heading and a folder path
- [ ] Images with width and alignment, linked from a note in a subfolder
- [ ] A title longer than 100 characters, and a title with characters Windows does not allow
- [ ] A file with a long dash in the body (it must stay untouched)
