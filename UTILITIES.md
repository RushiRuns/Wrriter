# Wrriter - Utilities Registry

> Check here BEFORE writing any component, helper, store or domain function.
> If it is not here, it does not exist yet. If it is here, use it. Do not write a second one.
> Updated at the end of every session that creates something reusable (DONE.md section 8).

**Status: empty.** No code is written yet. The tables show the shape and the planned entries, taken from Features 1 to 9, the versions doc and the UI hand-off. A planned entry is a promise of where something will live, not code that exists. Mark an entry **Built** only when it is merged and tested.

The Milestone column follows the guide table in the versions doc. The milestone list Antigravity sends Krishna before M1 replaces it once approved.

**Row format:** `Name | Location | One-line purpose | Milestone | Status`

---

## Do NOT Create a Duplicate Of

Each of these exists exactly once. A second copy is a bug.

| Item | The one place |
|---|---|
| Writing a vault file | `SafeWriter` |
| Reading a vault file | `VaultReader` |
| Changing many files | `JobService` and the job worker (the pending jobs list) |
| Reading and writing SQLite | `IndexDb`, inside the index worker |
| Index queries from a window | `IndexClient` (the channel from the main process) |
| The list of requests between processes | `shared/ipc` |
| Checking a path is inside the vault | `Vault.resolveInside` |
| File and folder names | `shared/domain/names` |
| Title from the first line | `shared/domain/titles` |
| Frontmatter edits | `shared/domain/frontmatter` |
| Wikilink parsing and rewriting | `shared/domain/wikilinks` |
| Link resolution | `shared/domain/links` |
| Tag rules | `shared/domain/tags` |
| Manual order keys | `FractionalIndex` in `shared/domain/ordering` |
| Search filter parsing | `shared/domain/search-filters` |
| Turning markdown into blocks and back | `shared/markdown` |
| Search text escaping | `ftsEscape` |
| Time | `Clock` (injected) |
| IDs | `IdGenerator` (injected) |
| Results and errors | `shared/result.ts` |
| Error to message | `toMessage()` |
| Tokens (colours, type, space, sizes, radii, motion) | `tokens.css` |
| Motion values in script | `renderer/motion` |
| Reduced motion check | `useReducedMotion()` |
| Shortcuts | The shortcut list |
| Palette commands | The command registry |
| Icons | The icon set copied from the UI reference |
| The menu look | `Menu` |
| Notices | `Notice` |
| Settings | `SettingsService` |

---

## Domain Functions (`src/shared/domain`, `src/shared/markdown`)

| Name | Location | Purpose | Milestone | Status |
|---|---|---|---|---|
| `Clock`, `SystemClock`, `TestClock` | `shared/clock.ts` | Injected time, local `today()`, fixed clock for tests | M1 | Built |
| `IdGenerator`, `TestIdGenerator` | `shared/id-generator.ts` | Injected ID generator, sequential test generator | M1 | Built |
| `Result`, `AppError`, `toMessage` | `shared/result.ts` | Typed results and plain error messages | M1 | Built |
| `names` | `shared/domain/names.ts` | Windows-safe names, reserved names, 100-character cap, numbering on clash, case-only clash check | M1 | Built |
| `titles` | `shared/domain/titles.ts` | Title from the first line, Untitled numbering, when a file follows its title | M2 | Built |
| `frontmatter` | `shared/domain/frontmatter.ts` | Read and edit the owned keys, keep every other key, comment and the order | M2 / M3 | Built |
| `wikilinks` | `shared/domain/wikilinks.ts` | Parse `[[...]]` forms, rewrite on rename keeping alias and heading | M3 | Built |
| `links` | `shared/domain/links.ts` | Resolve a plain link: same folder first, then most recently modified | M3 | Built |
| `tags` | `shared/domain/tags.ts` | Allowed characters, case folding, nesting by slash, rename and merge | M3 | Built |
| `FractionalIndex` | `shared/domain/ordering.ts` | Positions between neighbours, rebalance | M1 | Built |
| `searchFilters` | `shared/domain/search-filters.ts` | Parse `tag:`, `status:` and `folder:` with words | M3 | Planned |
| `jobPlans` | `shared/domain/job-plans.ts` | What changes and which files, for rename, move, tag rename and import | M3 | Built |
| `conflictNames` | `shared/domain/conflicts.ts` | Detect `sync-conflict` copies next to a note | M1 (shown), V2 (handled) | Planned |
| `captureNames` | `shared/domain/names.ts` | `Quick note YYYY-MM-DD HH.mm`, `Pasted image YYYYMMDD-HHmmss.png` | M4 | Planned |
| `imagePaths` | `shared/domain/image-paths.ts` | Relative image and attachment paths, percent-encoding, rewrite on move | M3 | Built |
| `blockSplitter` | `shared/markdown/blocks.ts` | Split a note into blocks with their exact source text | M2 | Built |
| `planSave` | `shared/markdown/save.ts` | Re-serialize only edited blocks, keep line endings, byte order mark and style | M2 | Built |
| `lightIndexer` | `src/shared/markdown/light-index.ts` | Frontmatter, tags, wikilinks and first lines by pattern matching, for the index | M3 | Built |

