# Wrriter - Project Breakdown into Phases and Tasks (Version 1)

> **Governance first.** Every governing document is read and validated before production code. Nothing that depends on an open decision is built.
> **Notes are never at risk.** The round-trip check, `SafeWriter` and the pending jobs list are built before the features that lean on them, and their checks run on every build.
> **Offline and free.** Version 1 has no accounts, no analytics, no update check and no network call except an image dropped in from a website. Nothing costs money to run.
> **Ready for Version 2 and 3, not built for them.** The vault id, Windows-safe names, an encryption-ready jobs list and conflict copies shown as ordinary notes go in now. No Version 2 or 3 feature is built before M5 is done.

**Scope.** Version 1 only, the Daily driver: you move fully to Wrriter and stop using Obsidian (versions doc). Version 2, Version 3 and the Later list are not in this file.

**Numbering.** Wrriter's other docs use Phase 1, 2 and 3 to mean Version 1, 2 and 3. To keep the two apart, this file names its build phases after the five milestones in Features 7 (M1 to M5), plus one setup phase before M1. "Phase 2" anywhere in the Wrriter docs means Version 2, never M2.

**What this file is.** Features 7 asks for every Version 1 feature to be assigned to a milestone and approved by Krishna before M1 starts (ARCHITECTURE.md, Open before M1, item 8). This file is that list, drafted from the guide table in the versions doc, Features 1 to 9, the UI hand-off and the governance set. Antigravity checks it against those docs and reports anything missing or misplaced. Once Krishna approves it, it replaces the Milestone column in UTILITIES.md.

**Status.** Nothing is ticked. No code exists yet. The governance set was drafted on 25 Oct 2026 and has not been validated.

**The five checks** from the session template in SYSTEM.md hold for every task:

- **Convenience:** extremely convenient for the note-taking it serves, with no friction left in
- **Speed:** the budget rows it touches still hold
- **Feel:** pleasant and minimal, with motion that is smooth and never in the way
- **Safety:** it cannot damage a note, lose typed text or leave a job half done
- **Match:** it matches the mockup exactly, with every difference listed

## No time estimates: read this first

- No dates or pace have been set, so this file gives no week ranges (versions doc, Rules, and call 2). Feasible means it can be built and proven. It does not mean how long it takes.
- The order is the plan. The risky checks run on day one of M1. Each milestone ends with a report of measured numbers, and the next one starts only when Krishna says go.
- If dates are wanted later, they should come from the pace measured on real milestones, not from a guess.

## Rules for every phase

- A milestone is done when the Done when checks of its features pass and Krishna has used it (Features 7).
- Each milestone ends with a short report: what works, what does not, and the measured numbers compared with PERFORMANCE.md as pass or miss. Animations built in it get their dropped frames. Each miss comes with its cause and a first fix.
- Antigravity does not start the next milestone until Krishna says go.
- Each UI slice is shown to Krishna beside the matching mockup screenshot, same window size, light and dark, with every visible difference listed, before the next slice starts (UI hand-off section 15).
- Anything the mockup does not draw (UI hand-off section 13) is built from the same tokens, icons, menu look and motion, and shown to Krishna when done. That includes the empty state, notices and dialogs of every feature.
- A part that depends on an open decision is not built until Krishna answers (ARCHITECTURE.md rule 25). The table at the end of the setup phase says what each one blocks.
- Every feature closes against DONE.md line by line, and every session uses the template in SYSTEM.md section 9.
- Where a feature needs the index that arrives in M3, an earlier milestone builds the simple version and says so in its report (Features 7).
- A feature is cut only from the cut line at the end of this file, and the cut is recorded in the report of the milestone that would have built it.

---

## SETUP: Governance and foundation (before M1)

### Governance documents (validate before the first coding session)

- [x] Read and validate `ARCHITECTURE.md` (processes, layers, source layout, 25 rejection rules, Open before M1)
- [x] Read and validate `SYSTEM.md` (conventions, NEVER DO list, session template)
- [x] Read and validate `SCHEMA.md`, including every item marked Open
- [x] Read and validate `PERFORMANCE.md`, `DEPENDENCIES.md` and `DONE.md`
- [x] `UTILITIES.md` and `CHANGELOG_INTERNAL.md` exist, with planned entries only
- [ ] Features 1 to 9, the Feature map by version, the versions doc, the UI hand-off and the UI reference read. Where the versions doc and the Feature map disagree about which version a feature belongs to, the versions doc wins. For looks the order is the UI hand-off, the UI reference, the screenshots, then Features 1 to 9
- [ ] The Editor view mockup screenshots, light and dark, sit beside the UI hand-off
- [ ] This file checked by Antigravity and approved by Krishna

### Repository and tools

- [ ] Create the GitHub repository. When it goes public is versions doc Question 3
- [ ] First commit: the governance set at the repo root, plus the Features docs, the versions doc, the UI hand-off, the UI reference and the mockup screenshots in a folder Krishna picks
- [x] Check how Antigravity loads project rules. Configured and active via `.agents/rules/` and `SYSTEM.md` section 9
- [x] Write the reference machine into the repo (PERFORMANCE.md): 64-bit Windows 11, AMD Ryzen 5 5600H (i5-class), 8 GB of RAM and 512 GB NVMe SSD
- [ ] Arrange a Windows 10 and a Windows 11 machine, real or virtual, for the M1 window check and the clean installs in M5

### Open items and what each blocks

Nothing that depends on a row is built until it is decided. Rows 15 to 17 are new: they are gaps found while writing this file, not decisions anyone has made.

