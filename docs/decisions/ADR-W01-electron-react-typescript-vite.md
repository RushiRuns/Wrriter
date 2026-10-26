# ADR-W01: Electron, React, TypeScript and Vite

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 6, 9)

## Context
Wrriter requires a desktop platform for 64-bit Windows 10 and 11 that provides fast local file access, system integration (single-instance lock, system tray, global hotkeys, window management), predictable typing performance (letters land on the same frame), and a responsive UI matching the Editor view mockup without white flashes.

## Decision
1. **Shell**: Electron (latest stable pinned to 42.11.18).
2. **Language**: TypeScript with strict mode enabled, `noUncheckedIndexedAccess`, and project references separating `src/shared` (pure, no DOM, no Node) from process layers.
3. **UI Library**: React (19.3.1) with DOM rendering, using plain React state and context without external state management libraries (ADR-W13).
4. **Bundler**: Vite (8.3.5) with dedicated build configs (`main.vite.config.ts`, `workers.vite.config.ts`, `renderer.vite.config.ts`) producing an optimized single-file main bundle, separate worker scripts, and on-demand window bundles with V8 code caching enabled. Zero extra wrapper packages.

## Consequences
- Single language (TypeScript) across main, worker, preload, and renderer processes.
- Process boundaries strictly enforced via TypeScript project references and layer lint checks.
- Rapid startup with V8 bytecode caching and hidden-until-ready window display.
- Packaging managed via electron-builder with NSIS per-user installer.