## Main Services (`src/main/services`)

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| `VaultService` | Open a folder as a vault, create a vault, the vault list, unavailable vaults, `resolveInside` (`src/main/services/vault-service.ts`) | M1 | Built |
| `NoteService` | Save, rename on leaving, duplicate (number increment, fresh created:, unchanged first line, unpinned), delete to the Recycle Bin, pin (`src/main/services/note-service.ts`) | M1 to M3 | Built |
| `FolderService` | New, rename, move, delete with a count (`src/main/services/folder-service.ts`) | M1 | Built |
| `OrderService` | Manual order and pins in `.wrriter` (`src/main/services/order-service.ts`) | M1 | Built |
| `JobService` | Writes jobs to the pending list, hands them to the job worker, finishes them at start (`src/main/services/job-service.ts`) | M1 | Built |
| `SearchService` | Vault search with filters, the quick switcher (`src/main/services/search-service.ts`) | M3 | Built |
| `TagService` | Tag list with counts, rename and merge (as jobs) (`src/main/services/tag-service.ts`) | M3 | Built |
| `LinkService` | Backlinks, link updates on rename and move (as jobs) (`src/main/services/link-service.ts`) | M3 | Built |
| `CaptureService` | Quick capture window, pop-outs, Inbox, last active vault | M4 | Planned |
| `AttachmentService` | Copy in, reuse identical files, names, missing file state | M4 | Planned |
| `ImportService` | Import notes and folders (as a job with a cancel button) | M4 | Planned |
| `SettingsService` | Read and write settings, apply them live | M2 | Planned |
| `WindowService` | Create, restore and destroy windows, saved state for first paint (`src/main/services/window-service.ts`) | M1 | Built |

## Stores and Workers

| Name | Location | Purpose | Milestone | Status |
|---|---|---|---|---|
| `SafeWriter` | `src/main/services/safe-writer.ts` | Temp file, flush, rename, byte comparison, line endings and byte order mark kept, retry on lock | M1 | Built |
| `VaultReader` | `src/main/services/vault-reader.ts` | Read note bytes and folder listings | M1 | Built |
| `Watcher` | `src/main/services/watcher-adapter.ts` | File watcher adapter: batches, ignores own writes, full rescan on lost events | M1 | Built |
| `AppDataStore` | `src/main/store/app-data-store.ts` | Settings, vault list, window state, first-paint state | M1 | Built |
| `JobsStore` | `src/main/store/jobs-store.ts` | The pending jobs list, one file per vault, batched ticks | M1 | Built |
| `IndexDb` | `src/workers/index/db.ts` | SQLite schema, WAL, batched writes, prepared queries, auto-rebuild on corrupt/old cache | M3 | Built |
| `Indexer` | `src/workers/index/indexer.ts` | First index (active folder first), changed-files incremental reindex, Syncthing batching | M3 | Built |
| `TitleList` | `src/workers/index/titles.ts` | In-memory titles for the quick switcher | M3 | Built |
| `JobRunner` | `src/workers/jobs/job-runner.ts` | Runs one job at a time, 4 to 8 files in parallel | M1 | Built |
| `IndexClient` | `src/main/services/index-client.ts` | The fixed set of index read requests over the channel | M3 | Built |
| `ftsEscape` | `src/workers/index/fts.ts` | The one function that escapes search text | M3 | Built |

