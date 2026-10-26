import * as fs from 'fs';
import * as path from 'path';
import { SafeWriter } from '../../main/services/safe-writer';
import { VaultReader } from '../../main/services/vault-reader';
import { PersistentJob } from '../../main/store/jobs-store';
import { Result, ok, err } from '../../shared/result';

export interface JobExecutionCallbacks {
  onProgress?: (completed: number, total: number) => Promise<void>;
  fileHandler: (vaultRoot: string, relPath: string, params: Record<string, any>) => Promise<string | Buffer | null>; // returns null to skip
}

export class JobRunner {
  private readonly safeWriter: SafeWriter;
  private readonly vaultReader: VaultReader;
  private readonly concurrency: number;

  constructor(
    safeWriter: SafeWriter = new SafeWriter(),
    vaultReader: VaultReader = new VaultReader(),
    concurrency = 6 // 4 to 8 files in parallel (ARCHITECTURE.md rule 38)
  ) {
    this.safeWriter = safeWriter;
    this.vaultReader = vaultReader;
    this.concurrency = concurrency;
  }

  /**
   * Executes a job through parallel SafeWriter workers.
   */
  async runJob(job: PersistentJob, callbacks: JobExecutionCallbacks): Promise<Result<{ processed: number; skipped: number }>> {
    const totalFiles = job.files.length;
    let completed = job.completedCount;
    let skipped = 0;
    let tickCounter = 0;

    // Remaining files from where interrupted
    const filesToProcess = job.files.slice(completed);

    // Concurrency pool (process up to `concurrency` in flight)
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < filesToProcess.length) {
        const currentIndex = index++;
        const relPath = filesToProcess[currentIndex]!;
        const fullPath = path.join(job.vaultRoot, relPath);

        // Check file exists
        if (!fs.existsSync(fullPath)) {
          skipped++;
          completed++;
          continue;
        }

        try {
          // Transform file through handler
          const newContent = await callbacks.fileHandler(job.vaultRoot, relPath, job.params);

          if (newContent !== null) {
            // Write atomically through SafeWriter with fsync flush
            const writeRes = await this.safeWriter.write(job.vaultRoot, relPath, newContent);
            if (!writeRes.ok && writeRes.error.kind === 'locked') {
              // Retry locked file with small backoff
              await new Promise(r => setTimeout(r, 100));
              await this.safeWriter.write(job.vaultRoot, relPath, newContent, { maxRetries: 5 });
            }
          }

          completed++;
          tickCounter++;

          // Save ticks in batches of about 100 or when reaching total
          if (tickCounter >= 100 || completed === totalFiles) {
            tickCounter = 0;
            if (callbacks.onProgress) {
              await callbacks.onProgress(completed, totalFiles);
            }
          }
        } catch (err) {
          console.error(`Error processing file ${relPath} in job ${job.id}:`, err);
          skipped++;
          completed++;
        }
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, filesToProcess.length || 1) }, () => worker());
    await Promise.all(workers);

    return ok({ processed: completed, skipped });
  }
}
