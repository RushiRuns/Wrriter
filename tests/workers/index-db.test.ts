import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { IndexDb, INDEX_SCHEMA_VERSION, type NoteRecord } from '../../src/workers/index/db';
import { ftsEscape } from '../../src/workers/index/fts';

describe('IndexDb (src/workers/index/db.ts)', () => {
  const testDir = path.join(process.cwd(), 'tests', 'temp-index-db-test');
  const dbFile = path.join(testDir, 'test-vault.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('initializes WAL mode and schema tables properly', () => {
    const db = new IndexDb(dbFile);
    expect(db.totalNotes()).toBe(0);

    const testNote: NoteRecord = {
      path: 'Work/Project.md',
      title: 'Project Alpha',
      folder: 'Work',
      mtime_ms: 1700000000000,
      size: 1024,
      created: '2026-10-28T10:00',
      status: 'in-progress',
      preview: 'Alpha project opening notes',
      cover_path: 'attachments/cover.png',
      has_frontmatter: 1
    };

    db.upsertNote(testNote, ['work', 'project'], ['Architecture', 'Ideas'], 'Full body text for alpha project search');

    const fetched = db.getNote('Work/Project.md');
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Project Alpha');
    expect(fetched?.folder).toBe('Work');
    expect(fetched?.cover_path).toBe('attachments/cover.png');
    expect(fetched?.created).toBe('2026-10-28T10:00');

    // Folder counts
    const folderCounts = db.getFolderCounts();
    expect(folderCounts).toEqual([{ folder: 'Work', count: 1 }]);

    // FTS search with ftsEscape
    const results = db.search(ftsEscape('alpha'));
    expect(results.length).toBe(1);
    expect(results[0]?.path).toBe('Work/Project.md');

    db.close();
  });

  it('supports keyset pagination and sorting by modified, created, and title', () => {
    const db = new IndexDb(dbFile);

    const notes: NoteRecord[] = [
      {
        path: 'Note1.md',
        title: 'B Note',
        folder: '',
        mtime_ms: 100,
        size: 50,
        created: '2026-10-01',
        status: null,
        preview: 'prev1',
        cover_path: null,
        has_frontmatter: 0
      },
      {
        path: 'Note2.md',
        title: 'A Note',
        folder: '',
        mtime_ms: 200,
        size: 60,
        created: '2026-10-03',
        status: null,
        preview: 'prev2',
        cover_path: null,
        has_frontmatter: 0
      },
      {
        path: 'Note3.md',
        title: 'C Note',
        folder: '',
        mtime_ms: 150,
        size: 70,
        created: '2026-10-02',
        status: null,
        preview: 'prev3',
        cover_path: null,
        has_frontmatter: 0
      }
    ];

    db.runInTransaction(() => {
      for (const n of notes) {
        db.upsertNote(n, [], [], n.preview);
      }
    });

    // Modified sort: Note2 (200), Note3 (150), Note1 (100)
    const byMtime = db.listNotes({ sortBy: 'modified' });
    expect(byMtime.map((n) => n.path)).toEqual(['Note2.md', 'Note3.md', 'Note1.md']);

    // Created sort: Note2 (2026-10-03), Note3 (2026-10-02), Note1 (2026-10-01)
    const byCreated = db.listNotes({ sortBy: 'created' });
    expect(byCreated.map((n) => n.path)).toEqual(['Note2.md', 'Note3.md', 'Note1.md']);

    // Title sort: A Note, B Note, C Note
    const byTitle = db.listNotes({ sortBy: 'title' });
    expect(byTitle.map((n) => n.path)).toEqual(['Note2.md', 'Note1.md', 'Note3.md']);

    // Keyset pagination after Note2 in title sort
    const paged = db.listNotes({
      sortBy: 'title',
      after: { path: 'Note2.md', sortVal: 'A Note' },
      limit: 1
    });
    expect(paged.map((n) => n.path)).toEqual(['Note1.md']);

    db.close();
  });

  it('queries unique vault statuses and tags for suggestion lists', () => {
    const db = new IndexDb(dbFile);

    const n1: NoteRecord = {
      path: 'A.md',
      title: 'A',
      folder: '',
      mtime_ms: 100,
      size: 10,
      created: null,
      status: 'active',
      preview: '',
      cover_path: null,
      has_frontmatter: 1
    };
    const n2: NoteRecord = {
      path: 'B.md',
      title: 'B',
      folder: '',
      mtime_ms: 200,
      size: 20,
      created: null,
      status: 'draft',
      preview: '',
      cover_path: null,
      has_frontmatter: 1
    };
    const n3: NoteRecord = {
      path: 'C.md',
      title: 'C',
      folder: '',
      mtime_ms: 300,
      size: 30,
      created: null,
      status: 'Active', // Case-insensitive deduplication check
      preview: '',
      cover_path: null,
      has_frontmatter: 1
    };

    db.upsertNote(n1, ['ideas', 'wrriter'], [], 'A');
    db.upsertNote(n2, ['wrriter', 'release'], [], 'B');
    db.upsertNote(n3, ['ideas'], [], 'C');

    const statuses = db.getStatuses();
    expect(statuses.map((s) => s.toLowerCase())).toContain('active');
    expect(statuses.map((s) => s.toLowerCase())).toContain('draft');

    const tags = db.getTags();
    expect(tags).toEqual(['ideas', 'release', 'wrriter']);

    db.close();
  });

  it('delete-and-rebuild test: deletes corrupted or older version database and rebuilds without asking', () => {
    // 1. Create older version DB
    const rawDb = new Database(dbFile);
    rawDb.exec(`
      CREATE TABLE index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO index_meta (key, value) VALUES ('version', '0');
      CREATE TABLE dummy (x INTEGER);
    `);
    rawDb.close();

    // 2. Open via IndexDb -> should detect version 0, destroy files, and rebuild as version 1
    const db = new IndexDb(dbFile);
    expect(db.totalNotes()).toBe(0);

    const testNote: NoteRecord = {
      path: 'Rebuilt.md',
      title: 'Rebuilt',
      folder: '',
      mtime_ms: 500,
      size: 100,
      created: null,
      status: null,
      preview: 'p',
      cover_path: null,
      has_frontmatter: 0
    };
    db.upsertNote(testNote, [], [], 'body');
    expect(db.totalNotes()).toBe(1);
    db.close();

    // 3. Corrupt DB file with random garbage bytes
    fs.writeFileSync(dbFile, Buffer.from('NOT A SQLITE FILE GARBAGE CORRUPTED BYTES'));

    // 4. Open via IndexDb -> should detect corruption, recreate clean DB
    const recoveredDb = new IndexDb(dbFile);
    expect(recoveredDb.totalNotes()).toBe(0);
    recoveredDb.close();
  });

  it('stores links with line snippets and queries backlinks accurately', () => {
    const db = new IndexDb(dbFile);

    const note1: NoteRecord = {
      path: 'Docs/Meeting.md',
      title: 'Meeting Notes',
      folder: 'Docs',
      mtime_ms: 1000,
      size: 200,
      created: null,
      status: null,
      preview: 'meeting preview',
      cover_path: null,
      has_frontmatter: 0
    };

    const note2: NoteRecord = {
      path: 'Docs/Summary.md',
      title: 'Project Summary',
      folder: 'Docs',
      mtime_ms: 2000,
      size: 300,
      created: null,
      status: null,
      preview: 'summary preview',
      cover_path: null,
      has_frontmatter: 0
    };

    db.upsertNote(
      note1,
      [],
      [{ target: 'Project Alpha', lineText: 'Discussed [[Project Alpha]] timeline.' }],
      'Discussed Project Alpha timeline.'
    );

    db.upsertNote(
      note2,
      [],
      [
        { target: 'Project Alpha', lineText: 'See [[Project Alpha|details]] for spec.' },
        { target: 'OtherNote', lineText: 'Also check [[OtherNote]].' }
      ],
      'See Project Alpha for spec.'
    );

    const backlinks = db.getBacklinks('Project Alpha');
    expect(backlinks).toHaveLength(2);
    // Ordered by modified DESC (note2 then note1)
    expect(backlinks[0]?.sourcePath).toBe('Docs/Summary.md');
    expect(backlinks[0]?.sourceTitle).toBe('Project Summary');
    expect(backlinks[0]?.lineText).toBe('See [[Project Alpha|details]] for spec.');
    expect(backlinks[1]?.sourcePath).toBe('Docs/Meeting.md');
    expect(backlinks[1]?.sourceTitle).toBe('Meeting Notes');
    expect(backlinks[1]?.lineText).toBe('Discussed [[Project Alpha]] timeline.');

    db.close();
  });
});
