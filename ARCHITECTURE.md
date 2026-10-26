# Wrriter - Architecture Rules

> This file is law, not suggestion.
> Every prompt to Antigravity must include or reference the relevant section here, plus SYSTEM.md.
> A feature that violates these rules does not ship. It goes back for a redesign.
>
> This file answers: what are the processes and layers, who may talk to whom, what lives where.
> SYSTEM.md answers: how code is written day to day, and what is never done.
>
> What the app does is in Features 1 to 9 and the versions doc. How it looks and moves is in the UI hand-off and the UI reference. This file does not repeat them. If this file and those docs disagree about behaviour or looks, those docs win and this file is fixed. If they disagree about structure, Antigravity stops and tells Krishna.

---

## Build Phase

**Version 1, Daily driver (current target): milestones M1 to M5.**
- 64-bit Windows 10 and 11, English only. Electron, React, TypeScript, Vite. One TipTap editor. A SQLite search index (better-sqlite3, FTS5) running in a worker.
- Notes are plain markdown files in a vault folder. The disk is the source of truth. Everything else Wrriter keeps is either small vault metadata, settings on this PC, or a cache that can be deleted and rebuilt.
- Fully offline. No accounts, no analytics, no crash reports, no update check, no network connection that Wrriter starts by itself.
- Syncthing syncs vaults for now. Wrriter works well beside it and never installs, starts or controls it.
- Milestones come from Features 7 and the versions doc. Each ends with a report of what works, what does not and the measured numbers, and the next one starts only when Krishna says go.

**Version 2, Your day and your data:** templates, journal and calendar, reminders while Wrriter runs, folder views, previews, automatic backup, the conflict screen, and encryption last.

**Version 3, Connections and own sync:** notes graph, restore from backup, find unused attachments, the Task Scheduler wake-up if still wanted, and own LAN sync only after Krishna approves its design doc and gives a fresh yes.

Nothing from Version 2 or 3 is built before M5 is done. Nothing on the Later list (columns, layout elements, the unnamed fourth element, the Android app) is built at all. Version 1 code must not make Version 2 or 3 harder, and the places where that matters are written into this file (encryption-ready jobs list, conflict provider shape, vault id, Windows-safe names). Nothing is built for them early.

Nothing in the Wrriter codebase depends on a cloud provider, an online account, an analytics or crash SDK, an auto-updater, or an AI API.

---

## Stack (locked)

| Concern | Choice | Decided in |
|---|---|---|
| Shell | Electron, latest stable at scaffold time | Features 6 |
| Language | TypeScript, strict mode | Features 6 |
| UI | React | Features 6 |
| Bundler | Vite. The interface is split into pieces that load on demand, the main process is bundled into one file, V8 code caching is used for both | Features 6, 9 |
| Editor | TipTap. One live markdown editor, no source mode | Features 2, 7 |
| Search index | SQLite with FTS5 through better-sqlite3, in the index worker only | Features 4, 9 |
| Packaging | electron-builder, NSIS installer, current user only, no administrator rights | Features 6 |
| Fonts | Inter, bundled. Code uses Cascadia Code, then Cascadia Mono, then Consolas | Features 1, UI hand-off |
| Look | Tokens ported from the UI reference style code. Light, dark and follow Windows (default). Five accents, yellow by default | UI hand-off |
| Motion | Four speeds and three curves from Features 8. CSS transitions and the Web Animations API only | Features 8 |
| Encryption (Version 2) | Node's built-in crypto: scrypt and AES-256-GCM | Features 6 |
| PDF viewer (Version 2) | PDF.js, bundled, in its own worker | Features 5, 9 |
| Code editor tool | Antigravity | |

**Pending, not locked.** Each is decided by a check or by Krishna and recorded as an ADR before any code depends on it: the file watcher library (day-one check), the worker type for the index and job workers (day-one check), the renderer state library, the markdown and frontmatter parsers, and the test tools. See DEPENDENCIES.md.

**Application ID placeholder:** `app.wrriter`. Windows uses it for notifications, the taskbar and the Start menu shortcuts. Krishna confirms it before the first installer anyone keeps, because changing it later breaks pinned shortcuts and notification settings.

