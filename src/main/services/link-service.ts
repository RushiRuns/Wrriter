import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err } from '../../shared/result';
import { JobService } from './job-service';
import { IndexClient } from './index-client';
import { VaultReader } from './vault-reader';
import { SafeWriter } from './safe-writer';
import {
  planNoteRenameLinks,
  planFolderRenameLinks,
  planNoteMoveLinks,
  type NoteRenameJobParams,
  type FolderRenameJobParams,
  type NoteMoveJobParams
} from '../../shared/domain/job-plans';
import { deriveFileNameFromTitle } from '../../shared/domain/titles';
import { normalizeSlashes, getParentDir } from '../../shared/domain/image-paths';
import { getFileNameValidationError } from '../../shared/domain/names';

export interface LinkServiceOptions {
  jobService: JobService;
  indexClient?: IndexClient | undefined;
  vaultReader?: VaultReader | undefined;
  safeWriter?: SafeWriter | undefined;
}

export class LinkService {
  private readonly jobService: JobService;
  private readonly indexClient?: IndexClient | undefined;
  private readonly vaultReader: VaultReader;
  private readonly safeWriter: SafeWriter;

  constructor(options: LinkServiceOptions) {
    this.jobService = options.jobService;
    this.indexClient = options.indexClient;
    this.vaultReader = options.vaultReader ?? new VaultReader();
    this.safeWriter = options.safeWriter ?? new SafeWriter();

    // 1. Register note.rename handler so interrupted jobs resume automatically on launch
    this.jobService.registerHandler('note.rename', async (vaultRoot, relPath, params) => {
      const fullPath = path.join(vaultRoot, relPath);
      if (!fs.existsSync(fullPath)) return null;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const plan = planNoteRenameLinks(content, params as NoteRenameJobParams);
      if (!plan.changed) return null;
      return plan.newText;
    });

    // 2. Register folder.rename handler
    this.jobService.registerHandler('folder.rename', async (vaultRoot, relPath, params) => {
      const fullPath = path.join(vaultRoot, relPath);
      if (!fs.existsSync(fullPath)) return null;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const plan = planFolderRenameLinks(content, params as FolderRenameJobParams, relPath);
      if (!plan.changed) return null;
      return plan.newText;
    });

    // 3. Register note.move handler
    this.jobService.registerHandler('note.move', async (vaultRoot, relPath, params) => {
      const fullPath = path.join(vaultRoot, relPath);
      if (!fs.existsSync(fullPath)) return null;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const isMoved = relPath === (params as NoteMoveJobParams).newNoteRelPath;
      const plan = planNoteMoveLinks(content, params as NoteMoveJobParams, isMoved);
      if (!plan.changed) return null;
      return plan.newText;
    });
  }

  /**
   * Renames a note file on disk, updates all links pointing to it via a persistent job,
   * keeping display text (|alias) and heading (#heading) parts byte for byte.
   */
  async renameNoteWithLinks(
    vaultId: string,
    vaultRoot: string,
    oldRelPath: string,
    newRelPath: string
  ): Promise<Result<{ jobId?: string; affectedCount: number }>> {
    const normOld = normalizeSlashes(oldRelPath);
    const normNew = normalizeSlashes(newRelPath);

    const oldFullPath = path.join(vaultRoot, normOld);
    const newFullPath = path.join(vaultRoot, normNew);

    if (!fs.existsSync(oldFullPath)) {
      return err({ kind: 'notFound' });
    }

    // 1. Rename file on disk first
    const newDir = path.dirname(newFullPath);
    if (!fs.existsSync(newDir)) {
      await fs.promises.mkdir(newDir, { recursive: true });
    }

    try {
      await fs.promises.rename(oldFullPath, newFullPath);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to rename note' });
    }

    // Notify index of note rename
    if (this.indexClient) {
      void this.indexClient.noteDeleted(normOld);
      void this.indexClient.noteChanged(normNew);
    }

    // 2. Discover notes containing links to the renamed note
    const oldFileName = path.basename(normOld).replace(/\.md$/i, '');
    const newFileName = path.basename(normNew).replace(/\.md$/i, '');
    const oldPathWithoutMd = normOld.replace(/\.md$/i, '');
    const newPathWithoutMd = normNew.replace(/\.md$/i, '');

    const candidateFiles = new Set<string>();

    if (this.indexClient) {
      const backlinksRes = await this.indexClient.getBacklinks(oldFileName, oldPathWithoutMd);
      if (backlinksRes.ok) {
        for (const bl of backlinksRes.value) {
          if (bl.sourcePath !== normOld && bl.sourcePath !== normNew) {
            candidateFiles.add(bl.sourcePath);
          }
        }
      }
    }

    // If index had no records or for thoroughness, scan vault files
    if (candidateFiles.size === 0) {
      const scanRes = await this.vaultReader.listNotes(vaultRoot);
      if (scanRes.ok) {
        const targetSearch1 = `[[${oldFileName}`;
        const targetSearch2 = `[[${oldPathWithoutMd}`;
        const mdSearch = `(${oldFileName}.md)`;

        for (const note of scanRes.value) {
          if (note.path === normOld || note.path === normNew) continue;
          const readRes = await this.vaultReader.read(vaultRoot, note.path);
          if (readRes.ok) {
            const lower = readRes.value.text.toLowerCase();
            if (
              lower.includes(targetSearch1.toLowerCase()) ||
              lower.includes(targetSearch2.toLowerCase()) ||
              lower.includes(mdSearch.toLowerCase())
            ) {
              candidateFiles.add(note.path);
            }
          }
        }
      }
    }

    const filesToUpdate = Array.from(candidateFiles);
    if (filesToUpdate.length === 0) {
      return ok({ affectedCount: 0 });
    }

    // 3. Submit persistent job
    const params: NoteRenameJobParams = {
      oldTitle: oldFileName,
      newTitle: newFileName,
      oldPath: oldPathWithoutMd,
      newPath: newPathWithoutMd
    };

    const submitRes = await this.jobService.submitJob(
      vaultId,
      vaultRoot,
      'note.rename',
      filesToUpdate,
      params
    );

    if (!submitRes.ok) return submitRes;

    return ok({
      jobId: submitRes.value.id,
      affectedCount: filesToUpdate.length
    });
  }

