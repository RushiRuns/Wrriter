import * as fs from 'fs';
import * as path from 'path';
import { SafeWriter } from '../services/safe-writer';
import { Result, ok, err } from '../../shared/result';

export interface PersistentJob {
  id: string;
  type: string;
  vaultId: string;
  vaultRoot: string;
  params: Record<string, any>;
  files: string[];
  completedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: number;
}

export interface JobsDataFile {
  version: number;
  jobs: PersistentJob[];
}

export class JobsStore {
  private readonly jobsDir: string;
  private readonly safeWriter: SafeWriter;

  constructor(appDataDir: string, safeWriter: SafeWriter = new SafeWriter()) {
    this.jobsDir = path.join(appDataDir, 'jobs');
    this.safeWriter = safeWriter;
  }

  private getVaultJobsFile(vaultId: string): string {
    return path.join(this.jobsDir, `${vaultId}.json`);
  }

  async loadJobs(vaultId: string): Promise<PersistentJob[]> {
    const file = this.getVaultJobsFile(vaultId);
    try {
      if (!fs.existsSync(file)) return [];
      const content = await fs.promises.readFile(file, 'utf8');
      const data: JobsDataFile = JSON.parse(content);
      return data.jobs ?? [];
    } catch (e) {
      console.error(`Failed to load jobs for vault ${vaultId}:`, e);
      return [];
    }
  }

  async saveJobs(vaultId: string, jobs: PersistentJob[]): Promise<Result<void>> {
    const file = this.getVaultJobsFile(vaultId);
    const dir = path.dirname(file);
    await fs.promises.mkdir(dir, { recursive: true });

    const data: JobsDataFile = {
      version: 1,
      jobs
    };

    // Save atomically via SafeWriter
    const res = await this.safeWriter.write(dir, `${vaultId}.json`, JSON.stringify(data, null, 2));
    if (!res.ok) return res;
    return ok(undefined);
  }

  /**
   * Appends a new job before the first file is touched.
   */
  async addJob(job: PersistentJob): Promise<Result<void>> {
    const jobs = await this.loadJobs(job.vaultId);
    jobs.push(job);
    return this.saveJobs(job.vaultId, jobs);
  }

  /**
   * Updates progress of a job.
   */
  async updateProgress(vaultId: string, jobId: string, completedCount: number, status: PersistentJob['status'] = 'running'): Promise<Result<void>> {
    const jobs = await this.loadJobs(vaultId);
    const target = jobs.find(j => j.id === jobId);
    if (!target) return err({ kind: 'notFound' });

    target.completedCount = completedCount;
    target.status = status;
    return this.saveJobs(vaultId, jobs);
  }

  /**
   * Removes finished job or marks completed.
   */
  async markCompleted(vaultId: string, jobId: string): Promise<Result<void>> {
    const jobs = await this.loadJobs(vaultId);
    const target = jobs.find(j => j.id === jobId);
    if (target) {
      target.status = 'completed';
      target.completedCount = target.files.length;
    }
    return this.saveJobs(vaultId, jobs);
  }
}
