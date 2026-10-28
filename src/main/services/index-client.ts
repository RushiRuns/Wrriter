import * as path from 'path';
import { Result, ok, err } from '../../shared/result';
import type {
  IndexGetNotesArgs,
  IndexSearchArgs,
  IndexSearchResultItem,
  IndexFolderCount,
  IndexTitleItem,
  IndexStatus,
  NoteListItem
} from '../../shared/ipc/contracts';
import type { IndexProgress, IndexSummary } from '../../workers/index/indexer';
import type {
  IndexWorkerIncomingMessage,
  IndexWorkerOutgoingMessage
} from '../../workers/index/index';

export interface IndexWorkerTransport {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (message: unknown) => void): void;
  kill?(): void;
  terminate?(): Promise<number> | void;
}

export interface IndexClientOptions {
  workerScriptPath?: string | undefined;
  transport?: IndexWorkerTransport | undefined;
}

export class IndexClient {
  private transport: IndexWorkerTransport | null = null;
  private readonly workerScriptPath: string;
  private pendingRequests = new Map<
    string,
    { resolve: (data: any) => void; reject: (err: Error) => void }
  >();
  private requestCounter = 0;
  private progressListeners: ((progress: IndexProgress) => void)[] = [];
  private currentStatus: IndexStatus = { isIndexing: false, totalNotes: 0 };
  private isStarted = false;

  constructor(options: IndexClientOptions = {}) {
    this.workerScriptPath =
      options.workerScriptPath ?? path.join(__dirname, '../../workers/index.js');
    if (options.transport) {
      this.attachTransport(options.transport);
    }
  }

  onProgress(listener: (progress: IndexProgress) => void): () => void {
    this.progressListeners.push(listener);
    return () => {
      const idx = this.progressListeners.indexOf(listener);
      if (idx >= 0) this.progressListeners.splice(idx, 1);
    };
  }

  private attachTransport(transport: IndexWorkerTransport): void {
    this.transport = transport;
    this.transport.on('message', (rawMsg: unknown) => {
      const msg = rawMsg as IndexWorkerOutgoingMessage;
      if (!msg) return;

      if ('type' in msg && msg.type === 'progress') {
        this.currentStatus = {
          isIndexing: msg.payload.isIndexing,
          totalNotes: msg.payload.totalCount
        };
        for (const listener of this.progressListeners) {
          try {
            listener(msg.payload);
          } catch {
            // safe skip
          }
        }
        return;
      }

      if ('id' in msg) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.ok) {
            pending.resolve(msg.data);
          } else {
            pending.reject(new Error(msg.error));
          }
        }
      }
    });
  }

  private async ensureTransport(): Promise<IndexWorkerTransport> {
    if (this.transport) {
      return this.transport;
    }

    // Try Electron utilityProcess (ADR-W11)
    try {
      const electron = await import('electron');
      if (electron.utilityProcess && typeof electron.utilityProcess.fork === 'function') {
        const child = electron.utilityProcess.fork(this.workerScriptPath);
        this.attachTransport(child);
        return child;
      }
    } catch {
      // Fallback to worker_threads in Node/test environments
    }

    const { Worker } = await import('worker_threads');
    const worker = new Worker(this.workerScriptPath);
    this.attachTransport(worker);
    return worker;
  }

  private async sendRequest<T>(
    type: IndexWorkerIncomingMessage['type'],
    payload: any
  ): Promise<Result<T>> {
    try {
      const transport = await this.ensureTransport();
      const id = `req-${++this.requestCounter}-${Date.now()}`;

      const promise = new Promise<T>((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
      });

      transport.postMessage({ id, type, payload });
      const result = await promise;
      return ok(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ kind: 'unexpected', message });
    }
  }

  /**
   * Initializes the Index Worker for a specific vault.
   * Starts background indexing (active folder on screen first!).
   */
  async start(
    vaultId: string,
    vaultRoot: string,
    appDataDir: string,
    activeFolder = ''
  ): Promise<Result<void>> {
    this.isStarted = true;
    return this.sendRequest<void>('init', {
      vaultId,
      vaultRoot,
      appDataDir,
      activeFolder
    });
  }

  async reindex(activeFolder = ''): Promise<Result<IndexSummary>> {
    return this.sendRequest<IndexSummary>('reindex', { activeFolder });
  }

  async noteChanged(relPath: string): Promise<Result<void>> {
    return this.sendRequest<void>('noteChanged', { path: relPath });
  }

  async notesBatchChanged(relPaths: string[]): Promise<Result<void>> {
    return this.sendRequest<void>('notesBatchChanged', { paths: relPaths });
  }

  async noteDeleted(relPath: string): Promise<Result<void>> {
    return this.sendRequest<void>('noteDeleted', { path: relPath });
  }

  async getNotes(args: IndexGetNotesArgs = {}): Promise<Result<readonly NoteListItem[]>> {
    return this.sendRequest<readonly NoteListItem[]>('query.getNotes', args);
  }

  async getFolderCounts(): Promise<Result<readonly IndexFolderCount[]>> {
    return this.sendRequest<readonly IndexFolderCount[]>('query.getFolderCounts', {});
  }

  async getTitleList(): Promise<Result<readonly IndexTitleItem[]>> {
    return this.sendRequest<readonly IndexTitleItem[]>('query.getTitleList', {});
  }

  async search(
    query: string,
    limit = 50
  ): Promise<Result<readonly IndexSearchResultItem[]>> {
    return this.sendRequest<readonly IndexSearchResultItem[]>('query.search', {
      query,
      limit
    });
  }

  async getStatus(): Promise<Result<IndexStatus>> {
    if (!this.isStarted) {
      return ok({ isIndexing: false, totalNotes: 0 });
    }
    return this.sendRequest<IndexStatus>('query.getStatus', {});
  }

  async getStatuses(): Promise<Result<readonly string[]>> {
    if (!this.isStarted) {
      return ok([]);
    }
    return this.sendRequest<readonly string[]>('query.getStatuses', {});
  }

  async getTags(): Promise<Result<readonly string[]>> {
    if (!this.isStarted) {
      return ok([]);
    }
    return this.sendRequest<readonly string[]>('query.getTags', {});
  }

  async close(): Promise<void> {
    if (!this.transport) return;
    try {
      await this.sendRequest<void>('close', {});
    } catch {
      // Safe skip
    }
    if (this.transport.kill) {
      this.transport.kill();
    } else if (this.transport.terminate) {
      void this.transport.terminate();
    }
    this.transport = null;
    this.isStarted = false;
  }
}
