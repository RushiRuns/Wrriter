# Wrriter versions: what each one is for and what is feasible

Oct 25, 2026 · @Krishna

This doc says what each version of Wrriter must accomplish, what goes into it, and how feasible each part is. The Features docs and the UI hand-off still say how every feature works. Where this doc and the Feature map by version disagree about which version a feature belongs to, this doc wins. The Not planned lists in the Feature map by version stay as they are, with the changes listed in the last sections here.

## How a feature gets into a version

Every feature passes two tests, in this order.

1. **The job test.** Each version has one job, written as a sentence, and a test you can run yourself. A feature is in a version only if that version cannot do its job without it, or if it is cheap and sits naturally beside something that is.
2. **The feasibility test.** Can it be built and proven with the tools already decided (Electron, TipTap, SQLite, plain markdown files)? Each part gets one of three ratings.

| Rating | What it means | What happens |
| --- | --- | --- |
| Proven | A standard technique. Normal testing is enough. | Built in its normal place in the order |
| Check first | It should work, but one named check must pass before more is built on it. A fallback is written down. | The check runs first and its result is reported to Krishna in plain words |
| Risky | It could fail, or cost far more than it looks. | Work stops at a gate. Krishna decides before anything is built on it |

**Rules**

- Feasible means "can it be built and proven". It does not mean how long it takes. No dates have been set, so none are given.
- A version is finished when its Done when list passes and you have used it. The next version does not start before that.
- A feature that fails its check moves to a later version or is changed by Krishna's decision. It is never quietly built weaker.
- Risky work that everything else stands on goes first (Version 1). Risky work that nothing else needs goes last in its version, so a failure holds nothing back (Version 2).
- Fallbacks marked (proposed) are mine. Every other fallback is already decided in the Features docs.

## The versions at a glance

| Version | The one job | The biggest risk |
| --- | --- | --- |
| 1 Daily driver | You move fully to Wrriter and stop using Obsidian | Keeping notes byte for byte, the frameless window, speed on 50,000 notes |
| 2 Your day and your data | Wrriter runs your day (journal, reminders, folder views, previews) and protects your notes (backup, conflicts, encryption) | Encryption touches almost every other part |
| 3 Connections and own sync | You see how your notes connect, and no longer need another tool to sync them | Wrriter's own sync |
| Later | Parked, with no version yet | Not rated |

## Version 1: Daily driver

### What it must accomplish

You move fully to Wrriter (decided Oct 2026). Everything you do with notes in a day has to work: write, catch a thought from any app, file it, link it, find it, drop files into it. It has to do this on up to 50,000 notes, without ever damaging one, and it has to look and feel like the Editor view mockup.

You can try it for real at two points. At the end of M3 you can write, link and find. The quick capture you left Obsidian for arrives at the end of M4, so moving over for good waits for M4.

### What is in

This follows the five milestones in Features 7 and the build slices in the UI hand-off (section 15). Antigravity still sends you the full list, with every Version 1 feature assigned to a milestone, for your approval before M1 starts. This table is the guide for that list.

| Milestone | Main parts |
| --- | --- |
| M1 Vaults and files | Day-one checks of the search library and the file watcher, the benchmark harness, open a folder as a vault, first-run screen, several vaults, folder tree, note list, safe file writing, outside changes picked up, the pending jobs list, motion foundations, the token list and build checks, the frameless window with its toolbar and drawn window buttons, the first pane and notes pane |
| M2 Editor and window | The TipTap editor, autosave, titles and renaming, find and replace in a note, collapsible headings, block dragging (headings by their fold arrow), slash menu, floating toolbar, images (resize, left, centre, right), callouts, tables, task lists, the rich text looks from the hand-off, tabs strip, back and forward, command palette, settings (theme, five accents, motion, note margin, background and start with Windows), English spell check, the sample-note check |
| M3 Index and search | The 50,000-note index in its own worker, the five properties, nested tags with rename, wikilinks, backlinks, links kept on rename and move, vault search with filters, quick switcher, the Tags tile and list |
| M4 Capture and files | Tray, global hotkey (Ctrl+Alt+N), quick capture window, pop-out windows, Inbox, Quick Note Start menu shortcut, one running copy, all drag and drop, attachments and file chips, pasted screenshots, import of notes and folders, the main window destroyed when closed to the tray |
| M5 Finish | Installer, Open with Wrriter, MIT licence and README, the shortcut list in settings, the speed report, the 8-hour memory test, the motion polish pass |