---

## Processes

Electron runs Wrriter as separate processes. Each one has one job.

| Process | Job | Vault files | Search index |
|---|---|---|---|
| Main | App lifecycle, windows, tray, global hotkey, single running copy, routing requests, small file operations | Yes, through `SafeWriter` and `VaultReader` only, asynchronous calls only | Never |
| Index worker | Builds and answers the SQLite index, keeps the in-memory list of titles | Reads only, to index | The only process that touches it |
| Job worker | Runs pending jobs one at a time: link updates, folder moves, tag renames, imports, and in Version 2 encrypting or decrypting a folder | Yes, through `SafeWriter` | Never. It sends index updates to the index worker |
| Windows | The main window, the quick capture window, pop-out windows, the settings window. They draw the interface and host the editor | Never | Never directly. Read queries go through the channel the main process hands them |

- The main process starts both workers. It hands each window a channel to the index worker that accepts only the fixed list of index read requests in `src/shared/ipc`.
- A window asks for everything else (save, rename, move, pin, open a file, show in File Explorer) through the preload bridge, which exposes the same fixed request list and nothing else.
- Which worker performs an autosave write is open. Features 9 says the write goes through the main process to a worker, and it must never wait behind a long job. Antigravity proposes it in M1 and records it as an ADR.
- The index worker may shut down when idle in the tray and start again when needed. Antigravity measures memory saved against start time and Krishna chooses (Features 9).

---

## Source Layout

One package. Folders are the boundaries, and build checks hold them. More packages add build overhead and slow the AI editor down with no benefit at this size.

```
src/
  shared/                 Pure TypeScript. Its own tsconfig has no DOM library and no Node types,
                          so a DOM, Node or Electron import does not compile here
    domain/               Pure functions: names, titles, frontmatter, wikilinks, links, tags,
                          ordering, search filters, job plans, conflict names, dates
    markdown/             Block splitter and byte-preserving serializer
    ipc/                  The fixed request list: names, argument validators, result types.
                          The only contract between processes
    result.ts             Result and AppError
  main/
    index.ts              Electron entry. Does almost nothing before the first window (see Startup)
    app/                  Lifecycle, single running copy, tray, hotkey, start with Windows
    windows/              Window factory, the frameless shell, saved window state
    ipc/                  Request router: checks the sender and the arguments, calls one service
    services/             One per domain: vault, note, folder, tag, link, attachment, import,
                          capture, job, search, settings
    store/                SafeWriter, VaultReader, file watcher adapter, app data store, jobs store
    platform/             Thin adapters over Electron and Windows: shell, Recycle Bin, app protocol,
                          spell check, drag out, notifications (V2)
  workers/
    index/                Index worker: schema, indexer, queries, the title list
    jobs/                 Job worker: the job runner
  preload/
    index.ts              contextBridge. Exposes window.wrriter with the fixed request list only
  renderer/
    windows/              One entry per window kind: main, capture, settings
    features/             One folder per feature: view, controller, state
    editor/               TipTap setup, nodes and marks, handles, slash menu, floating toolbar
    components/           Shared components with no state of their own
    styles/               tokens.css (ported from the UI reference) and base styles
    motion/               Helpers that read motion values from the tokens
tests/
  samples/                Hand-made sample notes for the round-trip check (Features 2)
  vault-gen/              The 50,000-note test vault generator (Features 9)
  bench/                  Benchmark harness and the stored baseline
docs/
  decisions/              ADR-W*.md
  encrypted-format.md     Version 2
```

If `shared/` needs Node, Electron or the DOM, the design is wrong. Move that part to `main/`, `workers/` or `renderer/` behind an interface defined in `shared/`.

---

## Layer Order

Strict. No layer may be skipped. No direction may be reversed.

```
UI (React components, one tree per window)
  |  props down, events up
Window controllers (feature hooks and state in the renderer)
  |  calls window.wrriter only
Preload bridge (the fixed request list, nothing else)
  |  IPC requests, and the index channel for reads
Main services (one per domain)        Workers (index, jobs)
  |  both call
Domain (src/shared: no I/O, no Node, no DOM, no clock reads, no randomness)
  |
Stores (SafeWriter, VaultReader, watcher, app data store, jobs store, index database)
  -> disk and SQLite
```

