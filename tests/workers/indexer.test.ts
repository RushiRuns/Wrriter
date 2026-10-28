import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IndexDb } from '../../src/workers/index/db';
import { TitleList } from '../../src/workers/index/titles';
import { Indexer, type IndexProgress } from '../../src/workers/index/indexer';

describe('Indexer (src/workers/index/indexer.ts)', () => {
  const testRoot = path.join(process.cwd(), 'tests', 'temp-indexer-vault');
  const dbFile = path.join(testRoot, '.index.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testRoot, { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'Work'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'Personal'), { recursive: true });

    // Seed test notes
    fs.writeFileSync(path.join(testRoot, 'Work', 'Alpha.md'), '# Alpha Project\n\nNotes for alpha\n[[Personal/Budget]]');
    fs.writeFileSync(path.join(testRoot, 'Personal', 'Budget.md'), '---\ntags: [finance]\nstatus: done\n---\n# Monthly Budget\n\nPreview of budget');
    fs.writeFileSync(path.join(testRoot, 'RootNote.md'), '# Welcome\n\nRoot note preview');
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('performs full initial index with folder on screen first', async () => {
    const db = new IndexDb(dbFile);
    const titles = new TitleList();
    const progressList: IndexProgress[] = [];

    const indexer = new Indexer(testRoot, db, titles, {
      batchSize: 10,
      concurrency: 4,
      onProgress: (p) => progressList.push(p)
    });

    // Run indexing prioritizing 'Work' folder
    const summary = await indexer.scanAndIndex('Work');

    expect(summary.totalFound).toBe(3);
    expect(summary.indexed).toBe(3);
    expect(summary.unchanged).toBe(0);
    expect(summary.deleted).toBe(0);

    expect(db.totalNotes()).toBe(3);
    expect(titles.size()).toBe(3);

    const alpha = db.getNote('Work/Alpha.md');
    expect(alpha?.title).toBe('Alpha Project');
    expect(alpha?.preview).toBe('Notes for alpha');

    const budget = db.getNote('Personal/Budget.md');
    expect(budget?.title).toBe('Monthly Budget');
    expect(budget?.preview).toBe('Preview of budget');

    // Folder counts
    const counts = db.getFolderCounts();
    expect(counts).toEqual(
      expect.arrayContaining([
        { folder: 'Work', count: 1 },
        { folder: 'Personal', count: 1 },
        { folder: '', count: 1 }
      ])
    );

    expect(progressList.length).toBeGreaterThan(0);
    expect(progressList[progressList.length - 1]?.isIndexing).toBe(false);

    db.close();
  });

  it('second launch with nothing changed reads no notes again', async () => {
    const db = new IndexDb(dbFile);
    const titles = new TitleList();
    const indexer = new Indexer(testRoot, db, titles);

    // Initial index
    await indexer.scanAndIndex();
    expect(db.totalNotes()).toBe(3);

    // Second index with zero file changes
    const secondSummary = await indexer.scanAndIndex();
    expect(secondSummary.indexed).toBe(0);
    expect(secondSummary.unchanged).toBe(3);
    expect(secondSummary.deleted).toBe(0);

    db.close();
  });

  it('detects modified and deleted files incrementally', async () => {
    const db = new IndexDb(dbFile);
    const titles = new TitleList();
    const indexer = new Indexer(testRoot, db, titles);

    await indexer.scanAndIndex();

    // 1. Modify one file
    await new Promise((r) => setTimeout(r, 20)); // ensure mtime diff
    fs.writeFileSync(path.join(testRoot, 'Work', 'Alpha.md'), '# Alpha Project Renamed\n\nUpdated preview content');

    // 2. Delete one file
    fs.unlinkSync(path.join(testRoot, 'RootNote.md'));

    // Incremental run
    const summary = await indexer.scanAndIndex();
    expect(summary.indexed).toBe(1);
    expect(summary.unchanged).toBe(1);
    expect(summary.deleted).toBe(1);

    expect(db.totalNotes()).toBe(2);
    expect(db.getNote('Work/Alpha.md')?.title).toBe('Alpha Project Renamed');
    expect(db.getNote('RootNote.md')).toBeNull();

    db.close();
  });

  it('batches external updates cleanly', async () => {
    const db = new IndexDb(dbFile);
    const titles = new TitleList();
    const indexer = new Indexer(testRoot, db, titles);

    await indexer.scanAndIndex();

    // Simulate Syncthing dropping 2 updated files
    fs.writeFileSync(path.join(testRoot, 'Work', 'Alpha.md'), '# Alpha Live Synced\n\nBody');
    fs.writeFileSync(path.join(testRoot, 'Personal', 'Budget.md'), '# Budget Live Synced\n\nBody');

    indexer.queueBatchUpdates(['Work/Alpha.md']);
    indexer.queueBatchUpdates(['Personal/Budget.md']);

    // Wait for debounced flush
    await new Promise((r) => setTimeout(r, 150));

    expect(db.getNote('Work/Alpha.md')?.title).toBe('Alpha Live Synced');
    expect(db.getNote('Personal/Budget.md')?.title).toBe('Budget Live Synced');

    db.close();
  });
});
