import * as fs from 'fs';
import * as path from 'path';
import { IndexDb, type NoteRecord } from './db';
import { TitleList } from './titles';
import { lightIndexNote } from '../../shared/markdown/light-index';

export interface IndexProgress {
  readonly isIndexing: boolean;
  readonly indexedCount: number;
  readonly totalCount: number;
  readonly message: string;
}

export interface IndexSummary {
  readonly totalFound: number;
  readonly indexed: number;
  readonly unchanged: number;
  readonly deleted: number;
}

export interface IndexerOptions {
  readonly batchSize?: number | undefined; // files per transaction (ADR-W15: about 500)
  readonly concurrency?: number | undefined; // files read at a time (M3: about 8)
  readonly progressIntervalMs?: number | undefined; // progress throttling (M3: a few times a second)
  readonly onProgress?: ((progress: IndexProgress) => void) | undefined;
}

export class Indexer {
  private readonly vaultRoot: string;
  private readonly db: IndexDb;
  private readonly titleList: TitleList;
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly progressIntervalMs: number;
  private readonly onProgress: ((progress: IndexProgress) => void) | undefined;

  private isIndexingActive = false;
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private pendingBatchPaths = new Set<string>();

  constructor(
    vaultRoot: string,
    db: IndexDb,
    titleList: TitleList,
    options: IndexerOptions = {}
  ) {
    this.vaultRoot = vaultRoot;
    this.db = db;
    this.titleList = titleList;
    this.batchSize = options.batchSize ?? 500;
    this.concurrency = options.concurrency ?? 8;
    this.progressIntervalMs = options.progressIntervalMs ?? 250;
    this.onProgress = options.onProgress;
  }

  isIndexing(): boolean {
    return this.isIndexingActive;
  }

  /**
   * Scans and indexes the vault.
   * Priority: files in activeFolder are indexed first (the folder on screen first!).
   * Incremental: files with matching mtime and size in IndexDb are skipped (read again only if changed).
   */
  async scanAndIndex(activeFolder = ''): Promise<IndexSummary> {
    this.isIndexingActive = true;
    try {
      // 1. Load existing DB stats into map for O(1) comparison
      const existing = this.db.getAllFileStats();
      const existingMap = new Map<string, { mtime_ms: number; size: number }>();
      for (const stat of existing) {
        existingMap.set(stat.path, { mtime_ms: stat.mtime_ms, size: stat.size });
      }

      // 2. Discover all .md files in the vault
      const normalizedActiveFolder = activeFolder ? activeFolder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
      const priorityFiles: string[] = [];
      const normalFiles: string[] = [];
      const diskFiles = new Set<string>();

      const scanDirectory = async (currentDir: string, relPrefix = ''): Promise<void> => {
        let entries: fs.Dirent[] = [];
        try {
          entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'attachments') {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await scanDirectory(fullPath, relPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            diskFiles.add(relPath);
            const parentFolder = relPrefix;
            if (normalizedActiveFolder && (parentFolder === normalizedActiveFolder || parentFolder.startsWith(`${normalizedActiveFolder}/`))) {
              priorityFiles.push(relPath);
            } else {
              normalFiles.push(relPath);
            }
          }
        }
      };

      await scanDirectory(this.vaultRoot);

      // 3. Purge deleted notes that exist in DB but not on disk
      let deletedCount = 0;
      for (const [existingPath] of existingMap) {
        if (!diskFiles.has(existingPath)) {
          this.db.deleteNote(existingPath);
          this.titleList.remove(existingPath);
          deletedCount++;
        }
      }

      // 4. Filter work queue: only files whose mtime or size changed (or new files)
      const allDiscovered = [...priorityFiles, ...normalFiles];
      const filesToProcess: { relPath: string; stat: fs.Stats }[] = [];
      let unchangedCount = 0;

      for (const relPath of allDiscovered) {
        try {
          const fullPath = path.join(this.vaultRoot, relPath);
          const stat = await fs.promises.stat(fullPath);
          const prev = existingMap.get(relPath);

          if (prev && prev.mtime_ms === stat.mtimeMs && prev.size === stat.size) {
            unchangedCount++;
          } else {
            filesToProcess.push({ relPath, stat });
          }
        } catch {
          // File might have been removed concurrently
        }
      }

      const totalToProcess = filesToProcess.length;
      if (totalToProcess === 0) {
        this.emitProgress(0, 0, false);
        return {
          totalFound: diskFiles.size,
          indexed: 0,
          unchanged: unchangedCount,
          deleted: deletedCount
        };
      }

      // 5. Index work queue in concurrency batches of 8, committing DB in batches of 500
      let indexedCount = 0;
      let lastProgressTime = 0;

      type PreparedItem = {
        note: NoteRecord;
        tags: readonly string[];
        links: readonly string[];
        bodyForSearch: string;
      };

      let pendingTransactionItems: PreparedItem[] = [];

      const flushTransaction = () => {
        if (pendingTransactionItems.length === 0) return;
        const items = pendingTransactionItems;
        pendingTransactionItems = [];
        this.db.runInTransaction(() => {
          for (const item of items) {
            this.db.upsertNote(item.note, item.tags, item.links, item.bodyForSearch);
            this.titleList.set({
              path: item.note.path,
              title: item.note.title,
              mtime_ms: item.note.mtime_ms
            });
          }
        });
      };

      for (let i = 0; i < filesToProcess.length; i += this.concurrency) {
        const slice = filesToProcess.slice(i, i + this.concurrency);
        const parsedResults = await Promise.all(
          slice.map(async ({ relPath, stat }) => {
            try {
              const fullPath = path.join(this.vaultRoot, relPath);
              const text = await fs.promises.readFile(fullPath, 'utf8');
              const parsed = lightIndexNote(relPath, text);

              const noteRecord: NoteRecord = {
                path: relPath,
                title: parsed.title,
                folder: parsed.folder,
                mtime_ms: stat.mtimeMs,
                size: stat.size,
                created: parsed.created,
                status: parsed.status,
                preview: parsed.preview,
                cover_path: parsed.coverPath,
                has_frontmatter: parsed.hasFrontmatter ? 1 : 0
              };

              return {
                note: noteRecord,
                tags: parsed.tags,
                links: parsed.wikilinks,
                bodyForSearch: parsed.bodyForSearch
              };
            } catch {
              return null;
            }
          })
        );

        for (const item of parsedResults) {
          if (item) {
            pendingTransactionItems.push(item);
            indexedCount++;
          }
        }

        // Commit transaction if reached batchSize
        if (pendingTransactionItems.length >= this.batchSize) {
          flushTransaction();
        }

        // Throttle progress emissions (a few times per second)
        const now = Date.now();
        if (now - lastProgressTime >= this.progressIntervalMs) {
          lastProgressTime = now;
          this.emitProgress(indexedCount, totalToProcess, true);
        }
      }

      // Flush remaining items
      flushTransaction();
      this.emitProgress(indexedCount, totalToProcess, false);

      return {
        totalFound: diskFiles.size,
        indexed: indexedCount,
        unchanged: unchangedCount,
        deleted: deletedCount
      };
    } finally {
      this.isIndexingActive = false;
    }
  }

