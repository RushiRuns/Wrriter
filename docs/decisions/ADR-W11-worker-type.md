# ADR-W11: Worker Type for Index and Job Workers

Status: Accepted  
Decided: Day-One Check (M1 Setup)

## Context
Wrriter runs computationally intensive and synchronous operations in workers to protect the main process from being blocked for more than 50 ms (ARCHITECTURE.md rule 20).
Specifically:
1. `better-sqlite3` runs synchronously in the index worker.
2. The job worker executes multi-file batch writes (`SafeWriter`).

Two worker candidates were evaluated:
- **Node `worker_threads`**: Runs in the same operating system process with separate V8 isolates. Lower IPC latency, but shares the OS process memory space. If a native module crashes or encounters a fatal fault, the entire application crashes.
- **Electron `utilityProcess`**: Runs in an isolated separate operating system process with independent memory and event loop, communicating via `MessagePort` / parentPort.

## Empirical Check Results
In the packaged Electron 39.8.10 application on Windows:
- `better-sqlite3` installed and operated cleanly in both `worker_threads` and `utilityProcess`.
- Queries executed successfully in both environments without compilation requirements or errors.

## Decision
Adopt **Electron `utilityProcess`** for both the Index Worker and Job Worker:
1. **True Process Isolation**: A SQLite crash or heavy garbage collection event in the worker will never destabilize the main Electron process or freeze UI windows.
2. **Architecture Compliance**: Fulfills ARCHITECTURE.md ("Electron runs Wrriter as separate processes. Each one has one job.").
3. **Memory Lifecycle**: An idle `utilityProcess` can be shut down cleanly to reclaim memory when idle in the tray, and spawned on demand.

## Consequences
- Communications across process boundaries use explicit, structured IPC messages through `parentPort`.
- Zero main process blocking during SQLite indexing or job execution.
