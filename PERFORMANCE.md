# Wrriter - Performance

> Performance is a precondition, not a feature.
> These targets are rejection criteria. A change that breaks one is redesigned before it ships.
> The source is Features 9. This file is the working copy Antigravity measures against. If the two ever differ, Features 9 wins and this file is fixed.

**Status of the numbers.** Every number below is a starting value from Features 9. None has been measured yet. M1 builds the benchmark harness right after the day-one check and records the first numbers on the reference machine. The numbers are tuned once with Krishna after that first measurement. From then on a number changes only by Krishna's decision. Antigravity never loosens one on its own: it reports the measured number, the cause and the options.

---

## Reference Machine and Test Setup

- One reference machine, written down in the repository: 64-bit Windows 11, a 4-core laptop CPU of the i5 class, 8 GB of RAM and an SSD. Antigravity reports the exact machine it used.
  - **Exact Machine:**
    - **OS:** 64-bit Windows 11 Home Single Language, Version 10.0.26200
    - **CPU:** AMD Ryzen 5 5600H with Radeon Graphics (6 cores, 12 logical processors, 3.30 GHz base / 4.20 GHz boost, mobile i5-equivalent)
    - **RAM:** 8 GB DDR4 (7.35 GB usable)
    - **Primary Disk:** INTEL SSDPEKNW512G8H (512 GB NVMe SSD)
- A second run on a slow disk (a hard drive or a throttled disk) is reported next to it, because that is where bad file handling shows.
- Windows Defender real-time protection stays on for every measurement. A run with it off may be added for comparison only.
- Always the packaged installer build, never the dev build. A dev build of an Electron app is slow by design and is never used to judge speed.
- Test data: the generated 50,000-note vault, with some notes of 1 MB, one note with 200 headings, 5,000 notes that link to one note, and nested folders. The hand-made sample notes stay separate.
- Cold means the first start after a reboot. Warm means a later start. The first start after a fresh install is reported on its own, because Defender scans it.
- Every number is the median of at least 20 runs, with the 95th percentile beside it. Frame and typing times use the 99th percentile.

---

## Targets

| Metric | Target | How measured |
|---|---|---|
| Cold start to a usable window | Under 2 s | Full set, reference machine, cold, warm and first after install |
| Quick capture, hotkey to typing cursor | Under 300 ms | Full set, both capture approaches, with and without the 120 ms entrance |
| First search results on 50,000 notes | Under 200 ms | Quick set |
| Replace all of 5,000 matches in a 1 MB note | Under 1 s | Quick set |
| Frame rate while anything animates | Steady 60 frames per second | Performance trace, dropped frames reported per animation |
| Key press to letter on screen, 1 MB note | Median under 8 ms, 99th percentile under 16 ms, all animations on | Full set, trace |
| Open a note from the list | Under 50 ms for 10 KB, under 150 ms for 1 MB | Quick set |
| Switch tab | Under 50 ms | Quick set |
| First page of the note list, folder of 50,000 notes | Under 100 ms | Quick set |
| Quick switcher, key press to results, 50,000 notes | Under 30 ms | Quick set |
| Main process blocked at any one time | Never more than 50 ms, in every case in this table | Lag monitor during every benchmark |
| First index of 50,000 notes | Under 2 minutes, window usable the whole time | Quick set |
| Relaunch with nothing changed, index up to date | Under 3 s, in the background | Quick set |
| Rename a note with 5,000 links to it | Under 30 s in the background, window never frozen | Quick set, SSD and slow disk |
| Move a folder of 5,000 notes | Control back at once, link updates done in under 30 s | Quick set, SSD and slow disk |
| Import 5,000 notes | Under 60 s | Quick set, SSD and slow disk |
| Memory, idle in the tray, all processes together | Starting target 200 MB, set for real after M1 | Full set, with and without the index worker kept alive, for both capture approaches |
| Memory, main window open on the 50,000-note vault | Under 600 MB, all processes together | Full set |
| Memory after 8 hours of use | No steady growth | Scripted 8-hour run: opening notes, typing, searching, switching vaults, opening and closing windows |
| Opening Wrriter from the tray | Tabs and the first page of the list in under 500 ms | Full set |
| Installer size | Under 120 MB | Size report on every build |

The rename, move and import times depend on the disk, so those rows are the most likely to be tuned after M1. A miss is reported and fixed or decided on, never quietly accepted.

### Rows added by later features

Each of these gets a real number in the milestone that builds it, with the same measure-and-report rule.