  /**
   * Indexes a specific list of relative file paths.
   */
  async indexFiles(relPaths: string[]): Promise<void> {
    const toUpsert: {
      note: NoteRecord;
      tags: readonly string[];
      links: readonly string[];
      bodyForSearch: string;
    }[] = [];

    for (const relPath of relPaths) {
      const fullPath = path.join(this.vaultRoot, relPath);
      if (!fs.existsSync(fullPath)) {
        this.db.deleteNote(relPath);
        this.titleList.remove(relPath);
        continue;
      }

      try {
        const stat = await fs.promises.stat(fullPath);
        const text = await fs.promises.readFile(fullPath, 'utf8');
        const parsed = lightIndexNote(relPath, text);

        toUpsert.push({
          note: {
            path: relPath,
            title: parsed.title,
            folder: parsed.folder,
            mtime_ms: stat.mtimeMs,
            size: stat.size,
            created: parsed.created,
            status: parsed.status,
            preview: parsed.preview,
            cover_path: parsed.coverPath,
            has_frontmatter: parsed.hasFrontmatter ? 1 : 0
          },
          tags: parsed.tags,
          links: parsed.wikilinks,
          bodyForSearch: parsed.bodyForSearch
        });
      } catch {
        // Skip inaccessible file
      }
    }

    if (toUpsert.length > 0) {
      this.db.runInTransaction(() => {
        for (const item of toUpsert) {
          this.db.upsertNote(item.note, item.tags, item.links, item.bodyForSearch);
          this.titleList.set({
            path: item.note.path,
            title: item.note.title,
            mtime_ms: item.note.mtime_ms
          });
        }
      });
    }
  }

  /**
   * Deletes a list of note paths from DB and memory.
   */
  deleteFiles(relPaths: string[]): void {
    this.db.runInTransaction(() => {
      for (const p of relPaths) {
        this.db.deleteNote(p);
        this.titleList.remove(p);
      }
    });
  }

  /**
   * Batches external file changes (e.g. Syncthing delivering thousands of files at once)
   * to keep the window usable while updating in the background.
   */
  queueBatchUpdates(relPaths: string[]): void {
    for (const p of relPaths) {
      this.pendingBatchPaths.add(p);
    }

    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }

    this.batchUpdateTimer = setTimeout(async () => {
      const paths = Array.from(this.pendingBatchPaths);
      this.pendingBatchPaths.clear();
      this.batchUpdateTimer = null;
      if (paths.length > 0) {
        await this.indexFiles(paths);
      }
    }, 100);
  }

  private emitProgress(indexedCount: number, totalCount: number, isIndexing: boolean): void {
    if (!this.onProgress) return;
    const message = `Indexing ${indexedCount.toLocaleString()} of ${totalCount.toLocaleString()}`;
    this.onProgress({
      isIndexing,
      indexedCount,
      totalCount,
      message
    });
  }
}