**What this means in practice:**

- A component never calls `window.wrriter`, never imports from `main/`, `workers/` or `preload/`, and never holds note text. It receives state and emits events through its controller. It may import types and pure display helpers from `shared/`.
- A controller sends writes through `window.wrriter` and gets reads from index queries and main process events. It contains no business rules. Note text lives inside the editor and is never copied into React state (Features 9).
- The preload bridge exposes only the request list in `shared/ipc`. No raw `ipcRenderer`, no Node, no `fs`, no `shell`.
- A main service may call other services. It never reaches into another service's store.
- Stores do not call other stores. Work that spans stores happens in the service that owns the use case.
- Domain functions are pure: input in, output out. Time, IDs and randomness come in as parameters (`Clock`, `IdGenerator`).
- Only `SafeWriter` writes vault files. Only the index database code touches SQLite, and only inside the index worker. Only the jobs store writes the pending jobs list.

---

## Data Flow and State

- **The vault on disk is the single source of truth.** The search index, the saved first-paint state and, in Version 3, the graph positions are caches. Any of them can be deleted and rebuilt with nothing lost. No note content lives only in the index (Features 4).
- **Note text lives in the editor** while a note is open. It is never copied into React state or a store. The interface reads only what it needs, such as the counts and the saved state (Features 9).
- **Lists come from the index**, a page at a time, with a "continue after this row" query, never a growing offset. Rows are virtualised. Nothing reads note files while a list is drawn or scrolled (Features 1, 9).
- **One answer, one place.** If the index or the disk can answer something, no renderer state keeps a copy that can disagree with it.
- Window-only state (a menu open, the find box text, scroll position, fold state) stays in the window. Fold state is never written to disk (Features 2).
- Settings and window state live in the app data folder. Pins, manual order and folder view choices live in the vault's `.wrriter` folder (Features 1, 6).

### Write path: one note

```
key press -> TipTap (the letter lands on the same frame)
  -> typing pauses, or the note is left, the tab or window closes, or Wrriter quits
  -> only the edited blocks are turned back into markdown (shared/markdown)
  -> byte comparison with the file on disk
       same bytes: nothing is written
       different: window.wrriter request -> main checks it -> worker -> SafeWriter
         temp file beside the note (leading dot), flush to disk, rename over the note,
         line endings and byte order mark kept, the write remembered so the watcher ignores it
  -> index updated -> the saved state shows Saved
```

- A write that Windows refuses (another app holds the file) keeps the text in the editor, shows a notice and retries. Text is never thrown away (Features 6).
- The file name follows the title only when the note is left, never while typing (Features 2).

### Write path: many notes (the pending jobs list)

```
user action: rename a note with links, move or rename a folder, rename a tag, import,
             (Version 2) encrypt or decrypt a folder
  -> the service builds a job plan in shared/domain: what changes and which files
  -> the plan is written to the pending jobs list (app data, one file per vault, safe write)
     BEFORE the first file is touched
  -> the job worker runs it: about 4 to 8 files at a time, each through SafeWriter with its flush,
     ticks saved in batches of about 100
  -> the index is updated once per batch, progress is sent a few times a second
  -> if Wrriter ends halfway, the job is finished at the next start, never undone.
     A change already made is skipped
```

- Link updates, tag renames and folder moves have no cancel button. Imports keep theirs (Features 7).
- Jobs run one at a time, in the order they were started.
- A link update reads a note, replaces only the link text, and writes it back. It never loads the editor or reformats anything (Features 9).

### Outside changes

- The file watcher joins events that arrive together into one batch and ignores Wrriter's own writes for a short moment. If Windows reports lost events, a full rescan by modified time and size runs (Features 6, 9).
- An open note with no unsaved typing reloads quietly and keeps the cursor. With unsaved typing, the typed text is kept and the outside version is saved as a separate copy next to the note (Features 2).

