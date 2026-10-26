# ADR-W05: SafeWriter and the Pending Jobs List

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 6, 7)

## Context
Filesystem writes risk partial writes, process crashes mid-save, file lock collisions on Windows (e.g. antivirus or backup tools holding open handles), and inconsistent multi-file modifications (such as updating 5,000 links across a vault during note rename).

## Decision
1. **SafeWriter Single Writer**: All vault file writes must go through `SafeWriter`.
   - Writes to a dot-prefixed temporary file adjacent to the target file.
   - Flushes content to disk (fsync).
   - Atomically renames over the target file.
   - Preserves original byte-order marks (BOM) and line endings (CRLF vs LF).
   - Performs a byte comparison first; if bytes have not changed, zero disk writes occur.
   - Notifies the file watcher to ignore Wrriter's own writes temporarily.
   - Retries locked files with in-memory text retained until save succeeds.
2. **Pending Jobs List**: Any multi-file modification (link updates, folder moves, tag renames, bulk imports) must write a complete job plan to disk in the app data folder *before* modifying any file.
3. **Run-to-Completion**: If the application terminates midway through a job, the job is resumed and completed upon restart. Half-finished jobs are never undone.

## Consequences
- Guaranteed zero note corruption even if power is lost mid-save.
- Multi-file refactorings are fully resilient to unexpected process termination.
- Watcher echo loops are completely eliminated.
