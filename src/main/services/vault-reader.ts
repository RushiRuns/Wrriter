import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err, AppError } from '../../shared/result';

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
}