### Undo

Undo history belongs to each note and lives in the editor while the tab is open. Replace all and a block move are each one step. Undo and redo are never animated. Undo never reaches across notes or into jobs.

---

## Threading and Blocking

- The main process is never blocked for more than 50 ms, in any case in the budget.
- No synchronous file call (`readFileSync`, `writeFileSync` and the rest) in the main process after startup. A lint rule fails the build on one.
- better-sqlite3 is synchronous, so it runs only in the index worker. Never in the main process, never in a window.
- A key press does the least work possible. Nothing outside the editor redraws on a key press except the saved state and the counts, at most once per frame.
- Anything that can take longer than a few milliseconds runs in a worker: indexing, jobs, imports, and later backup, encryption and scrypt, PDF rendering and graph layout.
- Progress messages are sent at most a few times per second. The numbers on screen may lag a little, the work does not.
- While idle in the tray nothing runs except the timer for the next reminder (Version 2). No polling, no rendering, no animation in a hidden window.
- Processes exchange plain data only, through the request list.

---

## Startup

The first frame must not wait for anything optional.

- Before the first window: take the single-instance lock, read settings, create the window hidden with the chosen theme's background colour. Nothing else.
- The window is shown only when its first frame is ready, so there is no white flash. The right theme is applied before the first frame, with no fade (Features 1, 8).
- The first paint uses the saved state in the app data folder: open tabs, pane widths, the first page of the note list. It does not wait for the index, the file watcher, the settings window or the vault list.
- After the first paint, when idle: start the index worker and the file watcher, bring the list up to date, prepare the command palette so Ctrl+Shift+P is instant, finish interrupted jobs.
- Loaded only on first use: the settings window, rarely used editor parts such as extra code block languages, and in Version 2 the PDF viewer and other Version 2 features.
- Starting a second copy hands its request to the running one and does not start a second engine.
- Closing the main window to the tray destroys it. What stays alive: the main process, the tray, the hotkey, and the quick capture window as Krishna decides in Features 3. Opening from the tray builds the window again from saved state.

---

## Sync Readiness (summary)

Syncthing syncs vaults in Version 1 and 2. Wrriter's own LAN sync is Version 3 and starts only with an approved design doc. Version 1 keeps that door open with these rules:

1. Every vault has a vault id in `.wrriter`. It is how two devices know they hold the same vault.
2. Note and attachment names are valid on Windows, and Wrriter never creates two names that differ only by upper and lower case.
3. Notes refer to notes by name and to attachments by a path inside the vault, never by a path on this PC.
4. Nothing about sync is stored inside a note.
5. Changes to order and pins in `.wrriter` never open a conflict. The newer file wins.
6. The conflict screen (Version 2) is its own component: it takes two versions with a label and a time each and returns the choice. Finding conflicts is a separate sync provider that raises an event. Syncthing is the first provider.
7. Wrriter puts nothing noisy in the vault. The index, settings and jobs list live in the app data folder. The temp file of a safe save starts with a dot and exists for a moment only.
8. Folders whose names start with a dot (`.stfolder`, `.stversions`, `.obsidian`, `.git`) are never read, changed or shown.

---

## Platform Integration

Each of these is a thin adapter in `src/main/platform/` behind an interface, called from services. Services hold the logic. Adapters hold the Electron and Windows calls.