| Feature | What is measured | From |
|---|---|---|
| Automatic backup | 50,000 notes backed up while typing stays smooth | V2 |
| Journal calendar | Instant on a year of daily notes | V2 |
| Table and wall views | Smooth scroll on 50,000 notes | V2 |
| PDF preview | Only on-screen pages drawn, viewer loaded on first use | V2 |
| A note with twenty large videos | Opens in the same time as an empty note | V2 |
| Encrypting 5,000 notes | Window usable throughout | V2 |
| Notes graph | Time to the first picture, smooth panning on 50,000 notes | V3 |

---

## Measured Baselines

None yet. The M1 report adds the first numbers here: the machine, packaged build, cold, warm or first after install, Defender on, and for each row pass or miss. Each miss comes with its cause and a first fix.

---

## The Benchmark Harness

- Built in M1, right after the day-one check and before any feature. It holds the test vault generator, scripted benchmarks that run against the packaged app, and one command that runs them all and writes the results to a file in the repository.
- The **quick set** runs on every build and fails the build when a result is more than 20% worse than the stored baseline. It covers what can be measured without a person: indexing, note open, rename and move jobs, import, replace all, and the memory of the index worker.
- The **full set** covers what needs the real screen, such as cold start and frame times. It runs on the reference machine and is reported per milestone.
- The **lag monitor** is built into development builds. It logs every block of the main process longer than 50 ms and every long task in a window longer than 50 ms, with where it came from. Offenders are found while the code is written, not in M5.
- Profile first. Nothing is optimised without a trace showing where the time goes.

---

## Mitigation Strategies

### Startup

**1. Startup path purity.** Before the first frame: the single-instance lock, reading settings, and a hidden window already in the theme's background colour. Nothing else (ARCHITECTURE.md rule 19).

**2. Show when ready.** The window is shown only when its first frame is ready, so there is no white flash.

**3. First paint from saved state.** Open tabs, pane widths and the first page of the note list come from the app data folder. Nothing waits for the index, the watcher, the settings window or the vault list.

**4. Idle loading.** After the first paint: the index worker, the watcher, the command palette (prepared at once so Ctrl+Shift+P is instant), interrupted jobs. On first use only: the settings window, extra code block languages, and in Version 2 the PDF viewer and other Version 2 parts.

**5. Lean bundle.** The interface is split into pieces that load on demand. The main process is one bundled file. V8 code caching for both, with the start time reported with and without it.

**6. Lean installer.** Only the English language files of the browser engine are kept. The size report lists the biggest parts on every build.

### The main process

**7. It does almost nothing.** Windows, the tray, the hotkey, routing and small file operations. Everything that can take more than a few milliseconds runs in a worker.

**8. No synchronous file calls** after startup. A lint rule fails the build on one.

**9. better-sqlite3 only in the index worker.** It is synchronous, so in the main process a slow query would freeze the hotkey and every window.

**10. One job at a time in the job worker**, so a long job never competes with another.

**11. Throttled progress.** Progress is sent at most a few times per second.

**12. A second launch hands over** to the running copy without starting a second engine.

### The search index

**13. Fast SQLite settings.** WAL mode, one transaction per batch of about 500 files, prepared statements, relaxed durability. The file is a cache, so it does not need to survive a power cut.

**14. FTS5 prefix indexes** on the searched columns only. Snippets are built only for rows on screen.

**15. Titles in memory.** Every note's title, path and modified time live in memory in the index worker, so the quick switcher never queries the database.

**16. Pages by "continue after this row"**, never a growing offset, so page 200 costs the same as page 1.

**17. A light indexer.** Each note is read with simple pattern matching for the frontmatter, tags, wikilinks and first lines. Never the editor, never a full markdown parse.

**18. Low priority, a few files at a time** (around 8, Antigravity reports the number). On the first index, the folder on screen is indexed first.

**19. Only changed files** (modified time or size) are read again on later launches.

**20. Batched watcher.** Events that arrive together become one batch. Wrriter's own writes are ignored for a short moment, so an autosave never triggers a re-read of the note it just saved. Lost events trigger a full rescan.

### The editor

**21. Note text stays in the editor.** It is never copied into React state.

**22. A key press redraws nothing else** except the saved state and the counts, at most once per frame.

**23. Markdown only on pause.** The note is turned back into markdown only when typing pauses, and only the edited blocks are re-serialized. Writing a whole 1 MB note after each key would be the first thing to make typing slow.

**24. Autosave off the typing path.** Preparing the text, comparing bytes and writing never block a key press.