### Feasibility

| Part of Version 1 | Rating | Why | The check | If it fails |
| --- | --- | --- | --- | --- |
| Existing notes kept byte for byte | Risky | Every block must keep its original text and only edited blocks are rewritten. That is custom work on top of TipTap, and Features 2 calls it the biggest technical risk | The sample-note check in M2, run on every build | Antigravity stops and tells Krishna (decided) |
| The search library inside the installed app | Check first | better-sqlite3 has to run inside the packaged app on Windows, in the main process and in a worker | Day-one check in M1 | Stop and tell Krishna before choosing another library |
| The file watcher on 50,000 files at once | Check first | Windows can report that it lost track of changes | Day-one check in M1 | Full rescan comparing modified time and size (Features 6) |
| The frameless window with drawn buttons and 16 px corners | Risky | Electron's documents say corner rounding on a frameless window has no effect before Windows 11 build 22000, so Windows 10 gets square corners. A transparent window can have any corner, but it cannot be resized and cannot be maximised by double-click or the system menu. On Windows 11 the system rounds the corners itself, so matching the mockup's 16 px is not guaranteed. The snap layouts flyout is lost either way (the hand-off already says so) | The M1 window check on Windows 10 and 11: dragging, double-click to maximise, Win+arrows, edge snap, resizing from every edge, corners when maximised | See Question 1. Two fallbacks: accept Windows' own corners, or go back to native buttons with Electron's title bar overlay, the original rule in Features 1 |
| Speed on 50,000 notes and in a 1 MB note | Check first | The numbers in Features 9 are starting values. Rename, move and import times depend on the disk | The benchmark harness in M1. The quick set fails the build when a result is 20% worse | Antigravity reports the miss, its cause and the options. It never loosens a number alone |
| Twelve tabs without twelve live editors | Check first | TipTap must let a hidden tab keep its text, cursor and undo history without a drawn editor | Antigravity checks and tells Krishna | The three newest tabs keep editors and older tabs lose undo history while hidden (Features 9) |
| Changing many notes safely (rename with 5,000 links, move a folder, rename a tag) | Check first | Every file is flushed to disk and several are written at once, and a stop at any moment must leave nothing half done | The random-stop test, 100 times for each job (Features 7) | The job design is fixed before M3 counts as done |
| Quick capture in under 300 ms from the tray | Check first | An Electron app starts slower than Notepad | Two approaches measured in M4 (Features 3) | Krishna picks one |
| Dragging text and images from websites | Check first | Chrome, Edge and Firefox hand over different things | Tested in all three in M4 | An image that cannot be downloaded becomes a link. No source address in Version 1 |
| The look and motion of the mockup on five accents in two themes | Proven, but large | Automated checks hold the rules: the token check, the contrast check, and motion timings from one list | Build checks on every build | Motion has its own cut order (Features 8) |
| Everything else: folders, note list, tabs, tags, wikilinks, backlinks, find and replace, settings, tray, hotkey, installer | Proven | Standard techniques, covered by the Done when lists in Features 1 to 6 | Normal testing | None needed |

Version 1 is the largest of the three. That is deliberate: all drag and drop and the second window had to be in it, and you are moving over fully. What keeps it feasible is the order, not a smaller list. The risky checks run on day one of M1, each milestone ends with a report of measured numbers, and the cut list below says what goes first.

### Still open before some slices can start

