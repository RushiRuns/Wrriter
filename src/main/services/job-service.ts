import * as fs from 'fs';
import { JobsStore, PersistentJob } from '../store/jobs-store';
import { JobRunner, JobExecutionCallbacks } from '../../workers/jobs/job-runner';
import { Result, ok, err } from '../../shared/result';
import { IdGenerator, SystemIdGenerator } from '../../shared/id-generator';

export interface JobServiceNotice {
  jobId: string;
  message: string;
}

export class JobService {
  private readonly store: JobsStore;
  private readonly runner: JobRunner;
  private readonly idGen: IdGenerator;
  private isProcessing = false;
  private readonly noticeListeners: ((notice: JobServiceNotice) => void)[] = [];
  private readonly registeredHandlers = new Map<string, JobExecutionCallbacks['fileHandler']>();

  constructor(
    store: JobsStore,
    runner: JobRunner = new JobRunner(),
    idGen: IdGenerator = new SystemIdGenerator()
  ) {
    this.store = store;
    this.runner = runner;
    this.idGen = idGen;
  }

  /**
   * Registers a file handler for a job type so interrupted jobs can resume on startup.
   */
  registerHandler(type: string, handler: JobExecutionCallbacks['fileHandler']): void {
    this.registeredHandlers.set(type, handler);
  }

  onNotice(listener: (notice: JobServiceNotice) => void): () => void {
    this.noticeListeners.push(listener);
    return () => {
      const idx = this.noticeListeners.indexOf(listener);
      if (idx >= 0) this.noticeListeners.splice(idx, 1);
    };
  }

  private dispatchNotice(jobId: string, message: string): void {
    for (const listener of this.noticeListeners) {
      try {
        listener({ jobId, message });
      } catch {}
    }
  }

  /**
   * Resumes and finishes pending jobs on startup.
   */
  async resumePendingJobs(
    vaultId: string,
    defaultHandler: JobExecutionCallbacks['fileHandler'] = async () => null
  ): Promise<void> {
    const jobs = await this.store.loadJobs(vaultId);
    for (const job of jobs) {
      if (job.status === 'pending' || job.status === 'running') {
        // Vault availability check: if vault directory does not exist, wait
        if (!fs.existsSync(job.vaultRoot)) {
          console.warn(`Vault ${job.vaultId} unavailable. Job ${job.id} will wait.`);
          continue;
        }

        console.log(`Resuming interrupted job ${job.id} (${job.completedCount}/${job.files.length} done)...`);
        const handler = this.registeredHandlers.get(job.type) ?? defaultHandler;
        await this.executeJob(job, handler);
      }
    }
  }

  /**
   * Submits and executes a job.
   * Safety invariant: The job is saved to JobsStore BEFORE the first file is touched.
   */
  async submitJob(
    vaultId: string,
    vaultRoot: string,
    type: string,
    files: string[],
    params: Record<string, any>,
    handler?: JobExecutionCallbacks['fileHandler'],
    runInBackground = false
  ): Promise<Result<PersistentJob>> {
    if (!fs.existsSync(vaultRoot)) {
      return err({ kind: 'vaultUnavailable' });
    }

    const effectiveHandler = handler ?? this.registeredHandlers.get(type);
    if (!effectiveHandler) {
      return err({ kind: 'unexpected', message: `No handler registered for job type ${type}` });
    }

    const job: PersistentJob = {
      id: `job-${this.idGen.nextId()}`,
      type,
      vaultId,
      vaultRoot,
      params,
      files,
      completedCount: 0,
      status: 'pending',
      createdAt: Date.now()
    };

    // 1. Write job to store BEFORE first file is touched (ARCHITECTURE.md rule 10)
    const storeRes = await this.store.addJob(job);
    if (!storeRes.ok) return storeRes;

    // 2. Execute job (in background or awaited)
    if (runInBackground) {
      void this.executeJob(job, effectiveHandler);
    } else {
      await this.executeJob(job, effectiveHandler);
    }

    return ok(job);
  }

  private async executeJob(job: PersistentJob, handler: JobExecutionCallbacks['fileHandler']): Promise<void> {
    // Process one job at a time
    while (this.isProcessing) {
      await new Promise(r => setTimeout(r, 50));
    }

    this.isProcessing = true;
    try {
      job.status = 'running';
      await this.store.updateProgress(job.vaultId, job.id, job.completedCount, 'running');

      const result = await this.runner.runJob(job, {
        fileHandler: handler,
        onProgress: async (completed, total) => {
          job.completedCount = completed;
          await this.store.updateProgress(job.vaultId, job.id, completed, 'running');
          const jobLabel = job.type.toLowerCase().includes('tag') ? 'Updating tags' : 'Updating links';
          this.dispatchNotice(job.id, `${jobLabel} ${completed} of ${total}`);
        }
      });

      if (result.ok) {
        job.status = 'completed';
        job.completedCount = job.files.length;
        await this.store.markCompleted(job.vaultId, job.id);
        const jobLabel = job.type.toLowerCase().includes('tag') ? 'updating tags' : 'updating links';
        this.dispatchNotice(job.id, `Finished job ${job.id}: ${jobLabel} (${result.value.processed} files)`);
      }
    } catch (err: any) {
      job.status = 'failed';
      job.error = err?.message ?? 'Unknown job error';
      await this.store.updateProgress(job.vaultId, job.id, job.completedCount, 'failed');
    } finally {
      this.isProcessing = false;
    }
  }
}
