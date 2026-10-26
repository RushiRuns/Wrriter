import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err, AppError } from '../../shared/result';
import { IdGenerator, SystemIdGenerator } from '../../shared/id-generator';
import { resolveInsideVault } from './vault-reader';

export interface WriteOutcome {
  written: boolean;
  bytesWritten: number;
}

export interface SafeWriteOptions {
  preserveFormatting?: boolean;
  lineEnding?: '\r\n' | '\n';
  hasBom?: boolean;
  hasFinalNewline?: boolean;
  maxRetries?: number;
}

export class SafeWriter {
  // Recent writes cache: path -> expiry timestamp
  private readonly recentWrites = new Map<string, number>();
  private readonly idGen: IdGenerator;

  constructor(idGenerator: IdGenerator = new SystemIdGenerator()) {
    this.idGen = idGenerator;
  }

  /**
   * Checks whether a path was recently written by SafeWriter within ignoreWindowMs.
   * Used by the file watcher adapter to ignore Wrriter's own writes.
   */
  isRecentlyWritten(filePath: string): boolean {
    const normalized = path.resolve(filePath).toLowerCase();
    const expiry = this.recentWrites.get(normalized);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.recentWrites.delete(normalized);
      return false;
    }
    return true;
  }

  /**
   * Records a path in the recent writes cache with a default 1000 ms TTL.
   */
  rememberWrite(filePath: string, ttlMs = 1000): void {
    const normalized = path.resolve(filePath).toLowerCase();
    this.recentWrites.set(normalized, Date.now() + ttlMs);
  }

  /**
   * Atomically writes note bytes to disk:
   * 1. Resolves and checks target is strictly inside vault.
   * 2. Formats bytes (BOM, line endings) if specified.
   * 3. Compares bytes against existing target: if identical, skips write.
   * 4. Writes to a dot-prefixed temp file beside the target note.
   * 5. Flushes file descriptor to disk (handle.sync()).
   * 6. Renames over the target atomically, with retry backoff for locked files.
   * 7. Registers the target in recentWrites so the file watcher ignores it.
   */
  async write(
    vaultRoot: string,
    relativePath: string,
    content: Buffer | string,
    options: SafeWriteOptions = {}
  ): Promise<Result<WriteOutcome>> {
    const resolvedTarget = resolveInsideVault(vaultRoot, relativePath);
    if (!resolvedTarget.ok) return resolvedTarget;

    const targetPath = resolvedTarget.value;
    const targetDir = path.dirname(targetPath);

    // 1. Prepare Buffer
    let finalBuffer: Buffer;
    if (typeof content === 'string') {
      let text = content;
      if (options.lineEnding === '\r\n') {
        text = text.replace(/(?<!\r)\n/g, '\r\n');
      } else if (options.lineEnding === '\n') {
        text = text.replace(/\r\n/g, '\n');
      }

      if (options.hasFinalNewline && !text.endsWith('\n') && !text.endsWith('\r\n')) {
        text += (options.lineEnding ?? '\n');
      }

      const textBytes = Buffer.from(text, 'utf8');
      if (options.hasBom) {
        finalBuffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), textBytes]);
      } else {
        finalBuffer = textBytes;
      }
    } else {
      finalBuffer = content;
    }

    // 2. Byte comparison: Skip write if unchanged
    try {
      const existing = await fs.promises.readFile(targetPath);
      if (existing.equals(finalBuffer)) {
        return ok({ written: false, bytesWritten: 0 });
      }
    } catch {
      // File does not exist yet; continue to write
    }

    // Ensure target directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });

    // 3. Dot-prefixed temp file in the SAME directory
    const tempFileName = `.${path.basename(targetPath)}.${this.idGen.nextId()}.tmp`;
    const tempFilePath = path.join(targetDir, tempFileName);

    let handle: fs.promises.FileHandle | null = null;
    try {
      handle = await fs.promises.open(tempFilePath, 'w');
      await handle.write(finalBuffer);
      // Flush file descriptor to disk before rename (ARCHITECTURE.md rule 2)
      await handle.sync();
      await handle.close();
      handle = null;

      // 4. Atomic rename with lock retry
      const maxRetries = options.maxRetries ?? 3;
      await this.atomicRenameWithRetry(tempFilePath, targetPath, maxRetries);

      // 5. Remember write for watcher ignore window
      this.rememberWrite(targetPath);

      return ok({
        written: true,
        bytesWritten: finalBuffer.length
      });
    } catch (err_: any) {
      // Clean up temp file on failure
      if (handle) {
        try { await handle.close(); } catch {}
      }
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch {}

      if (err_?.code === 'EBUSY' || err_?.code === 'EPERM') {
        return err({ kind: 'locked', path: relativePath });
      }
      if (err_?.code === 'ENOSPC') {
        return err({ kind: 'diskFull' });
      }
      return err({ kind: 'unexpected', message: err_?.message ?? 'Safe write failed' });
    }
  }

  private async atomicRenameWithRetry(source: string, destination: string, retries: number): Promise<void> {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        await fs.promises.rename(source, destination);
        return;
      } catch (error: any) {
        if ((error?.code === 'EBUSY' || error?.code === 'EPERM') && attempt < retries) {
          attempt++;
          // Exponential backoff: 30ms, 60ms, 120ms...
          await new Promise(res => setTimeout(res, 30 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw error;
      }
    }
  }
}