Five decisions in the UI hand-off (section 14) are still waiting for you: how highlights and coloured text are saved, the pull quote and blockquote, how a tag gets its colour, the Archive and Trash tiles with the menu items that depend on them, and where the saved state and word count live. This doc does not answer them. Antigravity does not build the part each one affects until you answer.

### If time runs short

Features move to Version 2 in this order: tab reordering, dragging notes out to Explorer, dragging images from websites. Auto-hiding bars were first on this list, but the UI hand-off removed them, so they are gone from it. Nothing else is cut without asking Krishna. Motion has its own cut order (Features 8).

### Done when

- [ ] The day-one checks of the search library and the file watcher, and the window check on Windows 10 and 11, were each reported to Krishna in plain words
- [ ] Each of M1 to M5 ended with a report, and Krishna said go before the next one started
- [ ] Every Done when check of the Version 1 features in Features 1 to 9 and the UI hand-off passes
- [ ] The sample-note check passes on every build
- [ ] The speed report shows every budget row as pass or miss, each miss has its cause and a first fix, and no number was loosened without Krishna
- [ ] An existing folder of notes opens as a vault and nothing in it changes until a note is edited
- [ ] The installer works on a clean Windows 10 and a clean Windows 11 without administrator rights
- [ ] Krishna uses Wrriter as his only notes app

## Version 2: Your day and your data

### What it must accomplish

After Version 2, nothing you keep is out of reach or at risk. Your day has a place (a journal and reminders). Your folders can be viewed the way that fits them. Your files open without leaving Wrriter. Your notes are backed up, protected from clashes between two devices, and lockable when you choose.

### What is in

**Your day**

- Journal tile with one note per day and a calendar
- Templates
- A reminder on a note, Windows notifications while Wrriter runs, and the missed reminders list

**Folders and files**

- Folder views: list, table, gallery and wall
- Larger image view, PDF preview inside a note, audio and video players
- PDFs listed in folders, and a dropped PDF copied as a file
- Table of contents, split tab, cover image

**Your data**

- Automatic backup (zip, daily or weekly, keeps 10)
- The conflict screen with two buttons
- Encryption for chosen notes and folders (one password per vault)

### Build order inside Version 2

Each step ends with a report, as in Version 1.

1. **Safety net:** automatic backup and the conflict screen. Both are small and protect your data from the first day of use.
2. **Your day:** templates, journal and calendar, reminders and the missed list.
3. **Folders and files:** folder views, larger image view, PDF preview, audio and video, PDFs in folders, table of contents, split tab, cover.
4. **Encryption.** It goes last because it is the only Risky part, and nothing else in Version 2 needs it. Each earlier feature is already written to cope with it (previews decrypt in memory, backups carry the encrypted file as it is, reminders are not allowed on encrypted notes).

### Feasibility