## IPC Requests (`src/shared/ipc`)

Record every request here as it is written, so a second one is not added for the same job.

| Request | Arguments | Result | Milestone | Status |
|---|---|---|---|---|
| `window.minimize` | `{}` | `void` | M1 | Built |
| `window.maximize` | `{}` | `void` | M1 | Built |
| `window.close` | `{}` | `void` | M1 | Built |
| `window.setPaneWidths` | `{ sidebarWidth: number, listWidth: number }` | `void` | M1 | Built |
| `window.firstPaintComplete` | `{}` | `void` | M1 | Built |
| `vault.open` | `{ path: string }` | `VaultInfo` | M1 | Built (Contract & Router) |
| `vault.close` | `{}` | `void` | M1 | Built (Contract & Router) |
| `vault.getActive` | `{}` | `VaultInfo \| null` | M1 | Built (Contract & Router) |
| `note.read` | `{ path: string }` | `NoteContent` | M1 | Built (Contract & Router) |
| `note.save` | `{ path: string, text: string }` | `SaveOutcome` | M1 | Built (Contract & Router) |
| `note.setPinned` | `{ path: string, pinned: boolean }` | `void` | M1 | Built (Contract & Router) |
| `note.delete` | `{ path: string }` | `void` | M1 | Built |
| `note.list` | `{ folder?: string, sortBy?: string }` | `NoteListItem[]` | M1 | Built |
| `note.setOrder` | `{ path: string, folder?: string, beforeKey?: string, afterKey?: string }` | `void` | M1 | Built |
| `note.rename` | `{ oldPath: string, newPath: string }` | `NoteJobResult` | M3 | Built |
| `note.move` | `{ oldPath: string, newPath: string }` | `NoteJobResult` | M3 | Built |
| `folder.create` | `{ path: string }` | `void` | M1 | Built |
| `folder.rename` | `{ oldPath: string, newPath: string }` | `void` | M1 | Built |
| `folder.delete` | `{ path: string }` | `void` | M1 | Built |
| `folder.list` | `{}` | `FolderNode[]` | M1 | Built |
| `app.getStartupState` | `{}` | `StartupState` | M1 | Built |
| `app.getTheme` | `{}` | `ThemeName` | M1 | Built |
| `app.setTheme` | `{ theme: ThemeName }` | `void` | M1 | Built |
| `app.getAccent` | `{}` | `AccentName` | M1 | Built |
| `app.setAccent` | `{ accent: AccentName }` | `void` | M1 | Built |
| `app.getSettings` | `{}` | `AppSettingsContract` | M1 | Built |
| `app.saveSettings` | `Partial<AppSettingsContract>` | `AppSettingsContract` | M1 | Built |
| `app.getHotkeyStatus` | `{ hotkey?: string }` | `HotkeyStatusResult` | M4 | Built |
| `app.openLogFolder` | `{}` | `void` | M1 | Built |
| `index.getNotes` | `{ folder?: string, sortBy?: string, after?: KeysetCursor, limit?: number }` | `NoteListItem[]` | M3 | Built |
| `index.getFolderCounts` | `{}` | `IndexFolderCount[]` | M3 | Built |
| `index.getTitleList` | `{}` | `IndexTitleItem[]` | M3 | Built |
| `index.search` | `{ query: string, limit?: number }` | `IndexSearchResultItem[]` | M3 | Built |
| `index.getStatus` | `{}` | `IndexStatus` | M3 | Built |
| `index.getStatuses` | `{}` | `string[]` | M3 | Built |
| `index.getTags` | `{}` | `string[]` | M3 | Built |
| `index.getTagCounts` | `{}` | `IndexTagCount[]` | M3 | Built |
| `index.getBacklinks` | `{ target: string, altTarget?: string }` | `BacklinkRecord[]` | M3 | Built |
| `tag.rename` | `{ oldTag: string, newTag: string }` | `TagRenameResult` | M3 | Built |

