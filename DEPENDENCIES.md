# Wrriter - Dependencies

> Every library here is free and open source, needs no account, no API key, and never phones home.
> No dependency is added without an entry in this file (ARCHITECTURE.md rule 8).
> The cost of a dependency is its size in the installer, its startup cost, and its upgrade risk. "It saves 20 lines" is not a reason.

---

## Policy

- **Free and open source only.** MIT, Apache-2.0, BSD, ISC, or equivalent, and the SIL Open Font Licence for fonts. No paid tier, no hosted service, no API key.
- **No package that phones home.** No analytics, crash reporting, ads, remote config, update checks or cloud backend.
- **Versions** are pinned in `package.json` and the lockfile is committed. This file does not state versions. Use the latest stable at the time the dependency is added.
- **Verify on the day it is added:** the licence, the date of the last release, and that it works fully offline. The licence column below is an understanding and is **not verified**. A library with no release in 12 months needs an ADR before it goes in.
- **Native modules** must install and run inside the packaged Electron app on a clean Windows machine without extra tools (Features 4). better-sqlite3 is checked on day one of M1.
- **Weight check:** the installer must stay under 120 MB. Anything that adds more than 500 KB to the installer, or runs code before the first frame, needs a one-line justification here.
- **Pending** means the library is a candidate, not approved. A check, a spike or Krishna decides, and the result updates this table.

---

## Approved: Runtime

| Library | Purpose | Licence (to verify) | Why this one |
|---|---|---|---|
| Electron | The app shell | MIT | Decided (Features 6) |
| React, react-dom | The interface | MIT | Decided (Features 6) |
| TipTap (core and only the extensions Wrriter uses) | The one editor | MIT | Decided (Features 2, 7). Brings ProseMirror with it. Each extension added is listed here when added |
| better-sqlite3 | The search index, in the index worker only | MIT | Decided (Features 4). Passed day-one check inside packaged app and utilityProcess (ADR-W11) |
| @parcel/watcher | File watcher, Windows ReadDirectoryChangesW | MIT | Decided in day-one check (ADR-W12). Fast startup (<100ms) and <3MB RAM |
| Inter (font files) | The one interface and note font, bundled | SIL OFL 1.1 | Decided (Features 1). Never loaded from the web |
| PDF.js (Version 2) | PDF preview, bundled, in its own worker | Apache-2.0 | Decided (Features 5). Not added before Version 2 |

**State management:** Plain React state and context encapsulated behind `use<Feature>` controller hooks (ADR-W13). No external state package.

**Built into Node and Electron, no package needed:** `crypto` (scrypt and AES-256-GCM in Version 2), `fs`, `path`, worker threads, Electron's utility process (chosen in ADR-W11), tray, global shortcut, notifications, shell, protocol and spell checker.

Code blocks use the fonts already on Windows (Cascadia Code, then Cascadia Mono, then Consolas). Nothing is bundled for them.

## Approved: Build Tooling (not shipped)

| Tool | Purpose | Licence (to verify) |
|---|---|---|
| TypeScript | Language | Apache-2.0 |
| Vite | Bundler for renderer, preload, main and workers | MIT |
| electron-builder | NSIS installer, current user only | MIT |
| Vitest | Unit tests for `shared/`, services, stores and controllers | MIT (verified 2026-10-19 release, works offline) |
| ESLint with typescript-eslint | Lint (no sync I/O in main, no floating promises) | MIT (verified Oct 2026 releases, works offline) |
| dependency-cruiser | Enforce layer import rules from ARCHITECTURE.md | MIT (verified 2026-10-23 release, works offline) |
| Prettier | Code formatting | MIT (verified 2026-10-10 release, works offline) |

---

## Pending: Decided by a Check or by Krishna

Nothing that depends on one of these is built until it is decided.

