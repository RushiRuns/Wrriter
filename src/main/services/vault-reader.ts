import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err, AppError } from '../../shared/result';
import { extractNotePreviewAndImage } from '../../shared/domain/titles';

export interface NoteContent {
  bytes: Buffer;
  text: string;
  lineEnding: '\r\n' | '\n';
  hasBom: boolean;
  hasFinalNewline: boolean;
}

/**
 * Ensures a relative path resolves strictly within the vault root.
 */
export function resolveInsideVault(vaultRoot: string, relativePath: string): Result<string> {
  const normalizedRoot = path.resolve(vaultRoot);
  const resolved = path.resolve(normalizedRoot, relativePath);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return err({ kind: 'outsideVault' });
  }

  return ok(resolved);
}

export class VaultReader {
  /**
   * Reads a note from the vault with encoding and line-ending detection.
   */
  async read(vaultRoot: string, relativePath: string): Promise<Result<NoteContent>> {
    const resolvedPath = resolveInsideVault(vaultRoot, relativePath);
    if (!resolvedPath.ok) return resolvedPath;

    try {
      const bytes = await fs.promises.readFile(resolvedPath.value);

      // 1. Detect UTF-8 BOM (0xEF, 0xBB, 0xBF)
      const hasBom = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
      const text = hasBom ? bytes.subarray(3).toString('utf8') : bytes.toString('utf8');

      // 2. Detect Line Endings
      const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';

      // 3. Detect Final Newline
      const hasFinalNewline = text.endsWith('\n') || text.endsWith('\r\n');

      return ok({
        bytes,
        text,
        lineEnding,
        hasBom,
        hasFinalNewline
      });
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return err({ kind: 'notFound' });
      }
      if (error?.code === 'EBUSY' || error?.code === 'EPERM') {
        return err({ kind: 'locked', path: relativePath });
      }
      return err({ kind: 'unexpected', message: error?.message ?? 'Failed to read file' });
    }
  }

  /**
   * Reads raw bytes without text parsing.
   */
  async readRawBytes(vaultRoot: string, relativePath: string): Promise<Result<Buffer>> {
    const resolvedPath = resolveInsideVault(vaultRoot, relativePath);
    if (!resolvedPath.ok) return resolvedPath;

    try {
      const bytes = await fs.promises.readFile(resolvedPath.value);
      return ok(bytes);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return err({ kind: 'notFound' });
      return err({ kind: 'unexpected', message: error?.message ?? 'Failed to read bytes' });
    }
  }

  /**
   * Scans the vault for markdown notes (excluding dot folders and attachments),
   * returning notes sorted by modified time descending for list rendering.
   */
  async listNotes(
    vaultRoot: string
  ): Promise<Result<Array<{ path: string; title: string; preview: string; modified: number; hasImage?: boolean | undefined; imageSrc?: string | undefined }>>> {
    try {
      const results: Array<{ path: string; title: string; preview: string; modified: number; hasImage?: boolean | undefined; imageSrc?: string | undefined }> = [];

      const scan = async (currentDir: string, relPrefix = ''): Promise<void> => {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'attachments') {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const stat = await fs.promises.stat(fullPath);
            const title = entry.name.slice(0, -3);
            let preview = '';
            let imageSrc: string | undefined = undefined;
            let hasImage = false;
            try {
              const text = await fs.promises.readFile(fullPath, 'utf8');
              const summary = extractNotePreviewAndImage(text);
              preview = summary.preview;
              imageSrc = summary.imageSrc;
              hasImage = summary.hasImage;
            } catch {
              // fallback if reading fails
            }

            results.push({
              path: relPath,
              title,
              preview,
              hasImage,
              imageSrc,
              modified: stat.mtimeMs
            });
          }
        }
      };

      await scan(vaultRoot);
      results.sort((a, b) => b.modified - a.modified);
      return ok(results);
    } catch (error: any) {
      return ok([]);
    }
  }
}