## Index Queries

Record every query here as it is written.

| Query | Returns | Milestone | Status |
|---|---|---|---|
| `index.getNotes` | `readonly NoteListItem[]` | M3 | Built |
| `index.getFolderCounts` | `readonly IndexFolderCount[]` | M3 | Built |
| `index.getTitleList` | `readonly IndexTitleItem[]` | M3 | Built |
| `index.search` | `readonly IndexSearchResultItem[]` | M3 | Built |
| `index.getStatus` | `IndexStatus` | M3 | Built |
| `index.getStatuses` | `readonly string[]` | M3 | Built |
| `index.getTags` | `readonly string[]` | M3 | Built |
| `index.getTagCounts` | `readonly IndexTagCount[]` | M3 | Built |
| `index.getBacklinks` | `readonly BacklinkRecord[]` | M3 | Built |

## Shared Components (`src/renderer/components`)

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| `WindowShell` | Frameless rounded window, the 40 px toolbar, the three window buttons (`src/renderer/components/WindowShell.tsx`) | M1 | Built |
| `NameField` | The note name field in the toolbar, rename in place | M1 | Built |
| `Tile`, `TileGrid` | Icon tiles, three to a row, tiles come from a list (`src/renderer/windows/main/MainWindow.tsx`) | M1 | Built |
| `FolderTree`, `FolderRow` | Folder row with the icon that turns into the expand chevron on hover (`src/renderer/components/FolderTree.tsx`) | M1 | Built |
| `NoteRow` | Note row: title, date, preview, thumbnail (`src/renderer/components/NoteRow.tsx`) | M1 | Built |
| `VirtualList` | Virtualised, windowed list with FLIP glide (`src/renderer/components/VirtualList.tsx`) | M1 | Built |
| `VaultButton`, `VaultMenu` | The vault button and its popup menu (`src/renderer/components/VaultMenu.tsx`) | M1 | Built |
| `NotesPaneMenu` | The three-dot options menu of the notes pane (`src/renderer/components/NotesPaneMenu.tsx`) | M1 | Built |
| `Menu`, `MenuItem` | The one menu look for every menu (`src/renderer/components/menu/`) | M2 | Built |
| `TabStrip`, `Tab` | The 32 px tabs strip at the bottom of the editor (`src/renderer/components/TabStrip.tsx`) | M1 to M2 | Built |
| `Notice` | Notices in the same corner every time (`src/renderer/components/Notice.tsx`) | M1 | Built |
| `Tooltip` | Tooltips after about half a second (`src/renderer/components/Tooltip.tsx`) | M2 | Built |
| `Dialog` | Confirmations such as deleting a folder (`src/renderer/components/Dialog.tsx`) | M1 to M2 | Built |
| `Palette` | Command palette and quick switcher overlay (`src/renderer/components/CommandPalette.tsx`, `src/renderer/palette/command-registry.ts`) | M2 to M3 | Built |
| `FindBar` | Find and replace floating bar over note column with toggles and counts (`src/renderer/components/FindBar.tsx`) | M2 | Built |
| `SettingsWindow` | Settings, including Note margin and the shortcut list (`src/renderer/components/SettingsWindow.tsx`) | M2 | Built |
| `WikilinkSuggest` | Auto-suggest popover listing note titles from the index when typing `[[` (`src/renderer/components/WikilinkSuggest.tsx`) | M3 | Built |
| `SearchView` | Search view in notes pane with live results, filter pills (tag:, status:, folder:), and highlighted snippets (`src/renderer/components/SearchView.tsx`) | M3 | Built |
| `QuickSwitcher` | Quick switcher modal (Ctrl+P) with loose title matching, recent notes, and create candidate (`src/renderer/components/QuickSwitcher.tsx`) | M3 | Built |

