import * as path from 'path';
import { parentPort as threadParentPort } from 'worker_threads';
import { IndexDb, type NoteRecord, type SearchResultItem, type FolderCountItem } from './db';
import { TitleList, type TitleItem } from './titles';
import { Indexer, type IndexProgress, type IndexSummary } from './indexer';
import { ftsEscape } from './fts';

export interface IndexWorkerInitPayload {
  readonly vaultId: string;
  readonly vaultRoot: string;
  readonly appDataDir: string;
  readonly activeFolder?: string | undefined;
}

export interface IndexWorkerGetNotesPayload {
  readonly folder?: string | undefined;
  readonly sortBy?: 'modified' | 'created' | 'title' | undefined;
  readonly after?: { path: string; sortVal: string | number } | null | undefined;
  readonly limit?: number | undefined;
}

export interface IndexWorkerSearchPayload {
  readonly query: string;
  readonly limit?: number | undefined;
}

export type IndexWorkerIncomingMessage =
  | { id: string; type: 'init'; payload: IndexWorkerInitPayload }
  | { id: string; type: 'reindex'; payload?: { activeFolder?: string } }
  | { id: string; type: 'noteChanged'; payload: { path: string } }
  | { id: string; type: 'notesBatchChanged'; payload: { paths: string[] } }
  | { id: string; type: 'noteDeleted'; payload: { path: string } }
  | { id: string; type: 'query.getNotes'; payload: IndexWorkerGetNotesPayload }
  | { id: string; type: 'query.getFolderCounts'; payload?: Record<string, never> }
  | { id: string; type: 'query.getTitleList'; payload?: Record<string, never> }
  | { id: string; type: 'query.search'; payload: IndexWorkerSearchPayload }
  | { id: string; type: 'query.getStatus'; payload?: Record<string, never> }
  | { id: string; type: 'query.getStatuses'; payload?: Record<string, never> }
  | { id: string; type: 'query.getTags'; payload?: Record<string, never> }
  | { id: string; type: 'close'; payload?: Record<string, never> };

export type IndexWorkerOutgoingMessage =
  | { id: string; ok: true; data?: unknown }
  | { id: string; ok: false; error: string }
  | { type: 'progress'; payload: IndexProgress };

/**
 * Encapsulates the Index Worker state machine, dispatching index operations and queries.
 */
export class IndexWorkerCore {
  private db: IndexDb | null = null;
  private titleList: TitleList = new TitleList();
  private indexer: Indexer | null = null;
  private readonly postMessage: (msg: IndexWorkerOutgoingMessage) => void;

  constructor(postMessage: (msg: IndexWorkerOutgoingMessage) => void) {
    this.postMessage = postMessage;
  }

  async handleMessage(msg: IndexWorkerIncomingMessage): Promise<void> {
    const { id, type } = msg;

    try {
      switch (type) {
        case 'init': {
          const { vaultId, vaultRoot, appDataDir, activeFolder } = msg.payload;
          if (this.db) {
            this.db.close();
          }

          const dbPath = path.join(appDataDir, 'index', `${vaultId}.sqlite`);
          this.db = new IndexDb(dbPath);
          this.titleList = new TitleList();

          // Preload title list from db if existing notes present
          const existingNotes = this.db.listNotes({ limit: 100000 });
          const titleItems: TitleItem[] = existingNotes.map((n) => ({
            path: n.path,
            title: n.title,
            mtime_ms: n.mtime_ms
          }));
          this.titleList.init(titleItems);

          this.indexer = new Indexer(vaultRoot, this.db, this.titleList, {
            onProgress: (p) => {
              this.postMessage({ type: 'progress', payload: p });
            }
          });

          this.postMessage({ id, ok: true });

          // Start scan in background (priority on activeFolder)
          void this.indexer.scanAndIndex(activeFolder);
          return;
        }

        case 'reindex': {
          if (!this.indexer) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const summary = await this.indexer.scanAndIndex(msg.payload?.activeFolder);
          this.postMessage({ id, ok: true, data: summary });
          return;
        }

        case 'noteChanged': {
          if (!this.indexer) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          await this.indexer.indexFiles([msg.payload.path]);
          this.postMessage({ id, ok: true });
          return;
        }

        case 'notesBatchChanged': {
          if (!this.indexer) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          this.indexer.queueBatchUpdates(msg.payload.paths);
          this.postMessage({ id, ok: true });
          return;
        }

        case 'noteDeleted': {
          if (!this.indexer) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          this.indexer.deleteFiles([msg.payload.path]);
          this.postMessage({ id, ok: true });
          return;
        }

        case 'query.getNotes': {
          if (!this.db) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const notes = this.db.listNotes(msg.payload);
          this.postMessage({ id, ok: true, data: notes });
          return;
        }

        case 'query.getFolderCounts': {
          if (!this.db) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const counts = this.db.getFolderCounts();
          this.postMessage({ id, ok: true, data: counts });
          return;
        }

        case 'query.getTitleList': {
          const titles = this.titleList.getAll();
          this.postMessage({ id, ok: true, data: titles });
          return;
        }

        case 'query.search': {
          if (!this.db) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const escaped = ftsEscape(msg.payload.query);
          const results = this.db.search(escaped, msg.payload.limit);
          this.postMessage({ id, ok: true, data: results });
          return;
        }

        case 'query.getStatus': {
          const isIndexing = this.indexer?.isIndexing() ?? false;
          const totalNotes = this.db?.totalNotes() ?? 0;
          this.postMessage({ id, ok: true, data: { isIndexing, totalNotes } });
          return;
        }

        case 'query.getStatuses': {
          if (!this.db) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const statuses = this.db.getStatuses();
          this.postMessage({ id, ok: true, data: statuses });
          return;
        }

        case 'query.getTags': {
          if (!this.db) {
            this.postMessage({ id, ok: false, error: 'Index worker not initialized' });
            return;
          }
          const tags = this.db.getTags();
          this.postMessage({ id, ok: true, data: tags });
          return;
        }

        case 'close': {
          if (this.db) {
            this.db.close();
            this.db = null;
          }
          this.postMessage({ id, ok: true });
          return;
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.postMessage({ id, ok: false, error: errorMsg });
    }
  }
}

// 1. Worker threads harness
if (threadParentPort) {
  const core = new IndexWorkerCore((msg) => threadParentPort?.postMessage(msg));
  threadParentPort.on('message', (msg: IndexWorkerIncomingMessage) => {
    void core.handleMessage(msg);
  });
}

// 2. Electron utilityProcess harness (ADR-W11)
if (process.parentPort) {
  const core = new IndexWorkerCore((msg) => process.parentPort?.postMessage(msg));
  process.parentPort.on('message', (e: { data: IndexWorkerIncomingMessage }) => {
    if (e.data) {
      void core.handleMessage(e.data);
    }
  });
}
