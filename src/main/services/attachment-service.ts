import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Result, ok, err } from '../../shared/result';
import { SafeWriter } from './safe-writer';
import { resolveInsideVault } from './vault-reader';
import {
  computeAttachmentRelativePath,
  decodeAttachmentPath,
  encodeAttachmentPath,
  formatAttachmentClashName,
  formatAttachmentMarkdown,
  formatFileSize,
  getFileTypeBadge,
  isInlineImageExtension,
  resolveAttachmentVaultPath,
  sanitizeAttachmentName
} from '../../shared/domain/attachments';
import { formatPastedImageName } from '../../shared/domain/names';

let electronShell: typeof import('electron').shell | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  electronShell = require('electron').shell;
} catch {
  // Headless test environment
}

export interface SavedAttachment {
  readonly fileName: string;
  readonly relativePath: string;
  readonly encodedPath: string;
  readonly isImage: boolean;
  readonly size: number;
  readonly markdown: string;
}

export interface AttachmentInfo {
  readonly exists: boolean;
  readonly size: number;
  readonly formattedSize: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly absolutePath: string;
}

export interface AttachmentServiceOptions {
  readonly safeWriter: SafeWriter;
  readonly shellOpenPath?: ((fullPath: string) => Promise<string>) | undefined;
  readonly shellShowItemInFolder?: ((fullPath: string) => void) | undefined;
}

export class AttachmentService {
  private readonly safeWriter: SafeWriter;
  private readonly shellOpenPath: ((fullPath: string) => Promise<string>) | undefined;
  private readonly shellShowItemInFolder: ((fullPath: string) => void) | undefined;

  constructor(options: AttachmentServiceOptions) {
    this.safeWriter = options.safeWriter;
    this.shellOpenPath = options.shellOpenPath;
    this.shellShowItemInFolder = options.shellShowItemInFolder;
  }

