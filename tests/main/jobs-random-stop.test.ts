import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { JobsStore, PersistentJob } from '../../src/main/store/jobs-store';
import { JobRunner } from '../../src/workers/jobs/job-runner';
import { JobService } from '../../src/main/services/job-service';
import { LinkService } from '../../src/main/services/link-service';
import { TagService } from '../../src/main/services/tag-service';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { TestIdGenerator } from '../../src/shared/id-generator';
import { planNoteRenameLinks, planFolderRenameLinks, planTagRename } from '../../src/shared/domain/job-plans';
import { ok } from '../../src/shared/result';

const TEST_VAULT = path.join(process.cwd(), 'tests/vault-gen/tmp/random-stop-vault');
const TEST_APP_DATA = path.join(process.cwd(), 'tests/vault-gen/tmp/random-stop-appdata');

class MemoryJobRunner extends JobRunner {
  private readonly fileMap: Map<string, string>;

  constructor(fileMap: Map<string, string>) {
    super();
    this.fileMap = fileMap;
  }

  override async runJob(job: PersistentJob, callbacks: any) {
    const totalFiles = job.files.length;
    let completed = job.completedCount;
    let tickCounter = 0;
    const filesToProcess = job.files.slice(completed);

    for (const relPath of filesToProcess) {
      if (!this.fileMap.has(relPath)) {
        completed++;
        continue;
      }
      const newContent = await callbacks.fileHandler(job.vaultRoot, relPath, job.params);
      if (newContent !== null) {
        this.fileMap.set(relPath, typeof newContent === 'string' ? newContent : newContent.toString('utf8'));
      }
      completed++;
      tickCounter++;
      if (tickCounter >= 500 || completed === totalFiles) {
        tickCounter = 0;
        if (callbacks.onProgress) {
          await callbacks.onProgress(completed, totalFiles);
        }
      }
    }
    return ok({ processed: completed, skipped: 0 });
  }
}

