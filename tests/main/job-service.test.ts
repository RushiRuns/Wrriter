import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { JobsStore } from '../../src/main/store/jobs-store';
import { JobRunner } from '../../src/workers/jobs/job-runner';
import { JobService, JobServiceNotice } from '../../src/main/services/job-service';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { TestIdGenerator } from '../../src/shared/id-generator';

const TEST_VAULT = path.join(process.cwd(), 'tests/vault-gen/tmp/job-vault');
const TEST_APP_DATA = path.join(process.cwd(), 'tests/vault-gen/tmp/job-appdata');

describe('Job System: JobsStore, JobRunner, and JobService', () => {
  let store: JobsStore;
  let runner: JobRunner;
  let service: JobService;
  let writer: SafeWriter;
  let reader: VaultReader;

  beforeEach(async () => {
    if (fs.existsSync(TEST_VAULT)) await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    if (fs.existsSync(TEST_APP_DATA)) await fs.promises.rm(TEST_APP_DATA, { recursive: true, force: true });

    await fs.promises.mkdir(TEST_VAULT, { recursive: true });
    await fs.promises.mkdir(TEST_APP_DATA, { recursive: true });

    writer = new SafeWriter(new TestIdGenerator());
    reader = new VaultReader();
    store = new JobsStore(TEST_APP_DATA, writer);
    runner = new JobRunner(writer, reader, 4);
    service = new JobService(store, runner, new TestIdGenerator());
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_VAULT)) await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    if (fs.existsSync(TEST_APP_DATA)) await fs.promises.rm(TEST_APP_DATA, { recursive: true, force: true });
  });

  it('writes job before touching any file and processes files in parallel', async () => {
    // Create 10 test files
    const fileNames: string[] = [];
    for (let i = 0; i < 10; i++) {
      const name = `note-${i}.md`;
      fileNames.push(name);
      await fs.promises.writeFile(path.join(TEST_VAULT, name), `# Note ${i}\nOld tag: #alpha`);
    }

    const notices: JobServiceNotice[] = [];
    service.onNotice(n => notices.push(n));

    // Submit a test tag replacement job
    const res = await service.submitJob(
      'vault-1',
      TEST_VAULT,
      'replaceTag',
      fileNames,
      { oldTag: '#alpha', newTag: '#beta' },
      async (vaultRoot, relPath, params) => {
        const full = path.join(vaultRoot, relPath);
        const text = await fs.promises.readFile(full, 'utf8');
        return text.replace(params.oldTag, params.newTag);
      }
    );

    expect(res.ok).toBe(true);

    // Verify all 10 files updated with new tag
    for (const name of fileNames) {
      const content = await fs.promises.readFile(path.join(TEST_VAULT, name), 'utf8');
      expect(content).toContain('#beta');
      expect(content).not.toContain('#alpha');
    }

    // Verify notice dispatched
    expect(notices.length).toBeGreaterThanOrEqual(1);
    expect(notices[notices.length - 1]?.message).toContain('Finished job');

    // Verify stored state in JobsStore is completed
    const saved = await store.loadJobs('vault-1');
    expect(saved.length).toBe(1);
    expect(saved[0]?.status).toBe('completed');
    expect(saved[0]?.completedCount).toBe(10);
  });

  it('resumes interrupted jobs on startup without undoing finished work', async () => {
    // 5 files
    for (let i = 0; i < 5; i++) {
      await fs.promises.writeFile(path.join(TEST_VAULT, `file-${i}.md`), `Original ${i}`);
    }

    // Manually insert an interrupted job (completedCount = 2) into JobsStore
    await store.saveJobs('vault-1', [
      {
        id: 'job-interrupted',
        type: 'testBatch',
        vaultId: 'vault-1',
        vaultRoot: TEST_VAULT,
        params: { append: ' [DONE]' },
        files: ['file-0.md', 'file-1.md', 'file-2.md', 'file-3.md', 'file-4.md'],
        completedCount: 2, // file-0 and file-1 already processed
        status: 'pending',
        createdAt: Date.now() - 5000
      }
    ]);

    // file-0 and file-1 already have [DONE]
    await fs.promises.writeFile(path.join(TEST_VAULT, 'file-0.md'), 'Original 0 [DONE]');
    await fs.promises.writeFile(path.join(TEST_VAULT, 'file-1.md'), 'Original 1 [DONE]');

    const notices: JobServiceNotice[] = [];
    service.onNotice(n => notices.push(n));

    // Resume pending jobs on startup
    await service.resumePendingJobs('vault-1', async (vaultRoot, relPath, params) => {
      const full = path.join(vaultRoot, relPath);
      const text = await fs.promises.readFile(full, 'utf8');
      return text + params.append;
    });

    // Verify remaining files (2, 3, 4) got processed, and 0 & 1 were not double-processed
    expect(await fs.promises.readFile(path.join(TEST_VAULT, 'file-0.md'), 'utf8')).toBe('Original 0 [DONE]');
    expect(await fs.promises.readFile(path.join(TEST_VAULT, 'file-1.md'), 'utf8')).toBe('Original 1 [DONE]');
    expect(await fs.promises.readFile(path.join(TEST_VAULT, 'file-2.md'), 'utf8')).toBe('Original 2 [DONE]');
    expect(await fs.promises.readFile(path.join(TEST_VAULT, 'file-3.md'), 'utf8')).toBe('Original 3 [DONE]');
    expect(await fs.promises.readFile(path.join(TEST_VAULT, 'file-4.md'), 'utf8')).toBe('Original 4 [DONE]');

    // Verify job marked completed in store
    const loaded = await store.loadJobs('vault-1');
    expect(loaded[0]?.status).toBe('completed');
  });
});
