# Wrriter - Internal Changelog

> One entry per coding session, written before committing.
> Format: `[date] - [what was built] - [what changed architecturally]`
> "Architecturally" means: a new process or layer, a new stored format or format version, a new pattern, a rule bent, a dependency added. If nothing architectural changed, write "none".
> If a performance number was measured, record it here with the machine, the packaged build, cold, warm or first after install, and whether Windows Defender was on.
> A cut feature or a cut animation is recorded in the entry of the milestone that would have built it.

---

[2026-10-25] - Governance set drafted: ARCHITECTURE, SYSTEM, SCHEMA, PERFORMANCE, DEPENDENCIES, DONE, UTILITIES and this changelog, written from Features 1 to 9, the Feature map by version, the versions doc, and the UI hand-off and UI reference of 25 Oct 2026. No code written, nothing measured. - Initial architecture: Electron main process with an index worker and a job worker; windows reach files and the index only through one fixed request list; SafeWriter as the only vault writer; the pending jobs list as the only way to change many files; the disk as the source of truth and the SQLite index as a rebuildable cache; tokens ported from the UI reference, held by build checks. Open before M1: worker type, file watcher, which worker writes autosaves, renderer state and test tools, application ID, UI hand-off decisions 1 to 5, versions doc questions 1 to 3, and Krishna's approval of the full milestone list.

[2026-10-26] - Exact pinning of all dependencies and strict removal of unapproved packages per ARCHITECTURE.md rule 8. Pinned exact versions: react@19.3.1, react-dom@19.3.1, @tiptap/core@3.32.0, @tiptap/react@3.32.0, @tiptap/pm@3.32.0, better-sqlite3@12.11.1, electron@42.11.18, typescript@7.0.2, vite@8.3.5, electron-builder@26.18.0, and @types packages. Replaced electron-vite with native Vite 8 multi-target builds (vite.main.config.ts, vite.preload.config.ts, vite.renderer.config.ts). Removed all pending packages from package.json. - Architecture: strict dependency surface compliance.

[2026-10-26] - Four tsconfig files created with project references: root tsconfig.json referencing tsconfig.shared.json (covers src/shared, no DOM, no Node, no Electron types, enforcing no I/O), tsconfig.main.json (covers src/main, src/workers, src/preload, Node + Electron types, no DOM lib), and tsconfig.renderer.json (covers src/renderer, DOM lib, React JSX, no Node types). All configs configured with target ES2022, module ESNext/bundler, strict, noUncheckedIndexedAccess, noImplicitAny, noEmit. Verified boundary isolation (Node/DOM imports in shared and DOM imports in main fail type checks). - Process boundary enforcement via TypeScript project references.