describe('M3 Jobs: Random-Stop Tests and Outside Rename Invariants', () => {
  let writer: SafeWriter;
  let reader: VaultReader;
  let store: JobsStore;

  beforeEach(async () => {
    if (fs.existsSync(TEST_VAULT)) await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    if (fs.existsSync(TEST_APP_DATA)) await fs.promises.rm(TEST_APP_DATA, { recursive: true, force: true });

    await fs.promises.mkdir(TEST_VAULT, { recursive: true });
    await fs.promises.mkdir(TEST_APP_DATA, { recursive: true });

    writer = new SafeWriter(new TestIdGenerator());
    reader = new VaultReader();
    store = new JobsStore(TEST_APP_DATA, writer);
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_VAULT)) await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    if (fs.existsSync(TEST_APP_DATA)) await fs.promises.rm(TEST_APP_DATA, { recursive: true, force: true });
  });

  it('Random-stop test (100 times): renaming a note with 5,000 links', async () => {
    // 1. Setup 5,000 files in a mock memory store with diverse link forms
    const TOTAL_FILES = 5000;
    const fileMap = new Map<string, string>();
    const originalBodies = new Map<string, string>();

    const files: string[] = [];
    for (let i = 0; i < TOTAL_FILES; i++) {
      const relPath = `note_${i}.md`;
      files.push(relPath);
      let content = '';
      if (i % 4 === 0) {
        content = `# Header for Note ${i}\nCheck out [[AlphaNote]] for details.\nUnique paragraph ${i}.\n`;
      } else if (i % 4 === 1) {
        content = `# Header for Note ${i}\nSee [[AlphaNote|Custom Title]] for docs.\nExtra text ${i}.\n`;
      } else if (i % 4 === 2) {
        content = `# Header for Note ${i}\nJump to [[AlphaNote#Installation]] section.\nMore info ${i}.\n`;
      } else {
        content = `# Header for Note ${i}\nRead [Alpha doc](AlphaNote.md) here.\nClosing line ${i}.\n`;
      }
      fileMap.set(relPath, content);
      originalBodies.set(relPath, content);
    }

    const renameParams = {
      oldTitle: 'AlphaNote',
      newTitle: 'BetaNote',
      oldPath: 'AlphaNote',
      newPath: 'BetaNote'
    };

    // 2. Perform 100 random interruption and restart simulations
    for (let run = 0; run < 100; run++) {
      // Pick a random interruption point between 1 and TOTAL_FILES - 1
      const interruptAt = Math.floor(Math.random() * (TOTAL_FILES - 1)) + 1;

      // Reset fileMap to initial state for each iteration run
      for (const [relPath, orig] of originalBodies.entries()) {
        fileMap.set(relPath, orig);
      }

      // Simulate partial processing up to interruptAt
      for (let i = 0; i < interruptAt; i++) {
        const relPath = files[i]!;
        const text = fileMap.get(relPath)!;
        const planned = planNoteRenameLinks(text, renameParams);
        if (planned.changed) {
          fileMap.set(relPath, planned.newText);
        }
      }

      // Write simulated interrupted job state to JobsStore (jobs/<vaultId>.json)
      const interruptedJob: PersistentJob = {
        id: `job-rename-stop-${run}`,
        type: 'note.rename',
        vaultId: 'test-vault',
        vaultRoot: TEST_VAULT,
        params: renameParams,
        files,
        completedCount: interruptAt,
        status: 'running',
        createdAt: Date.now()
      };
      await store.saveJobs('test-vault', [interruptedJob]);

      // Restart: instantiate a new JobService simulating app restart
      let service = new JobService(store, new MemoryJobRunner(fileMap), new TestIdGenerator());
      service.registerHandler('note.rename', async (_root, relPath, params) => {
        const text = fileMap.get(relPath);
        if (!text) return null;
        const planned = planNoteRenameLinks(text, params as any);
        if (!planned.changed) return null;
        fileMap.set(relPath, planned.newText);
        return planned.newText;
      });

      // Resume pending jobs from the checkpoint
      await service.resumePendingJobs('test-vault');

      // Verify: after resume, EVERY single one of the 5,000 files has the updated link
      // and nothing else in any note was changed
      for (let i = 0; i < TOTAL_FILES; i++) {
        const relPath = files[i]!;
        const currentText = fileMap.get(relPath)!;

        // Must not contain old AlphaNote
        expect(currentText).not.toContain('AlphaNote');
        expect(currentText).toContain('BetaNote');

        if (i % 4 === 0) {
          expect(currentText).toBe(`# Header for Note ${i}\nCheck out [[BetaNote]] for details.\nUnique paragraph ${i}.\n`);
        } else if (i % 4 === 1) {
          expect(currentText).toBe(`# Header for Note ${i}\nSee [[BetaNote|Custom Title]] for docs.\nExtra text ${i}.\n`);
        } else if (i % 4 === 2) {
          expect(currentText).toBe(`# Header for Note ${i}\nJump to [[BetaNote#Installation]] section.\nMore info ${i}.\n`);
        } else {
          expect(currentText).toBe(`# Header for Note ${i}\nRead [Alpha doc](BetaNote.md) here.\nClosing line ${i}.\n`);
        }
      }

      // Verify job is marked completed in store
      const savedJobs = await store.loadJobs('test-vault');
      const loaded = savedJobs.find(j => j.id === interruptedJob.id);
      expect(loaded?.status).toBe('completed');
      expect(loaded?.completedCount).toBe(TOTAL_FILES);
    }
  }, 60000);

  it('Random-stop test (100 times): moving a folder of 5,000 notes', async () => {
    const TOTAL_FILES = 5000;
    const fileMap = new Map<string, string>();
    const originalBodies = new Map<string, string>();

    const files: string[] = [];
    for (let i = 0; i < TOTAL_FILES; i++) {
      const relPath = `docs/note_${i}.md`;
      files.push(relPath);
      let content = '';
      if (i % 2 === 0) {
        content = `# Note ${i}\nLink: [[Docs/OldProject/item_${i}]]\nParagraph ${i}.\n`;
      } else {
        content = `# Note ${i}\nImage: ![fig](Docs/OldProject/assets/img_${i}.png)\nParagraph ${i}.\n`;
      }
      fileMap.set(relPath, content);
      originalBodies.set(relPath, content);
    }

    const folderParams = {
      oldFolderRelPath: 'Docs/OldProject',
      newFolderRelPath: 'Docs/NewProject'
    };

    for (let run = 0; run < 100; run++) {
      const interruptAt = Math.floor(Math.random() * (TOTAL_FILES - 1)) + 1;

      for (const [relPath, orig] of originalBodies.entries()) {
        fileMap.set(relPath, orig);
      }

      for (let i = 0; i < interruptAt; i++) {
        const relPath = files[i]!;
        const text = fileMap.get(relPath)!;
        const planned = planFolderRenameLinks(text, folderParams, relPath);
        if (planned.changed) {
          fileMap.set(relPath, planned.newText);
        }
      }

      const interruptedJob: PersistentJob = {
        id: `job-folder-stop-${run}`,
        type: 'folder.rename',
        vaultId: 'test-vault',
        vaultRoot: TEST_VAULT,
        params: folderParams,
        files,
        completedCount: interruptAt,
        status: 'running',
        createdAt: Date.now()
      };
      await store.saveJobs('test-vault', [interruptedJob]);

      let service = new JobService(store, new MemoryJobRunner(fileMap), new TestIdGenerator());
      service.registerHandler('folder.rename', async (_root, relPath, params) => {
        const text = fileMap.get(relPath);
        if (!text) return null;
        const planned = planFolderRenameLinks(text, params as any, relPath);
        if (!planned.changed) return null;
        fileMap.set(relPath, planned.newText);
        return planned.newText;
      });

      await service.resumePendingJobs('test-vault');

      // Verify every link was rewritten and nothing else changed
      for (let i = 0; i < TOTAL_FILES; i++) {
        const relPath = files[i]!;
        const currentText = fileMap.get(relPath)!;
        expect(currentText).not.toContain('Docs/OldProject');
        expect(currentText).toContain('Docs/NewProject');

        if (i % 2 === 0) {
          expect(currentText).toBe(`# Note ${i}\nLink: [[Docs/NewProject/item_${i}]]\nParagraph ${i}.\n`);
        } else {
          expect(currentText).toBe(`# Note ${i}\nImage: ![fig](Docs/NewProject/assets/img_${i}.png)\nParagraph ${i}.\n`);
        }
      }

      const savedJobs = await store.loadJobs('test-vault');
      const loaded = savedJobs.find(j => j.id === interruptedJob.id);
      expect(loaded?.status).toBe('completed');
      expect(loaded?.completedCount).toBe(TOTAL_FILES);
    }
  }, 60000);

  it('Random-stop test (100 times): renaming a tag used by 5,000 notes', async () => {
    const TOTAL_FILES = 5000;
    const fileMap = new Map<string, string>();
    const originalBodies = new Map<string, string>();

    const files: string[] = [];
    for (let i = 0; i < TOTAL_FILES; i++) {
      const relPath = `tagged_${i}.md`;
      files.push(relPath);
      const content =
        `---\n` +
        `status: in-progress\n` +
        `tags:\n` +
        `  - work\n` +
        `  - project/alpha\n` +
        `author: Krishna\n` +
        `---\n` +
        `# Note Title ${i}\n` +
        `This is body content for note ${i}.\n`;

      fileMap.set(relPath, content);
      originalBodies.set(relPath, content);
    }

    const tagParams = {
      oldTag: 'project/alpha',
      newTag: 'project/omega'
    };

    for (let run = 0; run < 100; run++) {
      const interruptAt = Math.floor(Math.random() * (TOTAL_FILES - 1)) + 1;

      for (const [relPath, orig] of originalBodies.entries()) {
        fileMap.set(relPath, orig);
      }

      for (let i = 0; i < interruptAt; i++) {
        const relPath = files[i]!;
        const text = fileMap.get(relPath)!;
        const planned = planTagRename(text, tagParams);
        if (planned.changed) {
          fileMap.set(relPath, planned.newText);
        }
      }

      const interruptedJob: PersistentJob = {
        id: `job-tag-stop-${run}`,
        type: 'tag.rename',
        vaultId: 'test-vault',
        vaultRoot: TEST_VAULT,
        params: tagParams,
        files,
        completedCount: interruptAt,
        status: 'running',
        createdAt: Date.now()
      };
      await store.saveJobs('test-vault', [interruptedJob]);

      let service = new JobService(store, new MemoryJobRunner(fileMap), new TestIdGenerator());
      service.registerHandler('tag.rename', async (_root, relPath, params) => {
        const text = fileMap.get(relPath);
        if (!text) return null;
        const planned = planTagRename(text, params as any);
        if (!planned.changed) return null;
        fileMap.set(relPath, planned.newText);
        return planned.newText;
      });

      await service.resumePendingJobs('test-vault');

      // Verify: after resume, all 5,000 notes have project/omega and all other keys/body are unchanged
      for (let i = 0; i < TOTAL_FILES; i++) {
        const relPath = files[i]!;
        const currentText = fileMap.get(relPath)!;
        expect(currentText).not.toContain('project/alpha');
        expect(currentText).toContain('project/omega');
        expect(currentText).toContain('status: in-progress');
        expect(currentText).toContain('author: Krishna');
        expect(currentText).toContain(`# Note Title ${i}\nThis is body content for note ${i}.\n`);
      }

      const savedJobs = await store.loadJobs('test-vault');
      const loaded = savedJobs.find(j => j.id === interruptedJob.id);
      expect(loaded?.status).toBe('completed');
      expect(loaded?.completedCount).toBe(TOTAL_FILES);
    }
  }, 60000);

  it('A rename done outside Wrriter updates no links', async () => {
    // 1. Create SourceNote.md and ReferencingNote.md directly on disk
    const sourcePath = path.join(TEST_VAULT, 'OutsideSource.md');
    const refPath = path.join(TEST_VAULT, 'OutsideRef.md');

    await fs.promises.writeFile(sourcePath, '# Source Note\nHello world');
    const originalRefContent = '# Referencing Note\nLinking to [[OutsideSource]] right here.\nDo not change.';
    await fs.promises.writeFile(refPath, originalRefContent);

    // 2. Perform external rename on disk (e.g. by Windows Explorer or Syncthing)
    const renamedSourcePath = path.join(TEST_VAULT, 'RenamedOutside.md');
    await fs.promises.rename(sourcePath, renamedSourcePath);

    // 3. Confirm that JobsStore has zero pending or running jobs
    const pendingJobs = await store.loadJobs('test-vault');
    expect(pendingJobs.length).toBe(0);

    // 4. Verify that OutsideRef.md was completely untouched on disk
    const currentRefContent = await fs.promises.readFile(refPath, 'utf8');
    expect(currentRefContent).toBe(originalRefContent);
  });
});
