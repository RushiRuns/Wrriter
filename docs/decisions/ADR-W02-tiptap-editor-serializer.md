# ADR-W02: TipTap as the One Editor and Block-Preserving Serializer

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 2, 7)

## Context
Wrriter is designed as a live markdown editor with no dual "source" mode. A note opened and closed without edits must remain byte-for-byte identical on disk. Standard rich-text editors often reformat the entire document upon serialization, modifying unedited whitespace, list markers, indentation, and frontmatter.

## Decision
1. **One Editor**: Use TipTap (built on ProseMirror) as the sole live document editor.
2. **Note Text Locality**: Note text lives inside TipTap's editor state and is never mirrored into React state or global stores (ARCHITECTURE.md rule 1).
3. **Block-Preserving Serialization**: Only edited blocks are converted back into markdown (`src/shared/markdown/`). Unedited blocks retain their exact source bytes.
4. **Round-Trip Build Gate**: A round-trip test against a comprehensive suite of sample notes (`tests/samples/`) runs on every build and fails if unedited bytes change or untouched blocks reformat.

## Consequences
- Preserves user formatting, non-standard markdown extensions, comments, frontmatter keys, and line endings.
- Key presses do minimal work: typing does not re-serialize the document.
- Zero risk of document corruption from uncontrolled editor auto-formatting.