| Need | Candidates | How it is decided |
|---|---|---|
| File watcher | @parcel/watcher | Decided in day-one check on 50,000 files (ADR-W12) |
| Worker type | Electron utility process | Decided in day-one check (ADR-W11) |
| Vite and Electron wiring | Own Vite configs (main.vite.config.ts, workers.vite.config.ts, renderer.vite.config.ts) | Decided in M1 scaffold (zero extra packages) |
| Markdown block splitting with exact source positions | markdown-it (token line maps), micromark or mdast (positions), TipTap's own markdown support | M2 spike against the sample notes. The winner must give the exact source text of every block so unedited blocks are written back byte for byte |
| Frontmatter that keeps key order and comments | yaml (its Document API) | M2 spike: change one owned key, everything else stays byte for byte |
| IPC argument validation | Own validators in `shared/ipc`, zod | M1. Could own code do it in a few lines per request? |
| Renderer state | Plain React state and context | Decided: Plain React state & context (ADR-W13). No Zustand. Keypress state local |
| Virtualised lists | TanStack Virtual, own code | M1, a list of 50,000 rows scrolling smoothly |
| Fuzzy matching for the palette and quick switcher | Own code, fuzzysort | M2. Could 20 lines do it? |
| Accessible menus and popovers without styling | Radix primitives, own code | M2. Only if fully restyled from tokens with no visual change |
| Zip writer (Version 2 backup) | yazl, archiver | Version 2. Must stream |
| Line diff (Version 2 conflict screen) | diff | Version 2 |
| Graph drawing (Version 3) | sigma.js with graphology, own WebGL | Version 3. Must draw 50,000 dots on the graphics card |

## Approved: Testing and Quality Schedule (not shipped)

All 7 tools approved by Krishna in Setup phase. Added when first needed, not all at once:

- **Added now (Setup)**: Vitest, ESLint with typescript-eslint, dependency-cruiser, Prettier (verified and listed in Approved Build Tooling above).
- **With token and contrast checks in M1**: Stylelint (helps token check: no raw colours, sizes or durations outside `tokens.css`).
- **With the first packaged-app test in M1**: Playwright with its Electron support (end-to-end tests on the packaged app).
- **At M5 release builds**: @electron/fuses (turns off unused Electron fuses in release builds).

On the day each remaining tool is added, check the licence, the date of its last release, and that it works offline, then add its row to the Approved Build Tooling table above.

The token check, the contrast check, the motion check and the long-dash check are small scripts in this repo, not packages.

---

## Dev Tooling Outside the App (never shipped)

| Tool | Purpose |
|---|---|
| `tests/vault-gen/` | Generates the 50,000-note test vault |
| `tests/bench/` | The benchmark harness and the stored baseline |
| `tests/samples/` | The hand-made sample notes for the round-trip check |

---

## Banned

| Banned | Why | Use instead |
|---|---|---|
| Analytics, telemetry, crash reporting (Sentry, Bugsnag and the like) | Phones home. Features 6 | The log file and the Open log folder command |
| Auto-updaters (electron-updater, update services) | No update check and no self-update in Version 1 | Manual installs |
| Cloud SDKs (Google Drive, OneDrive, Dropbox, Firebase and any other) | Wrriter never talks to an online service | A backup folder that the user's own sync app already syncs |
| Account or sign-in SDKs | No accounts | None |
| HTTP client libraries (axios, got, node-fetch and the like) | One download exists in the whole app | Electron's own network module in the dropped-image downloader |
| Any AI or LLM SDK | Hard rule 13 | None |
| Styled component kits (MUI, Ant Design, Chakra, Bootstrap and the like) | The look is the mockup, built from tokens | Own components |
| Icon libraries (lucide, Heroicons, Font Awesome and the like) | Every icon is in the UI reference | Inline SVG copied from the UI reference |
| Web fonts loaded from the internet | Must work offline | Inter bundled in the app |
| Animation libraries (Framer Motion, GSAP, react-spring and the like) | Features 8: CSS transitions and the Web Animations API, values from the token list, nothing bounces | CSS transitions and the Web Animations API |
| A second editor (CodeMirror, Monaco, Slate, Lexical, Quill and the like) | One editor, no source mode | TipTap |
| A second database or ORM (sql.js, Prisma, Sequelize, TypeORM, IndexedDB for notes) | One index | better-sqlite3 |
| Anything that runs note content (Dataview or Templater runtimes, template engines that evaluate code) | Note content is never run | Shown as plain text |
| Syncthing installers or controllers | Wrriter never installs, starts or controls Syncthing | Help text with a link to syncthing.net |
| `@electron/remote` and anything that exposes the main process to a window | Electron security checklist | The fixed request list through the preload bridge |
| `<webview>` and iframes of web pages | No remote content in any window | The default browser |
| Any library needing an API key, an account or a paid tier | Free and local only | |

---

## Adding a Dependency

1. Search UTILITIES.md and this file. Does something already do it?
2. Could 20 lines of TypeScript do it? Then write them.
3. Check the licence, the last release date, the size added to the installer, any startup cost, and that it works offline.
4. Add a row here with the justification.
5. If it is not a one-line change, write an ADR first.
6. Krishna reviews before it lands.