  /**
   * Renames a folder on disk and returns control at once, while path-style wikilinks
   * and relative image paths are rewritten in the background via a persistent job.
   */
  async renameFolderWithLinks(
    vaultId: string,
    vaultRoot: string,
    oldFolderRelPath: string,
    newFolderRelPath: string
  ): Promise<Result<{ jobId?: string; affectedCount: number }>> {
    const normOld = normalizeSlashes(oldFolderRelPath).replace(/^\/+|\/+$/g, '');
    const normNew = normalizeSlashes(newFolderRelPath).replace(/^\/+|\/+$/g, '');

    const segments = normNew.split('/');
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

    const oldFullPath = path.join(vaultRoot, normOld);
    const newFullPath = path.join(vaultRoot, normNew);

    if (!fs.existsSync(oldFullPath)) {
      return err({ kind: 'notFound' });
    }

    if (fs.existsSync(newFullPath) && normOld.toLowerCase() !== normNew.toLowerCase()) {
      return err({
        kind: 'ruleViolation',
        rule: `Folder "${path.basename(normNew)}" already exists`
      });
    }

    // 1. One rename on disk, control back at once (M3)
    try {
      await fs.promises.rename(oldFullPath, newFullPath);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to rename folder' });
    }

    // 2. Discover notes containing path-style wikilinks or image links to old folder
    const affectedFiles = new Set<string>();
    const scanRes = await this.vaultReader.listNotes(vaultRoot);
    if (scanRes.ok) {
      const searchPattern1 = `[[${normOld}/`;
      const searchPattern2 = `(${normOld}/`;

      for (const note of scanRes.value) {
        // If note was inside the moved folder, its path now starts with normNew
        const isInsideNew = note.path.startsWith(`${normNew}/`);
        const readRes = await this.vaultReader.read(vaultRoot, note.path);
        if (readRes.ok) {
          const text = readRes.value.text;
          if (
            text.includes(searchPattern1) ||
            text.includes(searchPattern2) ||
            isInsideNew
          ) {
            affectedFiles.add(note.path);
          }
        }
      }
    }

    const filesToUpdate = Array.from(affectedFiles);
    if (filesToUpdate.length === 0) {
      return ok({ affectedCount: 0 });
    }

    const params: FolderRenameJobParams = {
      oldFolderRelPath: normOld,
      newFolderRelPath: normNew
    };

    // 3. Run background job (non-blocking)
    const submitRes = await this.jobService.submitJob(
      vaultId,
      vaultRoot,
      'folder.rename',
      filesToUpdate,
      params,
      undefined,
      true
    );

    if (!submitRes.ok) return submitRes;

    return ok({
      jobId: submitRes.value.id,
      affectedCount: filesToUpdate.length
    });
  }

  /**
   * Moves a note between folders, rewriting path-style links in other notes
   * and relative image paths in the moved note itself.
   */
  async moveNoteWithLinks(
    vaultId: string,
    vaultRoot: string,
    oldRelPath: string,
    newRelPath: string
  ): Promise<Result<{ jobId?: string; affectedCount: number }>> {
    const normOld = normalizeSlashes(oldRelPath);
    const normNew = normalizeSlashes(newRelPath);

    const oldFullPath = path.join(vaultRoot, normOld);
    const newFullPath = path.join(vaultRoot, normNew);

    if (!fs.existsSync(oldFullPath)) {
      return err({ kind: 'notFound' });
    }

    const newDir = path.dirname(newFullPath);
    if (!fs.existsSync(newDir)) {
      await fs.promises.mkdir(newDir, { recursive: true });
    }

    try {
      await fs.promises.rename(oldFullPath, newFullPath);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to move note' });
    }

    if (this.indexClient) {
      void this.indexClient.noteDeleted(normOld);
      void this.indexClient.noteChanged(normNew);
    }

    const oldPathWithoutMd = normOld.replace(/\.md$/i, '');
    const newPathWithoutMd = normNew.replace(/\.md$/i, '');

    const affectedFiles = new Set<string>();
    // The moved note itself needs image path rebasing
    affectedFiles.add(normNew);

    const scanRes = await this.vaultReader.listNotes(vaultRoot);
    if (scanRes.ok) {
      const searchLink = `[[${oldPathWithoutMd}`;
      for (const note of scanRes.value) {
        if (note.path === normNew) continue;
        const readRes = await this.vaultReader.read(vaultRoot, note.path);
        if (readRes.ok && readRes.value.text.includes(searchLink)) {
          affectedFiles.add(note.path);
        }
      }
    }

    const params: NoteMoveJobParams = {
      oldNoteRelPath: normOld,
      newNoteRelPath: normNew
    };

    const submitRes = await this.jobService.submitJob(
      vaultId,
      vaultRoot,
      'note.move',
      Array.from(affectedFiles),
      params
    );

    if (!submitRes.ok) return submitRes;

    return ok({
      jobId: submitRes.value.id,
      affectedCount: affectedFiles.size
    });
  }
}
