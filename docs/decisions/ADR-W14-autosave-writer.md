# ADR-W14: Single-Note Autosaves in Main Process vs Jobs Worker

Status: Proposed (Open Item 7)  
Decided: M1 Files on disk and safety

## Context
When typing pauses, Wrriter saves the note to disk. We need to decide whether single-note autosaves are written directly by the main process via `SafeWriter` or delegated over IPC to the background job worker.

## Evaluation
1. **Delegating autosaves to the job worker**:
   - The job worker processes multi-file batch operations (e.g. updating 5,000 wikilinks or moving large folders).
   - If an autosave is queued in the job worker, a single note save could be delayed by several seconds behind a background batch job, risking data loss if the app or computer shuts down.
   - Requires IPC round-trips for every typing pause.
2. **Main process writing single notes via SafeWriter**:
   - SafeWriter performs asynchronous, non-blocking disk I/O via Node's `fs.promises` on the background libuv thread pool.
   - Measured benchmark: reading/writing a 10 KB note takes 0.17 ms, with zero event loop lag (lag monitor confirms 0 ms main thread block).
   - Single-note saves execute immediately without queuing behind batch jobs.
   - If a multi-file batch job is in progress, the note save proceeds independently without contention.

## Decision
1. **Single-note autosaves** are executed directly in the main process by `SafeWriter` asynchronously off the event loop.
2. **Multi-file batch operations** (renaming a note with backlinks, folder moves, tag renames, bulk imports) are executed exclusively by `JobRunner` inside the dedicated `job` worker utilityProcess.

## Consequences
- Single-note typing saves are instantaneous (< 1 ms), completely isolated from long-running batch jobs.
- Zero main thread event loop blockage.
- Maximum safety against data loss on unexpected system shutdown.