| Capability | Mechanism | Notes |
|---|---|---|
| Frameless window | A window without a system frame, three drawn round buttons, 16 px corners | Risky. The M1 window check on Windows 10 and 11 decides. Fallbacks are in the versions doc, Question 1 |
| Tray | Electron tray icon | Menu: New quick note, Open Wrriter, Quit |
| Global hotkey | Electron global shortcut | Ctrl+Alt+N by default, changeable without a restart, says plainly when the combination is taken |
| Single running copy | Electron single-instance lock | A second launch hands its arguments to the running copy |
| Start with Windows | Login item, started hidden | Off by default. Offered only while keep running in the background is on |
| Quick Note shortcut | Start menu shortcut made by the installer, with a start flag | Opens only the small window |
| Delete | Windows Recycle Bin through Electron's shell | The one exception is the plain original of a note being encrypted (Version 2) |
| Open in the default app, Show in File Explorer | Electron's shell | The path is checked to be inside an open vault first |
| Web links | Default browser through Electron's shell, after the address is checked | http and https only |
| Vault files shown in a window | One registered app protocol that serves files inside open vaults only | Never `file://` (Electron security checklist) |
| Drag a note out | Electron's start-drag with the .md file | Not for encrypted notes |
| Spell check | Electron's built-in spell checker, English | Suggestions on right-click |
| Theme and motion | Electron's native theme and the reduced-motion media query | Follow Windows by default |
| Open with Wrriter | Registered by the installer for .md files without becoming the default app | |
| Notifications (Version 2) | Electron notifications, with the app ID registered by the installer | |
| Task Scheduler (Version 3) | Tasks for the signed-in user | Removed on uninstall |

### Capabilities (complete list - anything else is a rejection)

- **Network:** none started by Wrriter. The only network code is the downloader for an image dragged in from a website, run in the main process at the moment of the drop (Features 5). Web links open in the default browser. No other request leaves the app.
- **Files:** the vault folders the user opened, the app data folder, the backup folder the user picks (Version 2), and files the user drops or imports. Nothing else.
- **Windows:** context isolation on, Node off, sandbox on, no remote content, navigation and new windows denied, a strict Content Security Policy.
- **Permission requests** from web content (camera, microphone, location and the rest) are all denied.
- **No administrator rights**, ever.

---

## UI Architecture

### The look comes from the hand-off, not from a library

- The look is the Editor view mockup. Antigravity matches it and does not reinterpret, tidy or improve it. Order of authority: the UI hand-off, then the UI reference, then the screenshots, then Features 1 to 9.
- No styled component kit. Components are built in this repo and styled from tokens only.
- Every icon comes from the UI reference as inline SVG, copied as given. No icon library.
- Anything the mockup does not draw (UI hand-off section 13) is built from the same tokens, icons, menu look and motion, and shown to Krishna before moving on.

### Tokens

- `src/renderer/styles/tokens.css` is the one token list, ported from the UI reference style code: colours for light and dark, the five accents, the type, space and size scales, the two radii, shadows, and the motion speeds and curves. Code that needs a value in script, such as a Web Animations call, reads it from the tokens through `renderer/motion/`.
- The app root carries `data-theme` and `data-accent`. Inside the note pane the accent is replaced by a grey, except callouts, tags and the colour set. That rule is never removed.
- If a token does not exist for something, ask Krishna. Once agreed, add it to the list first, then use it.
- Build checks fail on: a raw colour outside `tokens.css`, a spacing or font size not on the scales, a duration or curve not from the motion list, a contrast failure, and a long dash in the app's own text.

### Shell (summary)

- One frameless window with 16 px corners. A 40 px toolbar, always visible, across three panes: sidebar toggle, back and forward, the note name field, new note, the three window buttons.
- First pane 248 px: six tiles, three to a row (Archive and Trash wait on hand-off decision 4), folders, the vault button and the settings gear.
- Notes pane 320 px. The editor pane takes the rest.
- The note fills the editor pane with the Note margin setting each side (16 to 96 px, default 24), no width cap at any size, and a 360 px floor below which the pane scrolls sideways.
- Tabs sit in a 32 px strip along the bottom of the editor pane. There is no bottom status bar and there are no auto-hiding bars.
- The toolbar toggle hides the first pane. Ctrl+backslash hides both navigation panes.

### Motion rules

- Every animation uses one of the four speeds (0, 100, 180, 280 ms) and one of the three curves from Features 8. Nothing is longer than 300 ms. Things leave at about 70% of the time they took to arrive.
- Only transform and opacity animate, except the listed size changes (a folder opening, a fold, a row collapsing, a tab opening), which animate one container and never re-wrap the text inside it.
- Every animation can be interrupted and reverses from where it is: CSS transitions or the Web Animations API, never timed scripts.
- Typing is never delayed. Undo, redo, scrolling, dragging, resizing, opening a note, switching tabs and list results are never animated (Features 8, Never animated).
- Every animation site is listed in Features 8 or the UI hand-off section 9. A new site needs an ADR and Krishna's yes.
- Reduced motion (the Windows setting or the Motion setting) turns slides, scaling and glides into instant changes or plain fades. A hidden developer switch makes every duration five times longer for tuning.
- Nothing loops. Nothing animates while Wrriter is idle or a window is hidden.