  /**
   * Saves an attachment buffer into the vault's root attachments/ folder:
   * 1. Reuses an existing file if identical bytes (SHA-256 hash) exist.
   * 2. Sanitizes characters forbidden on Windows.
   * 3. Resolves clashing file names by appending an index number (e.g. report 2.pdf).
   * 4. Writes atomically using SafeWriter.
   * 5. Returns note-relative, percent-encoded markdown syntax.
   */
  async saveAttachment(
    vaultRoot: string,
    noteRelPath: string,
    fileName: string,
    buffer: Buffer
  ): Promise<Result<SavedAttachment>> {
    const attachmentsDir = path.join(vaultRoot, 'attachments');
    try {
      await fs.promises.mkdir(attachmentsDir, { recursive: true });
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to create attachments folder' });
    }

    const incomingHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Check for identical file reuse in attachments/
    try {
      const existingEntries = await fs.promises.readdir(attachmentsDir, { withFileTypes: true });
      for (const entry of existingEntries) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;

        const entryPath = path.join(attachmentsDir, entry.name);
        try {
          const stat = await fs.promises.stat(entryPath);
          if (stat.size === buffer.length) {
            const existingBytes = await fs.promises.readFile(entryPath);
            const existingHash = crypto.createHash('sha256').update(existingBytes).digest('hex');
            if (existingHash === incomingHash) {
              // Identical file reused!
              const reusedFileName = entry.name;
              const relativePath = computeAttachmentRelativePath(noteRelPath, reusedFileName);
              const encodedPath = encodeAttachmentPath(relativePath);
              const isImage = isInlineImageExtension(reusedFileName);
              const markdown = formatAttachmentMarkdown(reusedFileName, relativePath, isImage);

              return ok({
                fileName: reusedFileName,
                relativePath,
                encodedPath,
                isImage,
                size: buffer.length,
                markdown
              });
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Readdir failed, continue with save
    }

    // 2. Sanitize file name for Windows
    const sanitizedBase = sanitizeAttachmentName(fileName);

    // 3. Resolve clashes if name already taken (with different content)
    let finalFileName = sanitizedBase;
    let clashIndex = 2;
    while (fs.existsSync(path.join(attachmentsDir, finalFileName))) {
      finalFileName = formatAttachmentClashName(sanitizedBase, clashIndex);
      clashIndex++;
    }

    // 4. Atomically write to attachments folder
    const writeRes = await this.safeWriter.write(
      vaultRoot,
      `attachments/${finalFileName}`,
      buffer
    );
    if (!writeRes.ok) {
      return writeRes;
    }

    // 5. Format note-relative and percent-encoded paths
    const relativePath = computeAttachmentRelativePath(noteRelPath, finalFileName);
    const encodedPath = encodeAttachmentPath(relativePath);
    const isImage = isInlineImageExtension(finalFileName);
    const markdown = formatAttachmentMarkdown(finalFileName, relativePath, isImage);

    return ok({
      fileName: finalFileName,
      relativePath,
      encodedPath,
      isImage,
      size: buffer.length,
      markdown
    });
  }

  /**
   * Saves a pasted image buffer into the vault's attachments/ folder:
   * Generates standard name: "Pasted image YYYYMMDD-HHmmss.png".
   */
  async savePastedImage(
    vaultRoot: string,
    noteRelPath: string,
    buffer: Buffer
  ): Promise<Result<SavedAttachment>> {
    const defaultName = formatPastedImageName(new Date());
    return this.saveAttachment(vaultRoot, noteRelPath, defaultName, buffer);
  }

  /**
   * Checks whether an attachment exists on disk and returns its file size and metadata.
   */
  async getAttachmentInfo(
    vaultRoot: string,
    noteRelPath: string,
    attachmentRef: string
  ): Promise<Result<AttachmentInfo>> {
    const vaultRelPath = resolveAttachmentVaultPath(noteRelPath, attachmentRef);
    const resolved = resolveInsideVault(vaultRoot, vaultRelPath);
    if (!resolved.ok) {
      return resolved;
    }

    const absPath = resolved.value;
    try {
      const stat = await fs.promises.stat(absPath);
      const fileName = path.basename(absPath);
      return ok({
        exists: true,
        size: stat.size,
        formattedSize: formatFileSize(stat.size),
        fileName,
        fileType: getFileTypeBadge(fileName),
        absolutePath: absPath
      });
    } catch {
      const rawName = path.basename(decodeAttachmentPath(attachmentRef));
      return ok({
        exists: false,
        size: 0,
        formattedSize: '',
        fileName: rawName,
        fileType: getFileTypeBadge(rawName),
        absolutePath: ''
      });
    }
  }

  /**
   * Opens the attachment using the default registered Windows application.
   */
  async openAttachment(
    vaultRoot: string,
    noteRelPath: string,
    attachmentRef: string
  ): Promise<Result<void>> {
    const vaultRelPath = resolveAttachmentVaultPath(noteRelPath, attachmentRef);
    const resolved = resolveInsideVault(vaultRoot, vaultRelPath);
    if (!resolved.ok) return resolved;

    const absPath = resolved.value;
    if (!fs.existsSync(absPath)) {
      return err({ kind: 'notFound' });
    }

    try {
      if (this.shellOpenPath) {
        await this.shellOpenPath(absPath);
      } else if (electronShell?.openPath) {
        await electronShell.openPath(absPath);
      }
      return ok(undefined);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to open attachment' });
    }
  }

  /**
   * Reveals the attachment in Windows File Explorer.
   */
  async showInExplorer(
    vaultRoot: string,
    noteRelPath: string,
    attachmentRef: string
  ): Promise<Result<void>> {
    const vaultRelPath = resolveAttachmentVaultPath(noteRelPath, attachmentRef);
    const resolved = resolveInsideVault(vaultRoot, vaultRelPath);
    if (!resolved.ok) return resolved;

    const absPath = resolved.value;
    if (!fs.existsSync(absPath)) {
      return err({ kind: 'notFound' });
    }

    try {
      if (this.shellShowItemInFolder) {
        this.shellShowItemInFolder(absPath);
      } else if (electronShell?.showItemInFolder) {
        electronShell.showItemInFolder(absPath);
      }
      return ok(undefined);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || 'Failed to reveal in explorer' });
    }
  }
}
