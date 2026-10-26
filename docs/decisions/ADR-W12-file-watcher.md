# ADR-W12: File Watcher Library and Rescan Fallback

Status: Accepted  
Decided: Day-One Check (M1 Setup)

## Context
Wrriter stores notes as plain markdown files on disk. Outside changes made by the user, File Explorer, or Syncthing must be picked up without a restart.
The watcher must scale to vaults of 50,000 files without freezing, leaking memory, or dropping events.

Three candidates were tested on 50,000 files across 10 folders:
1. **Node's native `fs.watch({ recursive: true })`**
2. **`@parcel/watcher` (C++ native `ReadDirectoryChangesW` on Windows)**
3. **`chokidar` (pure JS directory walker / watcher)**

## Empirical Check Results
Measured against 50,000 files in `tests/vault-gen/test-watcher-50k.js`:
- **`fs.watch`**:
  - Received only **2 events** out of 100 file edits.
  - Severe event dropping due to Windows internal buffer overflow on large directories.
- **`@parcel/watcher`**:
  - Subscribed instantly (< 100 ms).
  - Received **100 out of 100 events** accurately.
  - Memory footprint overhead: **~2.91 MB**.
- **`chokidar`**:
  - Required **50,433 ms (50.4 seconds)** to become ready on 50,000 files.
  - Consumed **387.35 MB of RAM**.
- **Fallback Full Rescan**:
  - A full filesystem scan by modified time and size across 50,000 files completed in **990 ms** (< 1 second).

## Decision
1. **Primary Watcher**: Use **`@parcel/watcher`** as the watcher engine.
2. **Fallback Mechanism**: Implement the full rescan strategy by modified time and size whenever the watcher detects lost events or reconnects, guaranteed to complete in ~1 second.
3. **Write Debounce**: Batch arriving events into a single queue and ignore Wrriter's own writes temporarily via `SafeWriter` notifications.

## Consequences
- Fast watcher startup with minimal memory overhead (< 3 MB vs nearly 400 MB for chokidar).
- Reliable real-time event capture with proven sub-second full rescan fallback.
