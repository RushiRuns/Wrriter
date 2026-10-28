import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err } from '../../shared/result';
import { isValidFileName, isIgnoredDotPath, isAttachmentsFolder, getFileNameValidationError } from '../../shared/domain/names';
import { resolveInsideVault } from './vault-reader';
import { sendToRecycleBin } from '../platform/recycle-bin';
import type { FolderNode } from '../../shared/ipc/contracts';
import type { IndexClient } from './index-client';

export interface FolderServiceOptions {
  indexClient?: IndexClient | undefined;
}

export class FolderService {
  private readonly indexClient?: IndexClient | undefined;

  constructor(options: FolderServiceOptions = {}) {
    this.indexClient = options.indexClient;
  }
  /**
   * Recursively scans folders in vault, ignoring dot-folders and attachments.
   */
  async listFolders(vaultRoot: string): Promise<Result<FolderNode[]>> {
    try {
      if (!fs.existsSync(vaultRoot)) {
        return ok([]);
      }

      // Check if folder counts can be retrieved from index COUNT query (M3)
      let indexCountsMap: Map<string, number> | null = null;
      if (this.indexClient) {
        const countsRes = await this.indexClient.getFolderCounts();
        if (countsRes.ok) {
          indexCountsMap = new Map<string, number>();
          for (const item of countsRes.value) {
            indexCountsMap.set(item.folder, item.count);
          }
        }
      }

      // 1. Recursive scan collecting all folders
      const foldersByRelPath = new Map<string, { name: string; relPath: string; parentPath: string; noteCount: number; children: FolderNode[] }>();

      const scanDir = async (dirFullPath: string, currentRelPath: string): Promise<number> => {
        let noteCountInDir = 0;
        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(dirFullPath, { withFileTypes: true });
        } catch {
          return 0;
        }

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'attachments') {
            continue;
          }

          const childRelPath = currentRelPath ? `${currentRelPath}/${entry.name}` : entry.name;
          const childFullPath = path.join(dirFullPath, entry.name);

          if (entry.isDirectory()) {
            if (isIgnoredDotPath(childRelPath) || isAttachmentsFolder(childRelPath)) {
              continue;
            }

            const folderNode = {
              name: entry.name,
              relPath: childRelPath,
              parentPath: currentRelPath,
              noteCount: 0,
              children: []
            };
            foldersByRelPath.set(childRelPath, folderNode);

            const subNotes = await scanDir(childFullPath, childRelPath);
            // If index count exists, use count from index; otherwise fallback to scan
            folderNode.noteCount = indexCountsMap !== null ? (indexCountsMap.get(childRelPath) ?? 0) : subNotes;
            noteCountInDir += subNotes;
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            noteCountInDir++;
          }
        }

        return noteCountInDir;
      };

      await scanDir(vaultRoot, '');

      // 2. Build tree hierarchy
      const rootFolders: FolderNode[] = [];
      for (const node of foldersByRelPath.values()) {
        if (!node.parentPath) {
          rootFolders.push(node);
        } else {
          const parent = foldersByRelPath.get(node.parentPath);
          if (parent) {
            parent.children.push(node);
          } else {
            rootFolders.push(node);
          }
        }
      }

      // 3. Sort folders alphabetically case-insensitive
      const sortNodes = (nodes: FolderNode[]): void => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' }));
        for (const child of nodes) {
          sortNodes(child.children as FolderNode[]);
        }
      };
      sortNodes(rootFolders);

      return ok(rootFolders);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to list folders' });
    }
  }

  /**
   * Creates a new folder inside the vault.
   */
  async createFolder(vaultRoot: string, folderRelPath: string): Promise<Result<void>> {
    const normalizedRel = folderRelPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const segments = normalizedRel.split('/');
    for (const seg of segments) {
      const segErr = getFileNameValidationError(seg);
      if (segErr) {
        return err({
          kind: 'validation',
          field: 'name',
          reason: segErr
        });
      }
    }
    const folderName = path.basename(normalizedRel);

    const resolved = resolveInsideVault(vaultRoot, normalizedRel);
    if (!resolved.ok) return resolved;

    try {
      if (fs.existsSync(resolved.value)) {
        return err({
          kind: 'ruleViolation',
          rule: `Folder "${folderName}" already exists`
        });
      }

      await fs.promises.mkdir(resolved.value, { recursive: true });
      return ok(undefined);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to create folder' });
    }
  }

  /**
   * Renames a folder inside the vault.
   */
  async renameFolder(vaultRoot: string, oldRelPath: string, newRelPath: string): Promise<Result<void>> {
    const normalizedOld = oldRelPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const normalizedNew = newRelPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const segments = normalizedNew.split('/');
    for (const seg of segments) {
      const segErr = getFileNameValidationError(seg);
      if (segErr) {
        return err({
          kind: 'validation',
          field: 'newPath',
          reason: segErr
        });
      }
    }
    const newName = path.basename(normalizedNew);

    const resolvedOld = resolveInsideVault(vaultRoot, normalizedOld);
    if (!resolvedOld.ok) return resolvedOld;

    const resolvedNew = resolveInsideVault(vaultRoot, normalizedNew);
    if (!resolvedNew.ok) return resolvedNew;

    if (!fs.existsSync(resolvedOld.value)) {
      return err({ kind: 'notFound' });
    }

    if (fs.existsSync(resolvedNew.value) && resolvedOld.value.toLowerCase() !== resolvedNew.value.toLowerCase()) {
      return err({
        kind: 'ruleViolation',
        rule: `Folder "${newName}" already exists`
      });
    }

    try {
      await fs.promises.rename(resolvedOld.value, resolvedNew.value);
      return ok(undefined);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to rename folder' });
    }
  }

  /**
   * Deletes a folder by sending it to the Windows Recycle Bin, returning the count of deleted notes.
   */
  async deleteFolder(vaultRoot: string, folderRelPath: string): Promise<Result<{ noteCount: number }>> {
    const normalizedRel = folderRelPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const resolved = resolveInsideVault(vaultRoot, normalizedRel);
    if (!resolved.ok) return resolved;

    if (!fs.existsSync(resolved.value)) {
      return err({ kind: 'notFound' });
    }

    const noteCount = await this.countNotes(resolved.value);

    // Hard rule: deletion always goes to Windows Recycle Bin
    const recycleRes = await sendToRecycleBin(resolved.value);
    if (!recycleRes.ok) return recycleRes;

    return ok({ noteCount });
  }

  /**
   * Counts all markdown notes within a directory recursively.
   */
  async countNotes(dirFullPath: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.promises.readdir(dirFullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'attachments') continue;
        const full = path.join(dirFullPath, entry.name);
        if (entry.isDirectory()) {
          count += await this.countNotes(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch {
      // Ignore directory scan errors during count
    }
    return count;
  }
}
