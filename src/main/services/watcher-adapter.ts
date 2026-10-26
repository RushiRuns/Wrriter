import * as fs from 'fs';
import * as path from 'path';
import * as parcelWatcher from '@parcel/watcher';
import { SafeWriter } from './safe-writer';
import { isIgnoredDotPath } from '../../shared/domain/names';

export type WatcherEventType = 'create' | 'update' | 'delete';

export interface WatcherEvent {
  type: WatcherEventType;
  path: string;
}

export interface WatcherCallbacks {
  onEvents: (events: WatcherEvent[]) => void;
  onRescanNeeded: () => void;
}

export interface FileSnapshot {
  mtimeMs: number;
  size: number;
}

export class WatcherAdapter {
  private subscription: parcelWatcher.AsyncSubscription | null = null;
  private eventBatch: WatcherEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;

  constructor(
    private readonly vaultRoot: string,
    private readonly safeWriter: SafeWriter,
    private readonly callbacks: WatcherCallbacks,
    debounceMs = 60
  ) {
    this.debounceMs = debounceMs;
  }

  /**
   * Starts watching the vault directory.
   */
  async start(): Promise<void> {
    if (this.subscription) return;

    try {
      this.subscription = await parcelWatcher.subscribe(
        this.vaultRoot,
        (err, events) => {
          if (err) {
            console.error('Watcher error, triggering full rescan fallback:', err);
            this.callbacks.onRescanNeeded();
            return;
          }
          this.handleRawEvents(events);
        },
        {
          ignore: [
            '**/.git/**',
            '**/.obsidian/**',
            '**/.stfolder/**',
            '**/.stversions/**',
            '**/.wrriter/**',
            '**/*.tmp'
          ]
        }
      );
    } catch (error) {
      console.error('Failed to start native parcel watcher:', error);
      this.callbacks.onRescanNeeded();
    }
  }

  /**
   * Stops watching and cleans up resources.
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private handleRawEvents(events: parcelWatcher.Event[]): void {
    for (const ev of events) {
      const relPath = path.relative(this.vaultRoot, ev.path);

      // Skip ignored dot folders
      if (isIgnoredDotPath(relPath)) continue;

      // Skip Wrriter's own recent writes (ARCHITECTURE.md rule 20)
      if (this.safeWriter.isRecentlyWritten(ev.path)) continue;

      this.eventBatch.push({
        type: ev.type,
        path: relPath.replace(/\\/g, '/')
      });
    }

    if (this.eventBatch.length > 0 && !this.debounceTimer) {
      this.debounceTimer = setTimeout(() => {
        this.flushBatch();
      }, this.debounceMs);
    }
  }

  private flushBatch(): void {
    this.debounceTimer = null;
    if (this.eventBatch.length === 0) return;

    const toDispatch = this.eventBatch;
    this.eventBatch = [];
    this.callbacks.onEvents(toDispatch);
  }

  /**
   * Fast full filesystem rescan:
   * Scans 50,000 files by modified time and size in ~1 second (ADR-W12).
   */
  static async fullRescan(
    vaultRoot: string,
    previousSnapshot: Map<string, FileSnapshot>
  ): Promise<{
    changed: string[];
    created: string[];
    deleted: string[];
    newSnapshot: Map<string, FileSnapshot>;
  }> {
    const newSnapshot = new Map<string, FileSnapshot>();
    const created: string[] = [];
    const changed: string[] = [];
    const deleted: string[] = [];

    async function scanDir(currentDir: string): Promise<void> {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.wrriter') continue;

        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(vaultRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const stats = await fs.promises.stat(fullPath);
            const currentSnap: FileSnapshot = { mtimeMs: stats.mtimeMs, size: stats.size };
            newSnapshot.set(relPath, currentSnap);

            const prev = previousSnapshot.get(relPath);
            if (!prev) {
              created.push(relPath);
            } else if (prev.mtimeMs !== stats.mtimeMs || prev.size !== stats.size) {
              changed.push(relPath);
            }
          } catch {}
        }
      }
    }

    await scanDir(vaultRoot);

    for (const oldPath of previousSnapshot.keys()) {
      if (!newSnapshot.has(oldPath)) {
        deleted.push(oldPath);
      }
    }

    return { changed, created, deleted, newSnapshot };
  }
}
