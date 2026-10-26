# Wrriter - Internal Changelog

> One entry per coding session, written before committing.
> Format: `[date] - [what was built] - [what changed architecturally]`
> "Architecturally" means: a new process or layer, a new stored format or format version, a new pattern, a rule bent, a dependency added. If nothing architectural changed, write "none".
> If a performance number was measured, record it here with the machine, the packaged build, cold, warm or first after install, and whether Windows Defender was on.
> A cut feature or a cut animation is recorded in the entry of the milestone that would have built it.

---

[2026-10-25] - Governance set drafted: ARCHITECTURE, SYSTEM, SCHEMA, PERFORMANCE, DEPENDENCIES, DONE, UTILITIES and this changelog, written from Features 1 to 9, the Feature map by version, the versions doc, and the UI hand-off and UI reference of 25 Oct 2026. No code written, nothing measured. - Initial architecture: Electron main process with an index worker and a job worker; windows reach files and the index only through one fixed request list; SafeWriter as the only vault writer; the pending jobs list as the only way to change many files; the disk as the source of truth and the SQLite index as a rebuildable cache; tokens ported from the UI reference, held by build checks. Open before M1: worker type, file watcher, which worker writes autosaves, renderer state and test tools, application ID, UI hand-off decisions 1 to 5, versions doc questions 1 to 3, and Krishna's approval of the full milestone list.

[2026-10-26] - Initial project setup, empty frameless window shell, and the three Day-One checks passed. Created package.json, electron-builder.yml, electron.vite.config.ts, root tsconfig.json, and src/shared/tsconfig.json with pure TypeScript isolation (no DOM/Node). Launched empty Electron window with 40px toolbar, drag region, strict CSP, and three drawn buttons. Executed and passed the three Day-One checks: (1) better-sqlite3 installed and executed queries in main process, worker_threads, and utilityProcess in the packaged app on Windows; (2) generated 50,000 test files and benchmarked fs.watch, chokidar, and @parcel/watcher (100% events received, ~2.91 MB RAM) along with sub-second full rescan (990 ms); (3) window check on Windows 10/11 verifying native resize, snap, and double-click maximize with drawn buttons. - Architectural decisions recorded: ADR-W06 (frameless window shell and fallback), ADR-W11 (worker type: Electron utilityProcess), ADR-W12 (file watcher: @parcel/watcher).