**25. Counts from changed blocks**, not by counting the whole note again.

**26. Find draws nearby matches.** Highlights are drawn only near the visible area, while the count covers the whole note. If drawing every match is still instant when measured, Antigravity may keep it simple and says so.

**27. Lazy images.** Opening a note does not wait for its images. They decode off the main thread, and their saved width reserves the space so the text never jumps.

**28. One live editor.** Only the tab on screen has a drawn editor. Other tabs keep text, cursor, scroll and undo history in memory. If TipTap does not allow it, the three newest tabs keep editors and older tabs lose undo history while hidden, and Antigravity tells Krishna before building it.

**29. Small changes between windows.** A note open in two windows exchanges small changes, never the whole note.

**30. Capped undo if needed.** If the 8-hour run shows undo history growing memory steadily, Antigravity caps the steps kept and reports the number.

### Windows and memory

**31. The main window is destroyed** when it closes to the tray. Only the main process, the tray, the hotkey and the quick capture window stay alive.

**32. Pop-out windows are destroyed** when closed.

**33. Nothing runs while idle in the tray**: no timers except the next reminder (Version 2), no polling, no rendering.

**34. Every cache has a size limit.**

**35. The index worker may shut down when idle.** Antigravity measures memory saved against start time, and Krishna chooses.

### File work

**36. Lists read file names and file information only.** Note text is read for the index in the worker, never while a list is drawn.

**37. The flush stays on every file**, including each file in a job. Skipping it could leave an empty note after a power cut that the redo rule could not tell from a finished one.

**38. Parallel writes instead.** Jobs write about 4 to 8 files at a time, so the disk overlaps the waiting. Antigravity picks and reports the number.

**39. Plain text link updates.** Read the note, replace only the link text, write it back. The index is updated once per batch.

**40. Fast imports.** The operating system's own copy, a few files at a time, reading only the .md files that need a `created:` check, then setting the modified time back.

**41. A folder move is one rename on disk.** The link work after it runs in the job worker.

### Motion

**42. Transform and opacity only**, except the listed size changes, which animate one container and never re-wrap text.

**43. Only rows on screen animate.** If a change would move more than about 50 visible rows, the list updates at once instead. Antigravity tunes and reports the number.

**44. The typing touches step aside.** If the caret glide, the selection fade or the new-letter fade add any delay or dropped frames in a 1 MB note, the new-letter fade goes first, then the others, and Antigravity tells Krishna.

**45. Nothing animates while idle or hidden.**

### Later features (Version 2 and 3)

**46.** scrypt and encryption run in a worker and stream large files. **47.** PDF.js runs in its own worker and draws only the pages on screen. **48.** Audio and video players are made only when asked for. **49.** Folder views and the calendar read the index in pages and draw only what is on screen; wall card heights come from the index. **50.** Backup writes its zip as a stream at low priority in a worker. **51.** Graph positions are worked out in a worker and drawn on the graphics card.

---

## Debug-Only Tools

- **Test vault generator:** the 50,000-note vault with large notes, many headings, heavy backlinks and nested folders. Development only.
- **Lag monitor:** logs main process blocks and long window tasks over 50 ms. Development builds only.
- **Slow-motion switch:** every duration five times longer, for tuning motion by feel. Hidden, development only (Features 8).
- **Size report:** the biggest parts of the packaged app, on every build.

---

## Pre-Ship Checklist

Run on the reference machine, packaged build, Windows Defender on, before every release. Nothing is ticked yet.

- [ ] Cold start under target, reported cold, warm and first after install
- [ ] Quick capture under 300 ms to the cursor, reported for both approaches with and without the entrance animation
- [ ] Key-to-screen in a 1 MB note under target with all animations on
- [ ] Every quick-set row passes against the stored baseline
- [ ] Rename, move and import within budget on the SSD, with the slow-disk times reported
- [ ] Main process never blocked over 50 ms during the full set
- [ ] Memory under target idle in the tray and with the 50,000-note vault open
- [ ] The 8-hour run shows no steady memory growth
- [ ] No white flash in either theme on start
- [ ] Installer under 120 MB, size report attached
- [ ] Dropped frames reported for every animation, reviewed with the slow-motion switch
- [ ] Nothing animates and nothing runs while idle in the tray
- [ ] Dependency vulnerability audit clean
- [ ] Every dependency added since the last release has a DEPENDENCIES.md entry
- [ ] Every miss has a cause and a first fix, and no number was loosened without Krishna