| `FileChip` | The ticket-shaped file chip, and the missing file state | M4 | Planned |
| `Icon` | The icon set copied from the UI reference (`src/renderer/components/icons.tsx`) | M1 | Built |
| `ComponentGallery` | Development-only page showing every component in light and dark on all five accents (`src/renderer/components/gallery/Gallery.tsx`) | M1 | Built |

## Editor Parts (`src/renderer/editor`)

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| `EditorHost` | One live TipTap editor, hidden tabs kept without a drawn editor (`src/renderer/editor/EditorHost.tsx`) | M2 | Built |
| `FindReplace` | ProseMirror search, decoration highlights, protected pass-through/wikilink skipping, mark-preserving replacement (`src/renderer/editor/find-replace-core.ts`, `src/renderer/editor/extensions/find-replace-extension.ts`) | M2 | Built |
| Element nodes and marks | Headings, lists, tasks, blockquote, codeblock, hr, bold, italic, strike, code (`src/renderer/editor/extensions/`) | M2 | Built |
| `Callout` | Callout node, types, fold, the colour mixes from the UI reference (`src/renderer/editor/extensions/callout.ts`) | M2 | Built |
| `Table` | Table node, header, rows, alignment, cell padding (`src/renderer/editor/extensions/table.ts`) | M2 | Built |
| `ImageBlock` | Resize handles, left/centre/right alignment, natural size reset (`src/renderer/editor/extensions/image.ts`) | M2 | Built |
| `FileChip` | Ticket-shaped file chip with notched sides and type badge (`src/renderer/editor/extensions/file-chip.ts`) | M2 | Built |
| `BlockHandles` | Fold arrow as handle for headings, grab areas for callouts, grip for other blocks (`src/renderer/editor/extensions/block-handles.ts`, `heading-folding.ts`) | M2 | Built |
| `BlockDrag` | Drag, drop line, auto-scroll, Escape, fold during drag, section moves, Alt+Up/Down (`src/renderer/editor/extensions/block-drag.ts`, `keyboard-move.ts`) | M2 | Built |
| `SlashMenu` | The twelve-item slash menu (`src/renderer/editor/extensions/slash-menu.ts`, `SlashMenu.tsx`) | M2 | Built |
| `FloatingToolbar` | The format pill over selected text (`src/renderer/editor/extensions/floating-toolbar.ts`, `FloatingToolbar.tsx`) | M2 | Built |
| `PasteToMarkdown` | Web content turned into markdown, never inserted as HTML (`src/renderer/editor/extensions/paste-handler.ts`) | M2 | Built |
| `TypingTouches` | Caret glide, selection fade, new-letter fade, skipped when typing is fast (`src/renderer/editor/extensions/typing-touches.ts`) | M2 | Built |

