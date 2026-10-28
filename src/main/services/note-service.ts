import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err } from '../../shared/result';
import { SafeWriter, type WriteOutcome } from './safe-writer';
import { VaultReader, type NoteContent as VaultNoteContent } from './vault-reader';
import { OrderService } from './order-service';
import { sendToRecycleBin } from '../platform/recycle-bin';
import { resolveInsideVault } from './vault-reader';
import { sortNotesWithManualOrder, generateKeyBetween } from '../../shared/domain/ordering';
import type { NoteListItem } from '../../shared/ipc/contracts';
import { planSave } from '../../shared/markdown/save';
import type { IndexClient } from './index-client';

export interface NoteServiceOptions {
  safeWriter?: SafeWriter | undefined;
  vaultReader?: VaultReader | undefined;
  orderService?: OrderService | undefined;
  indexClient?: IndexClient | undefined;
}

export class NoteService {
  private readonly safeWriter: SafeWriter;
  private readonly vaultReader: VaultReader;
  private readonly orderService: OrderService;
  private readonly indexClient?: IndexClient | undefined;

  constructor(options: NoteServiceOptions = {}) {
    this.safeWriter = options.safeWriter ?? new SafeWriter();
    this.vaultReader = options.vaultReader ?? new VaultReader();
    this.orderService = options.orderService ?? new OrderService(this.safeWriter);
    this.indexClient = options.indexClient;
  }

  /**
   * Reads a note from disk with encoding and line-ending detection.
   */
  async readNote(vaultRoot: string, noteRelPath: string): Promise<Result<VaultNoteContent>> {
    return this.vaultReader.read(vaultRoot, noteRelPath);
  }

  /**
   * Atomically saves note bytes to disk via planSave and SafeWriter with fsync.
   * Only edited blocks are re-serialized, keeping line endings and BOM intact.
   * If unchanged, skips write without touching disk or modified time.
   */
  async saveNote(vaultRoot: string, noteRelPath: string, text: string): Promise<Result<WriteOutcome>> {
    let writeRes: Result<WriteOutcome>;
    const currentRes = await this.vaultReader.read(vaultRoot, noteRelPath);
    if (currentRes.ok) {
      const plan = planSave(currentRes.value.bytes, text);
      if (plan.unchanged) {
        return ok({ written: false, bytesWritten: 0 });
      }
      writeRes = await this.safeWriter.write(vaultRoot, noteRelPath, Buffer.from(plan.bytes));
    } else {
      writeRes = await this.safeWriter.write(vaultRoot, noteRelPath, text);
    }

    if (writeRes.ok && writeRes.value.written) {
      void this.indexClient?.noteChanged(noteRelPath);
    }
    return writeRes;
  }

  /**
   * Deletes a note by sending it to the native Windows Recycle Bin.
   */
  async deleteNote(vaultRoot: string, noteRelPath: string): Promise<Result<void>> {
    const resolved = resolveInsideVault(vaultRoot, noteRelPath);
    if (!resolved.ok) return resolved;

    if (!fs.existsSync(resolved.value)) {
      return err({ kind: 'notFound' });
    }

    // Remove pin if pinned
    await this.orderService.setPin(vaultRoot, noteRelPath, false);

    const res = await sendToRecycleBin(resolved.value);
    if (res.ok) {
      void this.indexClient?.noteDeleted(noteRelPath);
    }
    return res;
  }

  /**
   * Toggles a note's pinned status in .wrriter/pins.json without altering the note file.
   */
  async setPinned(vaultRoot: string, noteRelPath: string, pinned: boolean): Promise<Result<void>> {
    const res = await this.orderService.setPin(vaultRoot, noteRelPath, pinned);
    if (!res.ok) return res;
    return ok(undefined);
  }

  /**
   * Updates a note's manual sort order in .wrriter/order.json.
   */
  async setOrder(
    vaultRoot: string,
    folderRelPath: string,
    notePath: string,
    beforeKey: string | null = null,
    afterKey: string | null = null
  ): Promise<Result<void>> {
    const newKey = generateKeyBetween(beforeKey, afterKey);
    return this.orderService.setOrderKey(vaultRoot, folderRelPath, notePath, newKey);
  }

