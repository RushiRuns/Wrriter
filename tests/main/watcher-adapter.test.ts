import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WatcherAdapter, FileSnapshot } from '../../src/main/services/watcher-adapter';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { TestIdGenerator } from '../../src/shared/id-generator';

const TEST_DIR = path.join(process.cwd(), 'tests/vault-gen/tmp/watcher-test-vault');

describe('WatcherAdapter and Rescan Fallback', () => {
  let writer: SafeWriter;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    }
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
    writer = new SafeWriter(new TestIdGenerator());
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_DIR)) {
      await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('performs full rescan detecting created, changed, and deleted files', async () => {
    const fileA = path.join(TEST_DIR, 'FileA.md');
    const fileB = path.join(TEST_DIR, 'FileB.md');

    await fs.promises.writeFile(fileA, 'Initial A');
    await fs.promises.writeFile(fileB, 'Initial B');

    // 1. Initial baseline scan
    const snap1 = await WatcherAdapter.fullRescan(TEST_DIR, new Map());
    expect(snap1.created.length).toBe(2);
    expect(snap1.changed.length).toBe(0);
    expect(snap1.deleted.length).toBe(0);

    // 2. Modify FileA, delete FileB, create FileC
    // Wait small delta so mtime changes
    await new Promise(r => setTimeout(r, 50));
    await fs.promises.writeFile(fileA, 'Updated Content A with larger size');
    await fs.promises.unlink(fileB);
    const fileC = path.join(TEST_DIR, 'FileC.md');
    await fs.promises.writeFile(fileC, 'Content C');

    // 3. Rescan against snap1 snapshot
    const snap2 = await WatcherAdapter.fullRescan(TEST_DIR, snap1.newSnapshot);
    expect(snap2.changed).toContain('FileA.md');
    expect(snap2.deleted).toContain('FileB.md');
    expect(snap2.created).toContain('FileC.md');
  });

  it('filters out dot folders from full rescan', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    const obsidianDir = path.join(TEST_DIR, '.obsidian');
    await fs.promises.mkdir(gitDir, { recursive: true });
    await fs.promises.mkdir(obsidianDir, { recursive: true });

    await fs.promises.writeFile(path.join(gitDir, 'HEAD.md'), 'ref');
    await fs.promises.writeFile(path.join(obsidianDir, 'config.md'), '{}');
    await fs.promises.writeFile(path.join(TEST_DIR, 'ValidNote.md'), '# Valid');

    const res = await WatcherAdapter.fullRescan(TEST_DIR, new Map());
    expect(res.created).toContain('ValidNote.md');
    expect(res.created).not.toContain('.git/HEAD.md');
    expect(res.created).not.toContain('.obsidian/config.md');
  });
});