## Motion and UI Helpers (`src/renderer/motion`, `src/renderer/styles`)

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| `tokens.css` | The one token list, ported from the UI reference (`src/renderer/styles/tokens.css`) | M1 | Built |
| `components.css` | Shared component styling from UI hand-off 2 (`src/renderer/styles/components.css`) | M1 | Built |
| `motion` helpers | Speeds and curves from the tokens for Web Animations calls, 70% leave rule (`src/renderer/motion/index.ts`) | M1 | Built |
| `useReducedMotion()` | Windows setting plus the Motion setting (`src/renderer/motion/index.ts`) | M1 | Built |
| Slow-motion switch | Development only, every duration five times longer (`src/renderer/motion/index.ts`) | M1 | Built |
| `flipGlide` | Work out final layout first, then glide items with transform (`src/renderer/motion/index.ts`) | M1 | Built |
| Icons (`icons.tsx`) | 53 inline SVG icons copied directly from UI hand-off 2 (`src/renderer/components/icons.tsx`) | M1 | Built |
| Component gallery | Interactive preview of shared components, light/dark, 5 accents (`src/renderer/components/gallery/Gallery.tsx`) | M1 | Built |

## Platform Adapters (`src/main/platform`)

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| `Tray` | Tray icon and menu (`src/main/platform/tray.ts`) | M4 | Built |
| `Hotkey` | Global hotkey, live change, taken-combination message (`src/main/platform/hotkey.ts`) | M4 | Built |
| `SingleInstance` | One running copy, hand over arguments (`src/main/platform/single-instance.ts`) | M4 | Built |
| `LoginItem` | Start with Windows, hidden (`src/main/platform/login-item.ts`) | M4 | Built |
| `AppLifecycle` | Background persistence, tray, hotkey, and single instance coordination (`src/main/app/app-lifecycle.ts`) | M4 | Built |
| `RecycleBin` | Delete to the Windows Recycle Bin (`src/main/platform/recycle-bin.ts`) | M1 | Built |
| `ShellOpen` | Open in the default app, show in File Explorer, web links after checking | M4 | Planned |
| `VaultProtocol` | The one app protocol serving files inside open vaults (`src/main/platform/vault-protocol.ts`) | M2 | Built |
| `DragOut` | Drag a note out as a .md file | M4 | Planned |
| `ImageDownloader` | The one network call: an image dropped from a website | M4 | Planned |
| `SpellCheck` | English spell check with suggestions on right-click (`src/main/services/window-service.ts`) | M2 | Built |

## Build Checks and Test Tools

| Name | Purpose | Milestone | Status |
|---|---|---|---|
| Token check | Fails on raw colours, off-scale sizes, durations outside list (`scripts/check-tokens.mjs`) | M1 | Built |
| Contrast check | 4.5:1 text, 3:1 large text, icons and outlines, all accents, both themes (`scripts/check-contrast.mjs`) | M1 | Built |
| Motion check | Rejects durations > 300 ms or outside 4 approved speeds (`scripts/check-motion.mjs`) | M1 | Built |
| Long-dash check | Fails on en-dash or em-dash in app UI text (`scripts/check-dash.mjs`) | M1 | Built |
| Layer import check | The import rules in ARCHITECTURE.md (`scripts/check-rules.mjs`) | M1 | Built |
| `Round-trip check` | The sample notes, byte for byte (`tests/samples/round-trip.test.ts`) | M2 | Built |
| Random-stop test | Jobs interrupted 100 times (`tests/main/jobs-random-stop.test.ts`) | M3 | Built |
| Vault generator | The 50,000-note test vault (`tests/vault-gen/generate-vault.ts`) | M1 | Built |
| Benchmark harness | Quick set every build, full set per milestone (`tests/bench/benchmark-suite.mjs`) | M1 | Built |
| Lag monitor | Main process blocks and long window tasks over 50 ms (`src/main/platform/lag-monitor.ts`, `src/renderer/lag-monitor.ts`) | M1 | Built |
| Size report | Per-bundle raw/gzip assets and packaged size ceiling check (`scripts/size-report.mjs`) | M1 | Built |

---

## Rules for this file

1. Add the entry in the same commit as the code.
2. Entries describe what exists, not what is hoped for. Planned items stay marked Planned.
3. When something is renamed or moved, fix its row in the same commit.
4. If two entries do nearly the same thing, merge them and update every caller. That is a refactor session.
