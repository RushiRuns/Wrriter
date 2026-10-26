# ADR-W16: Markdown Block Splitter, Frontmatter Surgical Updater, and Round-Trip Check

Status: Accepted  
Decided: M2 Markdown core and round-trip check

## Context
Wrriter's primary architectural mandate is data preservation: user markdown files on disk are the sacred source of truth. A note opened and saved without edits must remain 100% byte-for-byte identical. When an edit occurs, only the edited block may be re-serialized, keeping all other blocks, frontmatter keys, comments, line endings (CRLF vs LF), UTF-8 BOM, and final newline presence exactly intact.

M2 required two spikes:
1. Block splitting with exact source positions to compare `markdown-it`, `micromark`/`mdast`, TipTap's serializer, and custom TypeScript.
2. Frontmatter updating to evaluate the `yaml` Document API vs surgical editing.

## Evaluation & Spike Results

### Spike 1: Block Splitting Candidates
- **TipTap / ProseMirror Serializer**: Fails the round-trip requirement. ProseMirror regenerates the entire document on serialization, re-ordering list markers, standardizing indentation, dropping block IDs (`^id`), and corrupting custom Obsidian syntax.
- **markdown-it**: Token maps (`token.map`) only provide approximate line indices, fail on multi-line list items and nested callouts, lack character offsets, do not parse YAML frontmatter natively, and add >150 KB to bundle size.
- **micromark / mdast**: Pure ESM tree incompatible with simple zero-dependency shared compilation, lacks built-in awareness of Obsidian callouts, dataview blocks, block IDs, and comments without complex plugin chains.
- **Wrriter Pure TypeScript `blockSplitter` (Winner)**:
  - Zero external dependencies; 100% compliant with `tsconfig.shared.json` (no DOM, no Node, ES2022).
  - Enforces the strict concatenation invariant: `blocks.map(b => b.raw).join('') === source`.
  - Accurately identifies all block types: frontmatter, headings, code blocks, math, comments, blockquotes/callouts, tables, lists (including loose and mixed indentation), html blocks, and paragraphs.

### Spike 2: Frontmatter Editing Candidates
- **`yaml` Document API (`parseDocument`)**: While capable of retaining comments and key order, `doc.set()` and `doc.toString()` reformat untouched flow sequences and whitespace (e.g. `tags: [a, b]` becomes `tags: [ a, b ]`), causing unwanted byte diffs in unedited properties. Furthermore, malformed YAML causes parse exceptions rather than safe text pass-through.
- **Surgical Frontmatter Updater (`src/shared/domain/frontmatter.ts`) (Winner)**:
  - Surgically updates only owned keys (`tags`, `status`, `created`).
  - Leaves unowned keys (`aliases:`, `cssclasses:`, custom metadata) and comments 100% byte-for-byte identical.
  - Leaves broken frontmatter untouched without throwing, matching SCHEMA.md.

## Decision
1. **`blockSplitter` (`src/shared/markdown/blocks.ts`)**: Used as the sole block-level segmentation engine.
2. **`planSave` (`src/shared/markdown/save.ts`)**: Used as the pure save planning gate. Re-serializes only changed blocks, preserving untouched blocks byte-for-byte, maintaining original CRLF/LF line endings, UTF-8 BOM, and final newline presence.
3. **`updateFrontmatter` (`src/shared/domain/frontmatter.ts`)**: Surgically mutates owned properties without touching non-owned keys or formatting.
4. **Round-Trip Build Gate (`tests/samples/round-trip.test.ts`)**: A suite of 21 hand-made sample notes in `tests/samples/` matching all 21 lines of SCHEMA.md runs on every build and fails if unedited bytes change.

## Consequences
- Zero risk of document reformatting or user data corruption.
- Zero runtime dependencies added (saves package weight and avoids licensing/security risks).
- Full compliance with `tsconfig.shared.json` layer isolation.