| # | Open item | Decided by | Blocks | Needed by |
|---|---|---|---|---|
| 1 | Renderer state library (plain React state or Zustand) | **Decided:** Plain React state and context (no Zustand). ADR-W13 | Unblocks renderer features | Decided (Setup) |
| 2 | Test and lint tools: Vitest, Playwright, ESLint, dependency-cruiser, Stylelint, Prettier, @electron/fuses | **Decided:** Yes to all 7, added when first needed (Vitest, ESLint+typescript-eslint, dependency-cruiser, Prettier now; Stylelint with token checks in M1; Playwright with packaged test in M1; fuses at M5) | Unblocks build checks & tests | Decided (Setup) |
| 3 | This milestone list | Antigravity audited against Features 1-9, UI hand-off & versions doc; report submitted to Krishna | The start of M1 | Pending Krishna's approval of audit report |
| 4 | Versions doc Question 1: if Windows 10 cannot have 16 px corners and also resize and maximise properly, which wins | **Decided:** Yes to recommendation (resizing, maximising and snapping win; Windows' own square corners used on Win 10). Recorded in ADR-W06 | Unblocks M1 window shell fallback | Decided (Setup) |
| 5 | Worker type for the index and job workers | Day-one check, then ADR-W11 | Both workers | M1 |
| 6 | File watcher library | Day-one check, then ADR-W12 | The watcher adapter | M1 |
| 7 | Which worker writes autosaves, so a save never waits behind a job | Antigravity proposes, Krishna approves | Autosave | M1, used in M2 |
| 8 | App data and `.wrriter` file format and names (plain JSON proposed) | Confirmed in M1 (SCHEMA.md, Status) | `AppDataStore`, `JobsStore`, `.wrriter` files | M1 |
| 9 | UI hand-off decision 4: the Archive and Trash tiles, and which of Move to folder, Select notes, Share and Export as are in Version 1 | Krishna | Two tiles, menu items in the editor and notes pane menus, moving a note without dragging | M1 panes |
| 10 | UI hand-off decision 5: where the saved state and the word count live | Krishna | Showing the saved state and the counts | M2 |
| 11 | UI hand-off decision 1: how highlights and coloured text are written | Krishna | Highlight and coloured text, and their sample note | M2 |
| 12 | UI hand-off decision 2: the pull quote and the blockquote | Krishna | Both quote elements | M2 |
| 13 | UI hand-off decision 3: how a tag gets its colour | Krishna | The colour of the tags row | M2 look, M3 data |
| 14 | The format of the `created:` value | Krishna (SCHEMA.md) | Writing `created:` on new notes, duplicates and imports | M3 |
| 15 | Where the backlink count and list, job progress (`Updating links 120 of 3,400`) and indexing progress (`Indexing 12,400 of 50,000`) show. Features 4, 7 and 9 put them in the bottom bar, which the UI hand-off removed. Decision 5 covers only the saved state and the word count | Krishna | Backlinks on screen, job and index progress on screen | M3 |
| 16 | The strip at the top of the quick capture and pop-out window. Features 3 says it hides until the cursor reaches it, like the main bars, and the UI hand-off removed auto-hiding bars | Krishna | The small window's strip | M4 |
| 17 | A way to reorder notes and move a folder without dragging. SYSTEM.md says drag is never the only way, and no doc names one. Move to folder (decision 4) would cover moving a note between folders only | Krishna | Done for note reordering and folder moves | M4 |
| 18 | Application ID (placeholder `app.wrriter`) | Krishna | The installer, and in Version 2 notifications | Before the first installer anyone keeps, M5 at the latest |
| 19 | Versions doc Question 3: when the repository goes public | Krishna | Publishing | M5 |
| 20 | Versions doc Question 2: text wrapping around images | Krishna | Version 2 or Later only | Does not block Version 1 |

**Done when**

- [ ] Krishna has read every governance doc at least once
- [x] Rows 1 to 4 are answered, and rows 5 to 8 have their check or proposal planned in M1
- [ ] Krishna has approved this list

---

## M1: Vaults and files

**At the end:** Wrriter opens a folder as a vault in its own window shell and shows its folders and notes, with nothing in the folder changed. Writing arrives in M2.

### Scaffold (enough to package an app for the day-one checks)

- [ ] Electron, React, TypeScript (strict, `noUncheckedIndexedAccess`) and Vite. Pick the Vite and Electron wiring (electron-vite, vite-plugin-electron or own config) and record it in DEPENDENCIES.md
- [ ] Source layout exactly as ARCHITECTURE.md: `shared/` with its own tsconfig (no DOM, no Node), `main/`, `workers/`, `preload/`, `renderer/`, `tests/`, `docs/decisions/`
- [ ] electron-builder NSIS, current user only, so every check runs on the packaged app and never on the dev build
- [ ] Security baseline in every window: context isolation on, Node off, sandbox on, a strict Content Security Policy, navigation and new windows denied, every permission request denied
- [ ] Preload bridge that exposes `window.wrriter` with the fixed request list from `shared/ipc` and nothing else. The router checks the sender and every argument. Pick own validators or zod
- [ ] `Result`, `AppError`, `toMessage`, `Clock`, `TestClock` and `IdGenerator` in `shared/`
- [ ] Lint and build checks from the first commit: no synchronous file call in the main process after startup, no floating promises, the layer import rules
- [ ] ADRs W01 to W05 and W07 to W10 written (ARCHITECTURE.md, Decision Records). W06, W11 and W12 follow the checks below

### Day-one checks (reported to Krishna before any feature is built)

- [ ] better-sqlite3 installs inside the packaged app on Windows and runs one query in the main process and one inside a worker, for each worker type being considered (utility process, worker thread). ADR-W11 records the choice
- [ ] The vault generator makes the 50,000-note test vault. The file watcher survives 50,000 files created at once, with no freeze and no lost track, and the full rescan by modified time and size runs when Windows reports lost events. ADR-W12 records the library (chokidar, @parcel/watcher or `fs.watch`)
- [ ] Both results reported to Krishna in plain words. If either fails, Antigravity stops and tells Krishna before choosing another approach
- [ ] Window check on Windows 10 and 11, with a frameless window, three drawn buttons and 16 px corners: dragging, double-click to maximise, Win+arrow keys, drag to the edge to snap, resizing from every edge and corner, and the corners when maximised. The report says what happens to the snap layouts flyout and whether a workaround exists. Question 1 decides the fallback. ADR-W06 records the result

### Benchmark harness (right after the day-one checks)

- [ ] Vault generator complete: 50,000 notes, some of 1 MB, one note with 200 headings, 5,000 notes that link to one note, nested folders
- [ ] Scripted benchmarks against the packaged app, and one command that runs them all and writes the results to a file in the repo
- [ ] The quick set runs on every build and fails it at 20% worse than the stored baseline. The full set runs on the reference machine once per milestone
- [ ] Lag monitor in development builds: every main process block and every window long task over 50 ms, with where it came from
- [ ] Size report on every build
- [ ] First numbers recorded in PERFORMANCE.md (Measured Baselines), then the budget tuned once with Krishna. From then on a number changes only by Krishna's decision

### Tokens, motion foundations and build checks (before any animated feature)

- [ ] `tokens.css` ported from the UI reference: colours for light and dark, the five accents and the text colour on each, the type, space and size scales, the two radii, the shadows, the four speeds and three curves
- [ ] `data-theme` and `data-accent` on the app root. Inside the note pane the accent is replaced by the grey, except callouts, tags and the colour set
- [ ] Build checks: token check, contrast check (4.5:1 text, 3:1 large text, icons and outlines, all five accents, both themes), motion check, long-dash check
- [ ] Motion helpers, `useReducedMotion()` (the Windows setting plus the Motion setting), `flipGlide`, and the hidden slow-motion switch (every duration five times longer, development only)
- [ ] Confirm the Windows Animation effects setting reaches the app as reduced motion on Windows 10 and 11 (Features 8)
- [ ] Inter bundled. Code font stack: Cascadia Code, Cascadia Mono, Consolas
- [ ] Icon set copied from the UI reference as inline SVG
- [ ] Development component gallery: every shared component and view, fake data, light and dark, all five accents

### Files on disk and safety

- [ ] `VaultReader`
- [ ] `SafeWriter`: a dot-prefixed temp file beside the note, flush, rename over the note, line endings and byte order mark kept, a byte comparison so unchanged bytes are never written, the write remembered so the watcher ignores it, and a retry with the text kept when another app has the file locked
- [ ] SafeWriter kill test: the process ended in the middle of saving a large note, 100 times, and no note is ever damaged. Plus a locked file, Windows line endings and a byte order mark
- [ ] Watcher adapter on the ADR-W12 library: events batched, Wrriter's own writes ignored for a moment, a full rescan on lost events
- [ ] `JobsStore`: one file per vault in the app data folder, saved the safe way, ticks in batches of about 100, room for encrypted entries in Version 2
- [ ] `JobRunner` in the job worker: one job at a time, about 4 to 8 files in parallel, each through `SafeWriter` with its flush
- [ ] `JobService`: the job written before the first file is touched, finished (never undone) at the next start with a notice, locked files retried, missing files skipped, a job on an unavailable vault waits. Proven here with a test job. The real jobs arrive in M3 and M4
- [ ] Which worker writes autosaves: Antigravity proposes, Krishna approves, ADR (open item 7)
- [ ] `AppDataStore`: `vaults.json`, `settings.json`, `window-state.json`, the first-paint state per vault and `logs/`. Every format versioned. Plain JSON and the file names confirmed (open item 8)
- [ ] `shared/domain/names`: characters Windows does not allow, trailing spaces and dots, reserved names, the 100-character cap in the file name only, a number on a clash, never two names that differ only by case. Path length tested with long titles and deep folders
- [ ] `FractionalIndex` in `shared/domain/ordering`, and `OrderService` for `.wrriter/order.json` and `.wrriter/pins.json`
- [ ] Folders whose names start with a dot are never read, changed or shown, except `.wrriter`. `attachments/` is hidden from the tree
- [ ] Syncthing conflict copies show as ordinary notes. Handling them is Version 2
- [ ] `RecycleBin` adapter. Every delete goes to the Windows Recycle Bin
- [ ] `Notice` component, in the same corner every time
- [ ] Index table layout proposed by Antigravity (SCHEMA.md). It is a cache, so it can change freely later

### Startup

- [ ] Before the first window: read settings and create the window hidden, in the theme's background colour. Nothing else. The single-instance lock joins in M4
- [ ] The window is shown when its first frame is ready. The right theme is applied before the first frame with no fade, and there is no white flash
- [ ] First paint from saved state: pane widths and the first page of the note list. Open tabs join in M2
- [ ] After the first paint, when idle: start the watcher and bring the list up to date. The index worker joins in M3

### Vaults

- [ ] First-run screen with two buttons: open a folder as a vault, or create a new vault in a suggested `Documents\Wrriter` or any other place (not drawn in the mockup, shown to Krishna)
- [ ] Open folder as vault: the notes show at once, nothing is converted, and nothing is written except `.wrriter/vault.json` with a UUID v4 vault id
- [ ] A folder inside an existing vault, or one that contains a vault, is refused with the reason
- [ ] Several vaults. The vault button opens the vault menu: the vaults with a check on the open one, switching, and Add vault. Each vault has its own folders, pins and order
- [ ] Vault right-click menu: rename (display name only), show in File Explorer, remove from Wrriter (never deletes a file)
- [ ] An unavailable vault (drive unplugged, folder renamed) shows Locate and Remove from list
- [ ] Nothing crosses from one vault into another

### Window shell and panes (UI slices 1 and 2)

- [ ] `WindowShell`: frameless per ADR-W06, 16 px corners or the fallback from Question 1, a one pixel edge line, the 40 px toolbar, dragged by any empty part of the toolbar, double-click maximises
- [ ] Three drawn window buttons: 24 px circles, with the hover and pressed colours in UI hand-off section 4
- [ ] Toolbar: the sidebar toggle works now. Back and forward, the note name field and the new note button are drawn now and start working in M2
- [ ] First pane: 248 px, divider drag with the width remembered, slides shut at Slow, its contents out of the tab order while shut
- [ ] Tiles: two rows of three from a list in code, with the sliding active highlight at Base. Notes works now and lists every note in the vault, read from disk until M3. Search and Tags start working in M3, Inbox in M4. Archive and Trash wait on decision 4
- [ ] Folder tree: the FOLDERS label, 32 px rows, children loaded only on expand, the folder icon as the toggle with the chevron on icon hover, subfolders indented 24 px, empty folders shown. Note counts come from the index in M3
- [ ] Folder actions: new folder (inside the selected folder, or at the root), rename (F2, with a message for characters Windows does not allow), delete with a confirmation that states the note count. Until M3 a folder rename does not update links (Features 7). Moving a folder by drag arrives in M4
- [ ] A folder created, renamed or moved outside Wrriter appears without a restart
- [ ] Notes pane: 320 px, the header with the pane toggle and folder name, the three-dot menu with Sort by, Show sort icon, Show previews, Show dates, Show images (remembered) and New folder. Select notes waits on decision 4
- [ ] `VirtualList` and `NoteRow`: virtualised, paged by "continue after this row", 80 px rows. In M1 titles and dates are read from the folder. Preview lines and thumbnails arrive with the index in M3. TanStack Virtual or own code is picked on a 50,000-row scroll test
- [ ] Pinned group: pin and unpin from the right-click menu and a shortcut, stored in `.wrriter/pins.json` and never in the note
- [ ] Sort: manual (fractional keys in `.wrriter/order.json`), modified and title. Created joins in M3. Notes with no key show at the top by modified time
- [ ] Note right-click menu: pin and delete to the Recycle Bin. Open in new tab joins in M2, duplicate in M3, pop out in M4
- [ ] Pane width limits and the smallest window size: Antigravity proposes, Krishna approves (UI hand-off section 13)
- [ ] Motion built here: the pane slide, the tile highlight, the folder icon and chevron, folders opening, row hover, the selected row fade, the pin glide, the sort glide (about 50 rows or fewer), the delete collapse, the list cross-fade on a tile or vault change, notices

**Done when**

- [ ] The day-one checks and the window check were each reported to Krishna in plain words, and ADR-W06, W11 and W12 are written
- [ ] The quick benchmark set runs on every build, and the first numbers are in PERFORMANCE.md
- [ ] The motion foundations and every build check existed before the first animated feature
- [ ] An existing folder of notes opens as a vault, and comparing every file before and after shows nothing changed except the new `.wrriter` folder
- [ ] A fresh install shows the two vault buttons
- [ ] Two vaults can be added and switched, and removing one leaves its folder untouched on disk
- [ ] Renaming a vault folder in File Explorer shows it as unavailable with Locate and Remove, with no crash and nothing deleted
- [ ] The SafeWriter kill test passes 100 times
- [ ] Scrolling the 50,000-note test vault stays smooth, and expanding a folder in it feels instant
- [ ] A folder renamed in File Explorer updates in the tree while Wrriter is open
- [ ] Pinning a note does not change the note file
- [ ] The M1 report is sent, and Krishna says go

---

## M2: Editor and window

**At the end:** you can write in Wrriter. Notes save themselves, keep their exact bytes and open in tabs. Links and search arrive in M3.

### Markdown core and the round-trip check (first in M2)

- [ ] Sample notes in `tests/samples/`, one for each line of the SCHEMA.md compatibility checklist. Krishna reviews them before they land
- [ ] Spike: splitting a note into blocks with the exact source text of each (markdown-it, micromark or mdast, or TipTap's own markdown support), run against the sample notes. The result goes into DEPENDENCIES.md and an ADR
- [ ] Spike: frontmatter with the yaml Document API. Changing one owned key leaves everything else byte for byte
- [ ] `blockSplitter` and `planSave`: only edited blocks are turned back into markdown, in the note's own style, with its line endings, byte order mark and final newline kept
- [ ] The round-trip check (the sample-note check) runs on every build and fails it: every sample opened and saved without editing stays byte for byte the same, and one edited paragraph is the only difference. If TipTap cannot keep a note intact, Antigravity stops and tells Krishna and does not patch around it
- [ ] Note content is never run: raw HTML and script tags show as text, `dataview` and `dataviewjs` blocks show a Not run pill, Templater tags and inline fields stay as written
- [ ] Everything on the pass-through list in SCHEMA.md (Note Body) is kept word for word

### The editor

- [ ] `EditorHost`: one live TipTap editor. Check whether hidden tabs can keep their text, cursor, scroll and undo history without a drawn editor. If not, the three newest tabs keep editors and older tabs lose undo history while hidden, and Antigravity tells Krishna before building it
- [ ] Markdown shortcuts while typing: a hash and a space, a dash and a space, square brackets and a space, three backticks
- [ ] Autosave when typing pauses, and when switching notes, closing a tab or window, and quitting, through the worker chosen in M1. Unchanged bytes are never written. A failed save shows a notice, keeps the text and retries
- [ ] The saved state and the word count on screen: wait on decision 5
- [ ] Outside changes to an open note: with no unsaved typing it reloads quietly and keeps the cursor. With unsaved typing the typed text is kept and the outside version is saved as a separate copy next to the note, with a notice. Deleted or renamed outside Wrriter: a notice, and the text stays in the tab
- [ ] `shared/domain/titles`: the title is the first line without heading marks, Untitled then Untitled 2, the file follows the first line only if the names matched when the note was opened, and the file is renamed only when the note is left. Until M3 a rename does not update links (Features 7)
- [ ] Renaming by hand with F2, and from the toolbar name field: click to edit with the name selected, Enter or a click elsewhere keeps it, Escape cancels, an empty name is refused, ends trimmed, 60 characters at most. The new name shows at once in the toolbar, the row, the title and the tab
- [ ] New note from the toolbar button, the tab plus button and Ctrl+N, in the selected folder. No file is written until something is typed. New notes appear at the top of the list and slide in at Base
- [ ] Paste: web content becomes markdown (headings, lists, links, bold) and is never inserted as HTML. Ctrl+Shift+V pastes plain text
- [ ] Undo and redo per note, never animated
- [ ] English spell check with suggestions on right-click
- [ ] `VaultProtocol`: one app protocol that serves files inside open vaults only, never `file://`

### Find and replace in a note

- [ ] `FindBar` over the top right of the note column: Ctrl+F opens find, Ctrl+H adds the replace box. A count such as 3 of 12, previous and next, Match case, Whole word, Replace, Replace all and close
- [ ] Selected text fills the find box. The last search and both toggles are remembered until Wrriter closes
- [ ] Find matches the text as shown, not the markdown symbols behind it. Code is searched. Properties are not
- [ ] Replaced text takes the formatting of the first character it replaces. Wikilinks and pass-through text are highlighted, never replaced, and counted as skipped
- [ ] Replace all is one undo step. A replace that changes nothing writes nothing
- [ ] A match inside a folded heading unfolds it
- [ ] Each tab, and in M4 each pop-out, has its own bar. Find in note and Replace in note are palette commands
- [ ] Replace all of 5,000 matches in a 1 MB note in under 1 s, measured and reported

### The note column and its elements (UI slice 3)

- [ ] Note column: fills the editor pane with the Note margin on each side (default 24 px), no width cap, a 360 px floor with a sideways scroll bar below it, 88 px above the first line and 64 px below the last. Hiding a pane glides the text without re-wrapping it
- [ ] Elements in the order of UI hand-off section 6, a few at a time. Each one survives open, edit and save with the file unchanged:
  - [ ] Date line and title
  - [ ] Tags row look. It is filled from the index in M3, and its colour waits on decision 3
  - [ ] Paragraph, heading 2 and heading 3. Headings 4 to 6: Antigravity proposes line heights and weights, and Krishna approves
  - [ ] Bold, italic, strikethrough, inline code
  - [ ] Highlight and coloured text: wait on decision 1
  - [ ] Note link pill (the look only, links work in M3) and web link with the globe icon, opened in the default browser after the address is checked
  - [ ] Bullet, numbered and task lists, with the tick drawing at Fast
  - [ ] Divider (the five dots) and table
  - [ ] Pull quote and blockquote: wait on decision 2
  - [ ] Callouts: every type, the colour mixes from the UI reference, the type dropdown from the icon, the `-` and `+` markers as the starting state only, an unknown type kept by name, nested callouts kept
  - [ ] Code block with its language header
  - [ ] File chip look. Attachments start working in M4
  - [ ] Images inserted from the slash menu with the file picker: resized by the corners with proportions kept, left, centre or right, the selected ring and bar, double-click back to natural size, written as `![alt|400|center](...)` with the path relative to the note. Removing an image never deletes its file. Images decode off the main thread and reserve their height
  - [ ] Placeholder and selected text
- [ ] The Weekly plan note rebuilt with the same words and compared with the screenshots element by element

### Handles, folding and dragging blocks (UI slice 5)

- [ ] Collapsible headings 1 to 6: the fold arrow in the margin stays visible while folded, folding also folds sub-headings, folding is only a view and is never written, a note always opens fully expanded, the cursor skips folded text, a copy includes hidden text. Fold all and Unfold all are palette commands
- [ ] A heading is dragged by its fold arrow (more than 4 px is a drag, a click is a fold) and always carries its whole section. A heading never shows a grip
- [ ] A callout is dragged by its icon, its bar or the margin strip beside it. A click on the icon still opens the type dropdown
- [ ] Every other block has a grip. A list item carries its nested items
- [ ] During a drag: an open heading or callout folds to one row, a faint copy follows the pointer, the block lifts with a soft shadow, a drop line slides between positions, the note scrolls near the top and bottom (speed tuned and reported), Escape glides it back, and the drop settles at Base
- [ ] Alt+Up and Alt+Down move the block under the caret, a heading with its section. One Ctrl+Z undoes a move with no animation, and the file differs only in the moved block's position
- [ ] The Drag to move tooltip shows once, then never again
- [ ] A control that appears on hover also appears while the caret or keyboard focus is in that block
- [ ] Folds animate at Base. If that cannot be done without risking the note, folds happen at once and Antigravity tells Krishna

### Menus, slash menu and floating toolbar (UI slice 4)

- [ ] `Menu`: one look for every menu, one open at a time, closed by a click outside or a choice
- [ ] Editor three-dot menu: Pin or Unpin, Duplicate (works from M3), Find in note, Pop out (works from M4), Show in File Explorer, Delete note. Move to folder, Archive, Share and Export as wait on decision 4
- [ ] Right-click menus for notes, folders, tabs and vaults (not drawn in the mockup, shown to Krishna)
- [ ] `SlashMenu`: twelve items in four groups, filtering by name and related words, keys that wrap, the no-match state, flipping above near the bottom, every inserted block with its placeholder and the caret in place
- [ ] `FloatingToolbar`: block type, list type, bold, italic, strikethrough, link and more. Fades at Fast, never follows the selection, stays inside the pane
- [ ] Every slash menu and toolbar item is also a palette command

### Tabs, navigation and the palette

- [ ] `TabStrip`: 32 px along the bottom of the editor pane, one tab per open note, the title following the note live, closed by its close mark, middle-click and Ctrl+W, overflowing tabs scroll sideways
- [ ] A click on a note opens it in the current tab. Ctrl+click and middle-click open a new tab. Ctrl+Tab and Ctrl+Shift+Tab move between tabs
- [ ] After a tab is closed with the mouse, the other tabs keep their widths until the cursor leaves the strip
- [ ] Tabs belong to each vault and come back after a restart. The first paint now includes the open tabs
- [ ] Tab reordering by drag (first on the cut line)
- [ ] Back and forward per tab: the buttons and Alt+Left and Alt+Right, forward dimmed when there is nothing ahead, deleted notes skipped, renames followed
- [ ] `Palette`: the command palette (Ctrl+Shift+P) on one command registry, loose matching (own code or fuzzysort, decided here), each command's shortcut beside it, prepared after the first paint so it opens at once
- [ ] Every action in a right-click menu is also a palette command
- [ ] One shortcut list in code, from the table in Features 1. Ctrl+backslash hides and shows both navigation panes. A shortcut with nothing to do is ignored
- [ ] Open log folder command
- [ ] `Tooltip` after about half a second, `Dialog` with the palette motion

### Settings

- [ ] `SettingsWindow` from the gear, Ctrl+comma and the palette, loaded on first use: Theme (Follow Windows by default, Light, Dark), Accent (five, yellow by default), Motion (Follow Windows, Reduced, Full), Note margin (a slider from 16 to 96 px in steps of 4, Reset, live preview in the open note). Keep running in the background and Start with Windows are shown here and take effect when the tray arrives in M4
- [ ] A short Syncthing help text with a link to syncthing.net (Features 6)
- [ ] A theme or accent change is one cross-fade of every open window at Slow. Check whether Electron's engine supports View Transitions, and fall back to a Fast fade if not. A theme change made by Windows fades the same way
- [ ] Settings live in the app data folder, never in a vault

### Motion built here

- [ ] The typing touches: caret glide, selection fade, and the new-letter fade skipped when typing is fast. If they add any delay or dropped frames in a 1 MB note, the new-letter fade goes first and Krishna is told
- [ ] Menus, the palette, dialogs, tooltips, the find bar slide and the single match pulse, tabs opening and closing, block lift and settle, image glides, folds, the task tick

**Done when**

- [ ] The round-trip check passes on every build before M2 is reported done
- [ ] Force-quitting Wrriter while typing loses at most the last moment of typing and never damages the note
- [ ] Opening and closing a note without editing leaves its modified time unchanged
- [ ] Typing a hash and a space turns the line into a heading, and the saved file holds a markdown heading
- [ ] A first line with a colon or question mark makes a valid file name while the note keeps the line as typed
- [ ] Every Done when line of Find and replace in a note (Features 2) passes, including 5,000 replacements in a 1 MB note in under 1 s
- [ ] Every Done when line of UI hand-off sections 4 to 8 passes, except the parts waiting on a decision
- [ ] The Weekly plan note matches the screenshots in light and dark on all five accents, except the parts waiting on a decision
- [ ] Twelve tabs open and close by mouse and keyboard, and the hidden-tab check is reported
- [ ] Key press to letter on screen in a 1 MB note is within budget with all animations on
- [ ] Each UI slice was shown beside the screenshots before the next one started
- [ ] The M2 report is sent, and Krishna says go

---

## M3: Index and search

**At the end:** you can write, link and find. This is the first point where Wrriter can be tried for real (versions doc).

### The index

- [ ] The index worker starts after the first paint, on the worker type from ADR-W11. `IndexDb` on the layout proposed in M1 (a cache, version 1), WAL, about 500 files per transaction, prepared statements, relaxed durability. Exact values reported
- [ ] FTS5 with prefix indexes on the searched columns only. `ftsEscape` is the only place search text is escaped
- [ ] `lightIndexer`: frontmatter, tags, wikilinks, the first lines and the first image by pattern matching. Never the editor, never a full parse
- [ ] `Indexer`: the first index at low priority, about 8 files at a time, the folder on screen first. Later launches read again only files whose modified time or size changed
- [ ] A missing, damaged or older index is deleted and rebuilt without asking, with a delete-and-rebuild test
- [ ] `TitleList`: every note's title, path and modified time in memory, for the quick switcher
- [ ] `IndexClient`: the main process hands each window a channel that accepts only the fixed list of index reads. Every query is recorded in UTILITIES.md
- [ ] Indexing progress such as `Indexing 12,400 of 50,000`, sent a few times a second: where it shows waits on open item 15
- [ ] The note list now reads from the index: preview lines, thumbnails, sort by created, and folder note counts from COUNT queries
- [ ] Syncthing delivering thousands of files at once: changes batched, the index updated in the background, the window usable
- [ ] Idle work after the first paint: the index worker, then any interrupted jobs

### Properties

- [ ] `shared/domain/frontmatter` edits only `tags`, `status` and `created` here (`cover` and `remind` are Version 2). Every other key, every comment and the key order are kept, and so is the form of `tags` already in the file. A note gets a block only when its first property is set
- [ ] Broken frontmatter: shown as text, the file left untouched, a notice, and the properties count as empty
- [ ] `created:` written when a note is made in Wrriter, and added to a note without it the next time that note is saved for another reason: waits on the `created:` format (open item 14)
- [ ] The properties line under the title shows tags and status, and renders nothing when both are empty. Add tag and Set status commands. Status words already used in the vault are suggested
- [ ] Modified is the file's modified time, shown on the date line and never stored in the note

### Tags

- [ ] `shared/domain/tags`: allowed characters, not case sensitive with the first spelling shown, nesting by slash. A space while adding a tag starts the next one. A `#word` in the text stays plain text
- [ ] The Tags tile switches the lower part of the first pane to the tag list, built from the folder row (not drawn in the mockup, shown to Krishna), nested as a tree, with counts from the index
- [ ] Choosing a tag lists exactly the notes that have it
- [ ] Tag rename and merge from the tag's right-click menu, run as a job: a confirmation with the number of notes, only the `tags` key touched, no cancel button

### Wikilinks and backlinks

- [ ] `shared/domain/wikilinks` and `shared/domain/links`: `[[Note]]`, `[[Note|text]]`, `[[Note#Heading]]`, and `[[Folder/Note]]` when two notes share a name. A plain link resolves to the note in the same folder, otherwise the most recently modified
- [ ] Typing `[[` lists note names from the index and inserts the link
- [ ] A click opens the note, Ctrl+click opens it in a new tab, and following a link is a back and forward step. A link to a missing note is styled differently, and clicking it creates the note in the current folder
- [ ] A markdown link to a .md file in the vault opens in Wrriter. Unknown forms such as `[[Note#^id]]` stay as plain text, byte for byte
- [ ] Backlinks from the index, each with the line that holds the link. Choosing one opens that note. Where the count and list show waits on open item 15
- [ ] A link changed in another app updates the backlinks through the watcher, without a restart

### Jobs that keep links working

- [ ] `jobPlans` in `shared/domain`
- [ ] Rename job: every link to a renamed note is updated, including when the file follows its first line. Only the link text changes, and display text and heading parts are kept. A note open in another tab is updated in place with the cursor kept
- [ ] Folder rename and move job: one rename on disk, control back at once, then path-style wikilinks and relative image paths rewritten in the background. A folder rename triggers it from now on, dragging a folder from M4
- [ ] Note move job: the moved note's image paths and path-style links to it are rewritten. Triggered by Move to folder if decision 4 keeps it, and by dragging from M4
- [ ] Job progress such as `Updating links 120 of 3,400`: where it shows waits on open item 15
- [ ] Link updates, tag renames and folder moves have no cancel button
- [ ] Random-stop test, 100 times each: renaming a note with 5,000 links, moving a folder of 5,000 notes, renaming a tag used by 5,000 notes. After each restart every link is right and nothing else in any note changed. The job design is fixed before M3 counts as done
- [ ] A rename done outside Wrriter updates no links

### Search and switching

- [ ] `SearchService` and the Search view (Ctrl+Shift+F and the Search tile, not drawn in the mockup, shown to Krishna): results as you type with the title, the folder and a snippet built only for rows on screen, title matches first and then the most recently modified, the filters `tag:`, `status:` and `folder:` combined with words, the current vault only
- [ ] Quick switcher (Ctrl+P): loose title matching against the in-memory list, recent notes when the box is empty, Ctrl+Enter for a new tab, and Create "what you typed" when nothing matches

### Notes features that need the index or frontmatter

- [ ] Duplicate: in the same folder with a number added, the first line unchanged, a fresh `created:`, no pin, tags and status kept, attachments shared, and the copy opens
- [ ] Links to a deleted note stay as written and show as unresolved

**Done when**

- [ ] Deleting the index file and restarting rebuilds it, and nothing is lost
- [ ] The window stays usable while the first index of 50,000 notes is built, and a second launch with nothing changed reads no notes again
- [ ] First search results on 50,000 notes in under 200 ms, and quick switcher results in under 30 ms
- [ ] The tag list opens instantly on 50,000 notes, a nested tag shows as a tree, and renaming a tag keeps every count right
- [ ] Setting a tag or status writes only that key, and a note with keys such as `aliases` keeps them untouched
- [ ] Renaming a note with 200 links to it updates all of them and nothing else in those notes
- [ ] All three random-stop tests pass 100 times
- [ ] Opening a note with 500 backlinks shows the count with no delay
- [ ] A vault of 50,000 notes receiving all its files from Syncthing at once stays usable and ends fully indexed
- [ ] The M3 report is sent, and Krishna says go

---

## M4: Capture and files

**At the end:** the quick capture you left Obsidian for works from any app, and files drop straight into notes. Moving over for good waits for this point (versions doc).

### Tray, hotkey and one running copy

- [ ] `SingleInstance`: the lock is taken first at startup. A second launch from the Start menu, a shortcut or login hands its request to the running copy and starts no second engine
- [ ] `Tray`: the icon and its menu (New quick note, Open Wrriter, Quit), and a click on the icon opens the main window. Keep running in the background is on by default, with no question on first launch
- [ ] Closing the main window to the tray destroys it. Only the main process, the tray, the hotkey and the quick capture window stay alive. Opening from the tray rebuilds it from saved state, with tabs and the first page of the list in under 500 ms
- [ ] With keep running in the background off, closing the last window quits Wrriter fully
- [ ] `LoginItem`: Start with Windows is off by default, starts Wrriter hidden, and is offered only while keep running in the background is on
- [ ] `Hotkey`: Ctrl+Alt+N by default, changeable without a restart, confirms it was registered, and says plainly when the combination is taken
- [ ] While idle in the tray nothing runs: no timers, no polling, no rendering, no animation
- [ ] Index worker idle shutdown: memory saved measured against start time, and Krishna chooses

### Quick capture and pop-out (not drawn in the mockup, shown to Krishna)

- [ ] One small window for both jobs, with the same editor: small by default, resizable, its size and place remembered, following the theme and accent, on top by default with a pin toggle
- [ ] The top strip holds the pin toggle, open in main window and close. Whether it hides until the cursor reaches it waits on open item 16
- [ ] Quick capture: a blank note with a live cursor, no file until something is typed, saved into `Inbox/` (made at the first capture, an existing one used as it is, made again if deleted), named `Quick note YYYY-MM-DD HH.mm` when the first line is empty. Escape closes. Every capture is a fresh note. One capture window at a time, and the hotkey brings it forward. Open in main window moves the note to a tab
- [ ] A capture goes to the last active vault, or to a fixed vault chosen in settings
- [ ] Two approaches built and measured, a hidden window kept ready and a window made on demand: hotkey to cursor with and without the 120 ms entrance, and idle memory with and without the index worker kept alive. Krishna picks
- [ ] Entrance: a fade and a 6 px rise over 120 ms, the cursor live from the first frame, skipped if the first frame is late. Escape fades out at Fast, and the hotkey during that fade brings it back
- [ ] Pop-out from the note right-click menu, the tab right-click menu and the palette. Any number, one note each. The same note stays in step across windows through small changes. A pop-out survives closing the main window, does not reopen after a restart, and shows the same notice when its note is deleted or renamed outside Wrriter
- [ ] The Inbox tile shows the Inbox folder
- [ ] The Quick Note start flag: Wrriter starts showing only the small window. The installer makes the Start menu shortcut in M5. Its start time to a typing cursor is measured and reported, with no number promised

### Attachments

- [ ] `AttachmentService`: one hidden `attachments/` folder at the vault root, original names kept, a number added on a clash, characters Windows does not allow replaced with a hyphen, an identical file reused, never deleted with a note and never copied with a duplicate
- [ ] Written as `![name](attachments/name.png)` or `[report.pdf](attachments/report%202.pdf)`, percent-encoded and relative to the note
- [ ] Shown inline: PNG, JPEG, GIF, WebP, SVG and BMP, plus any other type Antigravity confirms the engine shows (AVIF, for example). HEIC and every other type is a file chip
- [ ] `FileChip`: type icon, name and size. Double-click opens the default Windows app. Right-click: Open, Show in File Explorer, Copy, Remove from note (removes the link only). A missing file shows `File not found: name` and the note is unchanged
- [ ] Pasted images and screenshots are saved as `Pasted image YYYYMMDD-HHmmss.png` and inserted like a dropped file

### All drag and drop (the table in Features 5)

- [ ] From File Explorer onto a note: a drop line, images shown, other files as chips, several files one per line in Explorer's order, copying in the background with a placeholder, progress and cancel for a large file, a confirmation over 500 MB, a folder dropped on a note shows a short message, and Ctrl+Z removes the line and keeps the file
- [ ] From File Explorer onto the note list or a folder: .md files and folders are imported, and any other file becomes a new note that holds it, titled with the file name
- [ ] Selected text from a browser or another app becomes markdown at the drop point. Tested in Chrome, Edge and Firefox. No source address in Version 1
- [ ] A link from a browser becomes a markdown link, using the page title when the browser gives one
- [ ] An image from a website is downloaded at the moment of the drop by `ImageDownloader`, the only network code in Wrriter. If it cannot be downloaded, a link is inserted instead (third on the cut line)
- [ ] A note dropped on a folder moves there (the M3 job). A note dropped at a new position in the list changes the manual order and switches the sort back to manual. A note dropped into an open note inserts a wikilink
- [ ] A folder dropped on another folder moves there (the M3 job)
- [ ] A note dragged out to File Explorer or the desktop copies its .md file there (`DragOut`, second on the cut line)
- [ ] A way to reorder notes and move folders without dragging: waits on open item 17
- [ ] Every drop that makes sense in a note also works in the quick capture and pop-out windows

### Import

- [ ] `ImportService`: the Import notes command (a file and folder picker) and drops. It copies, and the originals are never touched. Subfolders are kept, other files are copied alongside in the same structure, and the text of a note is never rewritten
- [ ] A name that already exists gets a number (`Plan 2.md`) and nothing is overwritten. Each copy keeps the original's modified time. `created:` is written from the original creation date only when the note has none
- [ ] Runs as a job with progress and a cancel button. Cancelling keeps what was copied and leaves no half-copied file. A summary at the end, for example `Imported 1,204 notes, 3 renamed because the name already existed`

**Done when**

- [ ] Ctrl+Alt+N opens quick capture while another app has focus, and opening and closing it without typing leaves no file
- [ ] A quick capture shows up in the Inbox of the last active vault, and a setting can fix one vault instead
- [ ] A quick capture window and two pop-outs are open at the same time, and typing in a pop-out updates the same note in the main window
- [ ] The capture report lists both approaches, with and without the entrance, and Krishna has picked one
- [ ] Closing the main window to the tray leaves no main window running, and launching Wrriter twice never makes two processes
- [ ] Every Done when line in Features 5 for dragging, attachments and importing passes
- [ ] Importing 5,000 notes finishes in under 60 s, and cancelling stops quickly
- [ ] The M4 report is sent, and Krishna says go

---

## M5: Finish

**At the end:** Version 1 installs on a clean PC, is measured against the budget, and is your only notes app.

### Installer and repository

- [ ] electron-builder NSIS installer: current user only, no administrator rights, a Start menu entry, an optional desktop shortcut, the Wrriter Quick Note shortcut with its start flag, and Open with Wrriter for .md files without becoming the default app
- [ ] Uninstalling leaves every vault untouched and asks whether to remove Wrriter's own settings and index
- [ ] The application ID registered: waits on open item 18 (placeholder `app.wrriter`)
- [ ] Only the English language files of the engine are kept, unused Electron fuses are turned off, and the installer stays under 120 MB with the size report
- [ ] `LICENSE` (MIT, copyright Rushi) and `README` (what Wrriter is, how to build it, and why Windows shows a warning when there is no code signing certificate), with no long dashes in either
- [ ] Installed and tested on a clean Windows 10 and a clean Windows 11 without administrator rights, and the app looks the same on a PC without Inter installed
- [ ] The read-only shortcut list in settings, taken from the one list in code
- [ ] The repository goes public when versions doc Question 3 says

### Measured and polished

- [ ] Speed report: the full set on the reference machine, packaged build, Windows Defender on, cold, warm and first after install, with the slow-disk run beside it. Every budget row shows pass or miss, each miss has its cause and a first fix, and no number was loosened without Krishna
- [ ] The 8-hour memory run: opening notes, typing, searching, switching vaults, opening and closing windows. If undo history grows memory steadily, undo is capped and the number reported
- [ ] Motion polish pass with Krishna: every animation reviewed with the slow-motion switch, dropped frames reported, any cut animation recorded
- [ ] With the network cable unplugged, every feature except downloading from a website works
- [ ] A note with a script tag shows it as text and runs nothing
- [ ] The Electron security checklist checked against the Electron version in use
- [ ] The dependency audit is clean, and every dependency has its DEPENDENCIES.md entry
- [ ] The PERFORMANCE.md pre-ship checklist is fully ticked
- [ ] Release notes with highlights only, and no long dashes
- [ ] The Version 1 release tagged in git

**Done when** (the Version 1 Done when list in the versions doc)

- [ ] The day-one checks of the search library and the file watcher, and the window check on Windows 10 and 11, were each reported to Krishna in plain words
- [ ] Each of M1 to M5 ended with a report, and Krishna said go before the next one started
- [ ] Every Done when check of the Version 1 features in Features 1 to 9 and the UI hand-off passes
- [ ] The round-trip check passes on every build
- [ ] The speed report shows every budget row as pass or miss, each miss has its cause and a first fix, and no number was loosened without Krishna
- [ ] An existing folder of notes opens as a vault and nothing in it changes until a note is edited
- [ ] The installer works on a clean Windows 10 and a clean Windows 11 without administrator rights
- [ ] Krishna uses Wrriter as his only notes app

---

## Risks

Taken from the feasibility table in the versions doc, ordered by how much damage they can do.

| # | Risk | Rating | Why it matters | Mitigation |
|---|---|---|---|---|
| R1 | **Existing notes kept byte for byte** | Risky | Only edited blocks may be rewritten, which is custom work on top of TipTap. A silent change to a note is a data-integrity bug. Features 2 calls it the biggest technical risk | The round-trip check on every build from M2. If it fails, Antigravity stops and tells Krishna |
| R2 | **The frameless window with drawn buttons and 16 px corners** | Risky | Electron's documents say corner rounding on a frameless window has no effect before Windows 11 build 22000. A transparent window cannot be resized or maximised by double-click. The snap layouts flyout is lost either way | The M1 window check on Windows 10 and 11, then Question 1. Fallbacks: Windows' own corners, or native buttons with the title bar overlay |
| R3 | **Speed on 50,000 notes and in a 1 MB note** | Check first | The budget numbers are starting values. Rename, move and import times depend on the disk | The harness in M1. The quick set fails the build at 20% worse. A miss is reported with its cause and options, never loosened alone |
| R4 | **Changing many notes safely** | Check first | A stop halfway through a rename would leave notes pointing at two names | The pending jobs list, the random-stop test 100 times per job, and the job design fixed before M3 is done |
| R5 | **better-sqlite3 inside the installed app** | Check first | A native module must run in the packaged app on Windows, in the main process and in a worker | Day-one check. Stop and tell Krishna before choosing another library |
| R6 | **The file watcher on 50,000 files** | Check first | Windows can report that it lost track of changes | Day-one check, with the full rescan by modified time and size as the fallback |
| R7 | **Twelve tabs without twelve live editors** | Check first | TipTap must keep a hidden tab's text, cursor and undo history without a drawn editor | Checked in M2. Fallback: the three newest tabs keep editors, told to Krishna first |
| R8 | **Quick capture in under 300 ms** | Check first | An Electron app starts slower than Notepad | Two approaches measured in M4, and Krishna picks |
| R9 | **Dragging text and images from websites** | Check first | Chrome, Edge and Firefox hand over different things | Tested in all three in M4. An image that cannot be downloaded becomes a link |
| R10 | **Open decisions** | Not rated | The five UI hand-off decisions, the versions doc questions and open items 15 to 17 each block part of a milestone | Not built until answered. The setup table says what each one blocks |
| R11 | **Antigravity's rule loading is not verified** | Not rated | The governance only works if the editor reads it | Every session uses the template in SYSTEM.md section 9, which names the files |
| R12 | **The look and motion of the mockup on five accents in two themes** | Proven, but large | Many small values must match exactly | The token, contrast and motion checks on every build. Motion has its own cut order |
| R13 | **Version 1 is the largest version** | Not rated | All drag and drop and the second window had to be in it, and you are moving over fully | The order, the risky checks on day one of M1, a measured report at the end of each milestone, and the cut line below |

### Cut line, if time runs short

Features move to Version 2 in this order (versions doc):

1. Tab reordering
2. Dragging notes out to File Explorer
3. Dragging images from websites

Nothing else is cut without asking Krishna.

Motion has its own cut order (Features 8). A cut animation becomes an instant change:

1. The new-letter fade, the find pulse and the checkbox tick drawing
2. The caret glide and the selection fade
3. The sliding highlight on the tiles
4. The pin, sort and drag glides in the note list
5. The heading and callout fold animation
6. The pane slide

Never cut (Features 8): typing never delayed, undo and redo never animated, interruptible animations, nothing blocking input, the speeds and curves list, and Reduced motion.

---

## Governance documents

| Document | Purpose | Updated when |
|---|---|---|
| `ARCHITECTURE.md` | Processes, layers, source layout, 25 rejection rules, security, Open before M1 | Before breaking any rule, and when an open item is decided |
| `SYSTEM.md` | Conventions, patterns, NEVER DO list, session template | When a convention is added or a recurring mistake is found |
| `SCHEMA.md` | Note syntax, frontmatter, `.wrriter` and app data formats, the sample-note checklist | When any stored format or note syntax changes, with Krishna's review |
| `PERFORMANCE.md` | The budget, the harness, mitigations, the pre-ship checklist | After each milestone's measurements. A number changes only by Krishna's decision |
| `DEPENDENCIES.md` | Approved, pending and banned libraries | When a dependency is added or a pending item is decided |
| `DONE.md` | Definition of done | Consulted before closing any feature |
| `UTILITIES.md` | Registry of reusable code | When anything reusable is created |
| `CHANGELOG_INTERNAL.md` | Session-by-session log | After every coding session |
| `docs/decisions/` | ADRs (ADR-W01 onwards) | Before a new pattern, library or structural change |
| Features 1 to 9 | What the app does | When Krishna decides a change |
| Versions doc | Each version's job, contents and feasibility | When Krishna decides a change. It wins over the Feature map on which version a feature belongs to |
| UI hand-off and UI reference | How the app looks and moves | When Krishna decides a change. They win over Features 1 to 9 on looks |
| This file | The milestone list and its tasks | When Krishna approves the list or a change to it, and its ticks after each milestone report |

---

## Phase summary

| Phase | What you can do at the end | Key deliverables | Gate |
|---|---|---|---|
| Setup | Nothing runs yet | Governance validated, the open items that block M1 answered, this list approved | Krishna approves the list |
| M1 | Open vaults and browse folders and notes | Day-one checks, window check, harness, tokens and motion foundations, `SafeWriter`, the jobs list, vaults, window shell and panes | Report, Krishna says go |
| M2 | Write | Round-trip check, editor, elements, handles and folding, menus and slash menu, find and replace, tabs, palette, settings | Report, Krishna says go |
| M3 | Write, link and find. **First real try** | Index, properties, tags, wikilinks, backlinks, link jobs, search, quick switcher | Report, Krishna says go |
| M4 | Capture from any app and drop files in. **Move over for good** | Tray, hotkey, quick capture, pop-out, attachments, all drag and drop, import | Report, Krishna says go |
| M5 | Install it and use it as your only notes app | Installer, licence, README, speed report, 8-hour test, motion polish | **Version 1 done** |