### Keyboard, access and wording

- Every action reachable by mouse is reachable by keyboard and from the command palette. Shortcuts live in one list in code. Drag is never the only way (Alt+Up and Alt+Down move blocks).
- Every button has an accessible name and the focus ring from the UI hand-off: 2 px in the ink colour, 2 px away.
- Text greys meet 4.5:1, large text 3:1, icons and outlines 3:1, on every pane, in both themes, on all five accents.
- No long dashes in any text the app shows, including the installer, README and release notes. A note the user wrote is never changed. Sentence case, plain verbs, no filler. An error says what went wrong and what to do, and does not apologise (UI hand-off section 11).

---

## Security Rules

```
Follow Electron's security checklist for the Electron version in use, and check
it again on every Electron upgrade. In particular:
  context isolation on, Node integration off, sandbox on, in every window.
  No remote content in any window. Navigation and window.open are denied.
  Web links go to the default browser after the address is checked
  (http and https only).
  A strict Content Security Policy: scripts only from the app bundle.
  The sender of every IPC message and every argument is validated in the
  main process. A request that is not on the fixed list is rejected.
  Vault files reach a window only through the app protocol, never file://.
  Electron fuses that Wrriter does not use are turned off in release builds.
  Every permission request from web content is denied.

Every path that comes from a window is resolved in the main process and must
stay inside an open vault. A path that escapes is refused, not corrected.

Note content is never run. Raw HTML, script tags, Dataview and Templater blocks
show as text. Pasted or dropped web content is turned into markdown and is never
inserted as HTML.

Only the main process and the two workers read or write vault files. Windows
never touch files, the index or Node.

Encryption (Version 2): Node's crypto only, standard algorithms only, nothing
homemade. The vault key lives in memory only while unlocked and is wiped on lock.
scrypt runs in a worker. No readable copy of an encrypted note is ever written to
disk: not in a temp file, the index, a crash file, a preview or a backup. The
password is never stored. The encrypted file format is documented in the repo
with a version number.

Logs: problems only, in the app data folder. No note text in logs, and no names
of encrypted notes.

A dependency audit runs before every release. No dependency with a known high or
critical vulnerability ships.
```

---

## Formats and Data Rules

- Every format Wrriter owns has a version: the `.wrriter` files, the app data files, the pending jobs list, the index schema, and in Version 2 the encrypted note format. SCHEMA.md lists them.
- The index is a cache. A change to its layout bumps its version, and the old index is deleted and rebuilt. There are no index migrations.
- `.wrriter` and app data files: Wrriter reads older versions and upgrades them on its next write. A file written by a newer Wrriter is read where possible and never overwritten, because another device may run a newer version.
- A pending jobs list from an older version is finished, never dropped.
- Note files have no Wrriter format. They are the user's markdown. Wrriter owns only the frontmatter keys `tags`, `status`, `created`, `cover` and `remind`, and only the syntax listed in SCHEMA.md.
- A change to what Wrriter writes into a note (new syntax, a new frontmatter key) needs Krishna's yes, a SCHEMA.md entry and a new sample note in the round-trip check.
- No AI tool changes SCHEMA.md, a format version or the sample notes without Krishna reviewing it.

---

## Hard Rules - The Rejection List