  /**
   * Lists notes for a specific folder or the entire vault, applying pins and sorting.
   * Reads from IndexWorker when available for instantaneous results, previews, thumbnails,
   * and sort by created/modified/title/manual (M3).
   */
  async listNotes(
    vaultRoot: string,
    options: {
      folder?: string | undefined;
      tag?: string | undefined;
      sortBy?: 'manual' | 'modified' | 'created' | 'title' | undefined;
    } = {}
  ): Promise<Result<NoteListItem[]>> {
    const folderFilter = options.folder ? options.folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : null;
    const tagFilter = options.tag ? options.tag.trim() : null;
    const sortBy = options.sortBy ?? 'manual';

    const [pins, orderFile] = await Promise.all([
      this.orderService.getPins(vaultRoot),
      this.orderService.getOrderFile(vaultRoot)
    ]);

    // 1. Try reading from index worker if available
    if (this.indexClient) {
      const indexSort = sortBy === 'manual' ? 'modified' : sortBy;
      const indexRes = await this.indexClient.getNotes({
        folder: folderFilter ?? undefined,
        tag: tagFilter ?? undefined,
        sortBy: indexSort
      });

      if (indexRes.ok && indexRes.value.length > 0) {
        const items: NoteListItem[] = indexRes.value.map((n: any) => {
          const normalizedPath = n.path.replace(/\\/g, '/');
          const folderKey = path.posix.dirname(normalizedPath);
          const folderOrder = orderFile.folders[folderKey] ?? {};
          const orderKey = folderOrder[normalizedPath];
          const isPinned = pins.includes(normalizedPath);
          const coverPath = n.cover_path || n.coverPath;

          return {
            path: normalizedPath,
            title: n.title,
            preview: n.preview || '',
            modified: n.mtime_ms ?? n.modified,
            created: n.created,
            pinned: isPinned,
            hasImage: Boolean(coverPath),
            imageSrc: coverPath || undefined,
            orderKey
          };
        });

        // Separate pinned and unpinned, and apply sort
        const pinnedItems = items.filter((i) => i.pinned);
        const unpinnedItems = items.filter((i) => !i.pinned);

        const sortGroup = (group: NoteListItem[]): NoteListItem[] => {
          if (sortBy === 'title') {
            return group.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'accent' }));
          }
          if (sortBy === 'modified') {
            return group.slice().sort((a, b) => b.modified - a.modified);
          }
          if (sortBy === 'created') {
            return group.slice().sort((a, b) => {
              const ca = (a as any).created || '';
              const cb = (b as any).created || '';
              return cb.localeCompare(ca);
            });
          }
          // Manual sorting
          const folderKey = folderFilter ?? '';
          const orderMap = orderFile.folders[folderKey] ?? {};
          return sortNotesWithManualOrder(group, orderMap);
        };

        return ok([...sortGroup(pinnedItems), ...sortGroup(unpinnedItems)]);
      }
    }

    // 2. Fallback to direct vault scan if index not initialized or empty
    const scanRes = await this.vaultReader.listNotes(vaultRoot);
    if (!scanRes.ok) return scanRes;

    const filtered = scanRes.value.filter((note) => {
      const normalizedPath = note.path.replace(/\\/g, '/');
      if (folderFilter === null || folderFilter === '') {
        return true;
      }
      const noteFolder = path.posix.dirname(normalizedPath);
      return noteFolder === folderFilter;
    });

    const items: NoteListItem[] = filtered.map((n) => {
      const normalizedPath = n.path.replace(/\\/g, '/');
      const folderKey = path.posix.dirname(normalizedPath);
      const folderOrder = orderFile.folders[folderKey] ?? {};
      const orderKey = folderOrder[normalizedPath];
      const isPinned = pins.includes(normalizedPath);

      return {
        path: normalizedPath,
        title: n.title,
        preview: n.preview,
        modified: n.modified,
        pinned: isPinned,
        hasImage: n.hasImage ?? false,
        imageSrc: n.imageSrc,
        orderKey
      };
    });

    const pinnedItems = items.filter((i) => i.pinned);
    const unpinnedItems = items.filter((i) => !i.pinned);

    const sortGroup = (group: NoteListItem[]): NoteListItem[] => {
      if (sortBy === 'title') {
        return group.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'accent' }));
      }
      if (sortBy === 'modified') {
        return group.slice().sort((a, b) => b.modified - a.modified);
      }
      // Manual sorting
      const folderKey = folderFilter ?? '';
      const orderMap = orderFile.folders[folderKey] ?? {};
      return sortNotesWithManualOrder(group, orderMap);
    };

    return ok([...sortGroup(pinnedItems), ...sortGroup(unpinnedItems)]);
  }
}
