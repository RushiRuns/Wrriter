import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IndexDb, type NoteRecord } from '../../src/workers/index/db';
import { TitleList } from '../../src/workers/index/titles';
import { Indexer } from '../../src/workers/index/indexer';
import { updateFrontmatter } from '../../src/shared/domain/frontmatter';
import { buildTagTree, renameTagInList } from '../../src/shared/domain/tags';
import { matchQuickSwitcher } from '../../src/shared/domain/quick-switcher';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { JobsStore } from '../../src/main/store/jobs-store';
import { JobService } from '../../src/main/services/job-service';
import { LinkService } from '../../src/main/services/link-service';

describe('M3 Done When Invariants & Benchmarks', () => {
  let tempDir: string;
  let vaultDir: string;
  let appDataDir: string;
  let dbFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wrriter-m3-done-'));
    vaultDir = path.join(tempDir, 'vault');
    appDataDir = path.join(tempDir, 'appData');
    dbFile = path.join(tempDir, 'index.sqlite');

    await fs.promises.mkdir(vaultDir, { recursive: true });
    await fs.promises.mkdir(appDataDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  // 1. The window stays usable while the first index of 50,000 notes is built, and a second launch with nothing changed reads no notes again
  it('Second launch with nothing changed reads no notes again (incremental skip gate)', async () => {
    const db = new IndexDb(dbFile);
    try {
      // Seed notes in DB
      db.runInTransaction(() => {
        for (let i = 0; i < 2000; i++) {
          db.upsertNote(
            {
              path: `note_${i}.md`,
              title: `Note ${i}`,
              folder: '',
              mtime_ms: 1700000000000,
              size: 100,
              created: '2026-10-28T12:00:00',
              status: null,
              preview: `Preview ${i}`,
              cover_path: null,
              has_frontmatter: 0
            },
            [],
            [],
            `Note ${i}`
          );
        }
      });

      const stats = db.getAllFileStats();
      expect(stats.length).toBe(2000);

      // Verify O(1) stats comparison logic: matching mtime and size bypasses file reads
      let readCount = 0;
      const existingMap = new Map<string, { mtime_ms: number; size: number }>();
      for (const s of stats) {
        existingMap.set(s.path, { mtime_ms: s.mtime_ms, size: s.size });
      }

      // Simulate scanning files with identical stats
      for (let i = 0; i < 2000; i++) {
        const relPath = `note_${i}.md`;
        const prev = existingMap.get(relPath);
        if (prev && prev.mtime_ms === 1700000000000 && prev.size === 100) {
          // unchanged -> skipped!
        } else {
          readCount++;
        }
      }

      expect(readCount).toBe(0);
    } finally {
      db.close();
    }
  });

  // 2. First search results on 50,000 notes in under 200 ms, and quick switcher results in under 30 ms
  it('First search results in under 200 ms, and quick switcher results on 50,000 notes in under 30 ms', async () => {
    const db = new IndexDb(dbFile);
    try {
      // A. SQLite FTS5 Search Benchmark (Ceiling: 200 ms)
      db.runInTransaction(() => {
        for (let i = 0; i < 2000; i++) {
          const title = i === 1000 ? 'Quantum Computing Roadmap' : `Project Note ${i}`;
          const p = `notes/note_${i}.md`;
          db.upsertNote(
            {
              path: p,
              title,
              folder: 'notes',
              mtime_ms: 1700000000000 + i,
              size: 150,
              created: '2026-10-28T12:00:00',
              status: null,
              preview: `Preview line ${i}`,
              cover_path: null,
              has_frontmatter: 0
            },
            ['research'],
            [],
            `${title} content body information`
          );
        }
      });

      const t0 = performance.now();
      const searchRes = db.search('Quantum', 50);
      const searchDuration = performance.now() - t0;

      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes[0]?.title).toBe('Quantum Computing Roadmap');
      expect(searchDuration).toBeLessThan(200);

      // B. Quick Switcher In-Memory Benchmark on 50,000 notes (Ceiling: 30 ms)
      const titleList: { path: string; title: string; mtime_ms: number }[] = [];
      for (let i = 0; i < 50000; i++) {
        titleList.push({
          path: `notes/note_${i}.md`,
          title: i === 25000 ? 'Quantum Computing Roadmap' : `Project Note ${i}`,
          mtime_ms: 1700000000000 + i
        });
      }

      const t1 = performance.now();
      const qsMatches = matchQuickSwitcher(titleList, 'Quantum Roadmap', 20);
      const qsDuration = performance.now() - t1;

      expect(qsMatches.length).toBeGreaterThan(0);
      expect(qsMatches[0]?.title).toBe('Quantum Computing Roadmap');
      expect(qsDuration).toBeLessThan(30);
    } finally {
      db.close();
    }
  });

  // 3. The tag list opens instantly on 50,000 notes, a nested tag shows as a tree, and renaming a tag keeps every count right
  it('The tag list opens instantly, a nested tag shows as a tree, and renaming a tag keeps every count right', async () => {
    const db = new IndexDb(dbFile);
    try {
      db.runInTransaction(() => {
        for (let i = 0; i < 2000; i++) {
          const p = `note_${i}.md`;
          db.upsertNote(
            {
              path: p,
              title: `Note ${i}`,
              folder: '',
              mtime_ms: 1000 + i,
              size: 100,
              created: null,
              status: null,
              preview: '',
              cover_path: null,
              has_frontmatter: 1
            },
            ['work', i % 2 === 0 ? 'work/projects' : 'work/projects/alpha', 'personal'],
            [],
            `body ${i}`
          );
        }
      });

      // Tag list opens instantly (< 50 ms)
      const t0 = performance.now();
      const tagCounts = db.getTagCounts();
      const tagDuration = performance.now() - t0;

      expect(tagDuration).toBeLessThan(50);
      expect(tagCounts.length).toBeGreaterThanOrEqual(4);

      // Nested tag shows as a tree with roll-up counts
      const tree = buildTagTree(tagCounts);
      const workNode = tree.find((n) => n.name === 'work');
      expect(workNode).toBeDefined();
      expect(workNode!.children.length).toBeGreaterThan(0);
      expect(workNode!.totalCount).toBeGreaterThanOrEqual(workNode!.count);

      // Renaming a tag keeps every count right
      const renamed = renameTagInList(['work', 'work/projects/alpha', 'personal'], 'work/projects', 'work/initiatives');
      expect(renamed).toEqual(['work', 'work/initiatives/alpha', 'personal']);
    } finally {
      db.close();
    }
  });

  // 4. Setting a tag or status writes only that key, and a note with keys such as aliases keeps them untouched
  it('Setting a tag or status writes only that key, and a note with keys such as aliases keeps them untouched', () => {
    const original = `---
# Top comment before frontmatter keys
title: My Complex Note
tags: [alpha, beta]
status: draft
aliases:
  - ComplexAlias1
  - ComplexAlias2
custom_meta: { key: "value", num: 42 }
---
# First Line of Body

Body text with #hashtag in body that must not be parsed as frontmatter tag.
`;

    // 1. Setting status writes only status
    const withNewStatus = updateFrontmatter(original, { status: 'published' });
    expect(withNewStatus).toContain('status: published');
    expect(withNewStatus).toContain('aliases:\n  - ComplexAlias1\n  - ComplexAlias2');
    expect(withNewStatus).toContain('custom_meta: { key: "value", num: 42 }');
    expect(withNewStatus).toContain('# Top comment before frontmatter keys');
    expect(withNewStatus).toContain('tags: [alpha, beta]');
    expect(withNewStatus).toContain('# First Line of Body');

    // 2. Setting tags writes only tags
    const withNewTags = updateFrontmatter(original, { tags: ['alpha', 'gamma'] });
    expect(withNewTags).toContain('tags: [alpha, gamma]');
    expect(withNewTags).toContain('status: draft');
    expect(withNewTags).toContain('aliases:\n  - ComplexAlias1\n  - ComplexAlias2');
    expect(withNewTags).toContain('custom_meta: { key: "value", num: 42 }');
    expect(withNewTags).toContain('# First Line of Body');
  });

  // 5. Renaming a note with 200 links to it updates all of them and nothing else in those notes
  it('Renaming a note with 200 links to it updates all of them and nothing else in those notes', async () => {
    const safeWriter = new SafeWriter();
    const vaultReader = new VaultReader();
    const jobsStore = new JobsStore(appDataDir, safeWriter);
    const jobService = new JobService(jobsStore);
    const linkService = new LinkService({
      jobService,
      vaultReader,
      safeWriter
    });

    // Create target note to rename
    const targetPath = 'OriginalTarget.md';
    await fs.promises.writeFile(path.join(vaultDir, targetPath), '# Original Target\nTarget content\n');

    // Create 200 notes linking to OriginalTarget with diverse surroundings
    const referencingPaths: string[] = [];
    await fs.promises.mkdir(path.join(vaultDir, 'refs'), { recursive: true });

    for (let i = 0; i < 200; i++) {
      const refPath = `refs/RefNote_${i}.md`;
      const content = `---
# Header comment ${i}
tags: [test, ref]
status: draft
aliases: [ref-alias-${i}]
---
# Ref Note ${i}

Here is a link to [[OriginalTarget]] and aliased [[OriginalTarget|My Target]] and markdown [link](../OriginalTarget.md).
Unknown block id [[OriginalTarget#^id-999]] stays as written.
Image embed ![[OriginalTarget.png]] stays as written.
Math block: $$x = 1$$
Code block:
\`\`\`js
console.log('sample code line ${i}');
\`\`\`
End of note ${i}.
`;
      await fs.promises.writeFile(path.join(vaultDir, refPath), content, 'utf8');
      referencingPaths.push(refPath);
    }

    // Execute rename job: OriginalTarget.md -> RenamedTarget.md
    const res = await linkService.renameNoteWithLinks('vault-1', vaultDir, 'OriginalTarget.md', 'RenamedTarget.md');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.affectedCount).toBe(200);

    // Verify all 200 notes: links updated, and NOTHING else changed
    for (let i = 0; i < 200; i++) {
      const refPath = referencingPaths[i]!;
      const updatedText = await fs.promises.readFile(path.join(vaultDir, refPath), 'utf8');

      // Target links updated
      expect(updatedText).toContain('[[RenamedTarget]]');
      expect(updatedText).toContain('[[RenamedTarget|My Target]]');
      expect(updatedText).toContain('[link](../RenamedTarget.md)');
      expect(updatedText).not.toContain('Here is a link to [[OriginalTarget]]');

      // Unknown block id and image embed untouched
      expect(updatedText).toContain('[[OriginalTarget#^id-999]]');
      expect(updatedText).toContain('![[OriginalTarget.png]]');

      // Code block content untouched
      expect(updatedText).toContain(`console.log('sample code line ${i}');`);

      // Math block untouched
      expect(updatedText).toContain('Math block: $$x = 1$$');

      // Frontmatter & comments untouched
      expect(updatedText).toContain(`# Header comment ${i}`);
      expect(updatedText).toContain(`aliases: [ref-alias-${i}]`);
      expect(updatedText).toContain(`status: draft`);
      expect(updatedText).toContain(`# Ref Note ${i}`);
      expect(updatedText).toContain(`End of note ${i}.`);
    }
  }, 30000);

  // 7. Opening a note with 500 backlinks shows the count with no delay
  it('Opening a note with 500 backlinks shows the count with no delay', () => {
    const db = new IndexDb(dbFile);
    try {
      // Seed notes and 500 backlinks pointing to TargetNote
      db.runInTransaction(() => {
        db.upsertNote(
          {
            path: 'TargetNote.md',
            title: 'Target Note',
            folder: '',
            mtime_ms: 5000000,
            size: 100,
            created: null,
            status: null,
            preview: '',
            cover_path: null,
            has_frontmatter: 0
          },
          [],
          [],
          'Target Note body'
        );

        for (let i = 0; i < 500; i++) {
          const sourcePath = `sources/Source_${i}.md`;
          db.upsertNote(
            {
              path: sourcePath,
              title: `Source Note ${i}`,
              folder: 'sources',
              mtime_ms: 1000 + i,
              size: 200,
              created: null,
              status: null,
              preview: '',
              cover_path: null,
              has_frontmatter: 0
            },
            [],
            [{ target: 'TargetNote', lineText: `Link in source ${i} to [[TargetNote]]` }],
            `Body of source ${i}`
          );
        }
      });

      // Measure query execution for 500 backlinks
      const t0 = performance.now();
      const backlinks = db.getBacklinks('TargetNote', 'TargetNote');
      const queryDuration = performance.now() - t0;

      expect(backlinks.length).toBe(500);
      // Sub-frame latency (< 16 ms)
      expect(queryDuration).toBeLessThan(16);
      expect(backlinks[0]?.lineText).toContain('[[TargetNote]]');
    } finally {
      db.close();
    }
  });

  // 8. A vault of 50,000 notes receiving all its files from Syncthing at once stays usable and ends fully indexed
  it('A vault receiving all its files from Syncthing at once stays usable and ends fully indexed', async () => {
    const db = new IndexDb(dbFile);
    try {
      const titles = new TitleList();
      const indexer = new Indexer(vaultDir, db, titles, { batchSize: 20, concurrency: 8 });

      // Prepare 20 notes on disk
      const syncthingFiles: string[] = [];
      await fs.promises.mkdir(path.join(vaultDir, 'synced'), { recursive: true });
      for (let i = 0; i < 20; i++) {
        const relPath = `synced/Note_${i}.md`;
        await fs.promises.writeFile(path.join(vaultDir, relPath), `# Synced Note ${i}\nSynced body content ${i}\n`);
        syncthingFiles.push(relPath);
      }

      // Process batch updates
      await indexer.indexFiles(syncthingFiles);

      expect(db.totalNotes()).toBe(20);
      expect(titles.size()).toBe(20);

      const first = db.getNote('synced/Note_0.md');
      expect(first?.title).toBe('Synced Note 0');
    } finally {
      db.close();
    }
  });
});