If a proposed implementation violates any of these, it is rejected and redesigned before code is written.

 1. Components do not import from `main/`, `workers/` or `preload/`, do not call `window.wrriter`, and never hold note text in React state.
 2. Only `SafeWriter` writes vault files. Only the index database code touches SQLite, only in the index worker. Only the jobs store writes the pending jobs list.
 3. A vault file is written only when its bytes change. Opening a note never writes it.
 4. Every change that edits files the user did not type in (link updates, folder moves, tag renames, imports, encrypting a folder) is a job on the pending jobs list. No other multi-file write path exists.
 5. The round-trip check on the sample notes runs on every build and fails it. Only edited blocks are rewritten. If TipTap cannot keep a note intact, Antigravity stops and tells Krishna, and does not patch around it.
 6. Services and workers return a `Result`. Exceptions do not cross a process boundary or reach a component. Controllers turn failures into UI state.
 7. The disk is the source of truth. No renderer state mirrors what the index or the disk can answer.
 8. No new dependency without a written justification in DEPENDENCIES.md. Free and open source only.
 9. No new architectural pattern without an ADR in `docs/decisions/`.
10. Every format change gets a version bump, an upgrade path or a rebuild, and a test.
11. No feature ships without at least one test.
12. The interface contains zero business logic. Name rules, title rules, link rules, frontmatter edits and search filters live in `shared/domain`.
13. No cloud SDK, analytics, crash reporting, auto-updater, account system, AI client, or anything that needs a paid account or phones home.
14. No raw colour, spacing, font size, radius, duration or curve outside `tokens.css`.
15. Every animation site is listed in Features 8 or the UI hand-off section 9. A new one needs an ADR. Typing, undo and redo are never animated.
16. No styled component kit, no icon library, no animation library.
17. **Single writer for names.** Note and attachment file names come only from `shared/domain/names`, through `NoteService` and `AttachmentService`. Nothing else builds a file name.
18. **Single writer for frontmatter.** Only `shared/domain/frontmatter` edits the owned keys, and it leaves every other key, every comment and the key order untouched.
19. **Startup path purity.** Before the first frame: the single-instance lock, reading settings and the hidden themed window. Nothing else.
20. No synchronous file call in the main process after startup. No better-sqlite3 outside the index worker. The main process is never blocked for more than 50 ms.
21. No network code except the dropped-image downloader. No HTTP client library.
22. No clock read (`Date.now()`, `new Date()` without arguments) and no `Math.random()` inside `shared/`. Time and IDs are injected.
23. No long dash in any string the app shows.
24. Nothing from Version 2 or 3 before M5 is done. Nothing from the Later list at all.
25. A part that depends on an open decision (UI hand-off section 14, versions doc questions) is not built until Krishna answers.

---

## Decision Records

Significant decisions live in `docs/decisions/` as `ADR-W0NN-title.md`. Format:

```
ADR-W01: Electron, React, TypeScript and Vite
Status: Accepted
Context: ...
Decision: ...
Consequences: ...
```

When a prompt would introduce a new pattern, library or structural change: write the ADR first, then build.

Initial set, written at the start of M1: W01 Electron, React, TypeScript and Vite. W02 TipTap as the one editor, with the block-preserving serializer. W03 the SQLite FTS5 index in a worker as a rebuildable cache. W04 the disk as the source of truth. W05 SafeWriter and the pending jobs list. W06 the frameless window with drawn buttons (after the M1 window check). W07 no network, no telemetry, no auto-update. W08 tokens from the UI reference and the build checks. W09 the motion tokens and rules. W10 one app protocol for vault files. W11 the worker type (after the day-one check). W12 the file watcher (after the day-one check).

---

## Open Before M1

None of these is decided. Nothing that depends on one is built until it is.

| # | Open item | Decided by |
|---|---|---|
| 1 | Worker type for the index and job workers: utility process or worker thread | Day-one check, then ADR-W11 |
| 2 | File watcher library | Day-one check on 50,000 files, then ADR-W12 |
| 3 | Which worker writes autosaves, so a save never waits behind a job | Antigravity proposes in M1, Krishna approves |
| 4 | Renderer state library, markdown and frontmatter parsers, test tools | DEPENDENCIES.md, Krishna approves |
| 5 | Application ID | Krishna, before the first installer anyone keeps |
| 6 | The five decisions in UI hand-off section 14 | Krishna |
| 7 | The three questions in the versions doc | Krishna |
| 8 | The full milestone list with every Version 1 feature assigned | Antigravity sends it, Krishna approves before M1 starts |