| Part of Version 2 | Rating | Why | The check | If it fails |
| --- | --- | --- | --- | --- |
| Automatic backup | Proven | A zip written as a stream at low priority | 50,000 notes backed up while typing stays smooth | None needed |
| The conflict screen | Check first | It depends on what Syncthing really writes next to a conflicted note, and Features 6 says to test that before building | A real conflict between two copies of a vault | Ask once which device made a version and remember the answer (decided) |
| Templates, journal, calendar, table of contents, cover | Proven | The index already holds what the calendar and the cover need | Normal testing | None needed |
| Split tab | Proven | It reuses the same-note sync between windows that pop-out windows prove in Version 1 | Same note on both sides stays in step | None needed |
| Reminders while Wrriter runs | Check first | Windows notifications need the installer to register the app with Windows, and sleep, wake and Do not disturb change what shows | A reminder one minute ahead, one that comes due in sleep, on clean Windows 10 and 11 | The missed reminders list catches a hidden notification (decided) |
| List, table and gallery views | Proven | Rows are drawn only when on screen and data comes from the index in pages | Scroll test on 50,000 notes | None needed |
| Wall view | Check first | Card heights must come from what the index holds, without opening notes, and it still has to scroll smoothly on 50,000 | Scroll test on 50,000 notes | Wall moves to a later version and the other three views ship (proposed) |
| Image viewer, PDF preview, audio and video | Check first | The PDF viewer is bundled and runs in its own worker. Which audio and video formats play depends on Electron | Antigravity tests mp3, wav, m4a, ogg, mp4, webm and mov and reports | A format that cannot play stays as a chip that opens in Windows' default app (decided) |
| PDFs listed in folders | Proven | The list is built from file names only | A folder of 50,000 notes with PDFs still scrolls smoothly | None needed |
| Encryption | Risky | The maths is standard (Node's built-in crypto), so the risk is not the algorithm. The risk is the plumbing: locking touches search, the index, jobs, previews, backups, conflicts and dragging out, and no readable copy may exist anywhere on disk. A forgotten password cannot be recovered | The file format written and approved first. A scan of the vault and the app data folder that finds no readable text of an encrypted note. The random-stop test while encrypting 5,000 notes | Antigravity stops and Krishna decides. The rest of Version 2 does not wait for it |

### If time runs short

Features move to Version 3 in this order: split tab, table of contents, cover, Wall view, audio and video players. Nothing else is cut without asking Krishna. Encryption is not on this list: if its gate fails, you decide.

### Done when

- [ ] Each of the four steps ended with a report, and Krishna said go before the next one started
- [ ] A backup appears on schedule, only the 10 newest are kept, and the conflict screen resolves a real Syncthing conflict, with neither freezing typing
- [ ] Today's journal note opens, the calendar is instant on a year of notes, and a reminder shows a Windows notification that opens the note
- [ ] A folder switches between list, table, gallery and wall, and the choice is remembered. Table and wall scroll smoothly on 50,000 notes
- [ ] A PDF previews inside a note, and an mp3 and an mp4 play, or the formats that cannot play open in the default Windows app
- [ ] A scan of the vault and the app data folder finds no readable text of an encrypted note
- [ ] Every new feature has its row in the budget table of Features 9, and passes or has a reported miss

## Version 3: Connections and own sync

### What it must accomplish

You see how your notes connect, and you no longer need another tool to keep your devices in step. Version 3 is the smallest in daily value and the heaviest in one part, so its order protects the small parts from the heavy one.

### What is in

- Notes graph, for one note and for the whole vault
- Restore from a backup into a new vault
- Find unused attachments command
- Waking Wrriter through Windows Task Scheduler so reminders fire while it is closed (decided after living with Version 2)
- Wrriter's own sync over your home network, replacing Syncthing

### Build order inside Version 3

1. Restore from backup and Find unused attachments (small and proven)
2. Notes graph
3. Waking Wrriter for reminders, only if you still want it after living with Version 2
4. Own sync, last, and only after its design doc is approved

### Feasibility

| Part of Version 3 | Rating | Why | The check | If it fails |
| --- | --- | --- | --- | --- |
| Restore from backup | Proven | It unpacks into a new vault and never writes into an existing one | The original vault is unchanged | None needed |
| Find unused attachments | Proven | It only lists. Nothing is removed automatically | Normal testing | None needed |
| Notes graph | Check first | 50,000 dots must be drawn on the graphics card, with positions worked out in a worker. A rough picture appears first and settles | Time to the first picture and smooth panning, reported on 50,000 notes | This note and the filtered vault view ship first, and the full vault graph follows (proposed) |
| Waking Wrriter for reminders | Proven, with a stated limit | Task Scheduler for the signed-in user needs no administrator rights. Wrriter can only schedule reminders it has seen on this PC | Deleting a reminder or uninstalling removes its tasks | You decide after living with Version 2 (decided) |
| Wrriter's own sync | Risky | It is a project of its own: finding devices, pairing, protecting the traffic, deletes, a first sync of 50,000 notes, and conflicts. Pairing and traffic protection are not decided yet. Android is out for now, so the second device would be another Windows PC, which Syncthing already serves | A design doc you approve, and a fresh yes or no on whether it is still wanted | Stay on Syncthing. Nothing in Version 1 or 2 depends on it: the vault id, Windows-safe names and a separate conflict screen are already prepared |

### Done when

- [ ] The graph of a generated 50,000-note vault opens, shows progress while it is arranged, and pans smoothly
- [ ] Restore from backup creates a separate vault and leaves the original untouched
- [ ] Find unused attachments lists files and removes nothing by itself
- [ ] You have said yes or no to waking Wrriter for reminders, and if yes, a reminder fires with Wrriter fully closed
- [ ] You have approved the own sync design doc or decided to stay on Syncthing. If it is built, two PCs on one network stay in step with no internet

## Later, with no version yet

- Columns, the two layout elements (media object, and media object with a pocket below), the fourth element that is not yet named, and images inside columns. You set these aside on Oct 22 and plan to add them sooner or later
- The Android app (forgotten for now)
- Share is dropped, and Export as is left out until a later version
- Everything in the Put off list of the Feature map by version, unchanged

Flexible images stay planned. Version 1 has resizing and left, centre and right on their own line. Text wrapping around an image is Question 2.

## What changes compared with the Feature map by version

- Window buttons are drawn by Wrriter and the window is frameless. Tabs are in a strip at the bottom of the editor. There are no auto-hiding bars and no bottom status bar
- Five accents instead of two, with yellow as the default
- Six icon tiles, three to a row, instead of three
- Columns, layout elements and images inside columns move from Version 2 to Later
- Share is dropped, the Android app is forgotten for now, and the table view has no date column
- The Version 1 cut list no longer starts with auto-hiding bars
- Version 3 own sync is now behind a design doc and a fresh yes or no

## Calls made in this doc

Where you had not given an answer, I made the call. Tell me the number if you want one changed.

| # | Call | Why | Source |
| --- | --- | --- | --- |
| 1 | The three versions stay as the Feature map by version set them. This doc adds each one's job, test and feasibility | You approved those phases on Oct 17 | My call |
| 2 | Feasible means "can it be built and proven", with no time estimates | No dates or pace have been set | My call |
| 3 | Risky foundations go first in Version 1, and the risky part of Version 2 goes last | A foundation blocks everything above it. Encryption blocks nothing | My call |
| 4 | Version 2 is built in four steps: safety net, your day, folders and files, encryption | Small protective parts first, the Risky part last | My call |
| 5 | If Version 2 runs short, features move out in this order: split tab, table of contents, cover, Wall view, audio and video players | They are the furthest from the version's job | My call |
| 6 | The Version 1 cut list loses auto-hiding bars | The UI hand-off removed them (section 1, row 3) | Follows your mockup |
| 7 | Own sync stays in Version 3 but starts only with an approved design doc and a fresh yes or no | You forgot the Android app for now, which removes the main reason for it | My call |
| 8 | The version names are working names | They only make the doc easier to talk about | My call |

## Questions waiting for you

Say the number and yes to take my recommendation.

| # | Question | Recommendation | Affects |
| --- | --- | --- | --- |
| 1 | If the M1 window check shows that Windows 10 cannot have the 16 px corners and also resize and maximise properly, which wins? | Resizing, maximising and snapping win. Wrriter uses Windows' own corners, which are square on Windows 10 | The M1 window shell |
| 2 | Should text wrapping around an image stay in Version 2, as the Feature map by version had it, or be parked with columns? | Keep it in Version 2. It does not need columns. Only images inside columns are parked | Version 2, Later |
| 3 | In which version does the repository first go public for other people to use? | Version 1, after M5, because the licence, README and installer are all in M5 | Version 1 end |

## Sources

- Electron documentation, base window options (rounded corners and transparent windows on Windows): https://electronjs.org/docs/latest/api/structures/base-window-options
- Electron documentation, frameless window (limits of transparent windows, the title bar overlay): https://electronjs.org/de/docs/latest/api/frameless-window
