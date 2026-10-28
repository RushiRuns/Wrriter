import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IndexDb, type NoteRecord } from '../../src/workers/index/db';

describe('IndexDb Search with Filters and Title-Match-First Ranking (M3)', () => {
  let tmpDir: string;
  let dbFile: string;
  let db: IndexDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrriter-search-test-'));
    dbFile = path.join(tmpDir, 'test-index.sqlite');
    db = new IndexDb(dbFile);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('filters search results by tag: and nested child tags', () => {
    const note1: NoteRecord = {
      path: 'Note1.md',
      title: 'Recipe Ideas',
      folder: '',
      mtime_ms: 1000,
      size: 100,
      created: null,
      status: null,
      preview: 'Cooking delicious pasta',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note1, ['recipes', 'cooking'], [], 'Cooking delicious pasta at home');

    const note2: NoteRecord = {
      path: 'Work/Project.md',
      title: 'Work Project',
      folder: 'Work',
      mtime_ms: 2000,
      size: 200,
      created: null,
      status: 'active',
      preview: 'Sprint planning and recipes for success',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note2, ['work/sprint'], [], 'Sprint planning and recipes for success in project');

    // Query 1: search 'recipes' with tag:recipes -> only note1
    const res1 = db.search('tag:recipes pasta');
    expect(res1.length).toBe(1);
    expect(res1[0]?.path).toBe('Note1.md');

    // Query 2: search with parent tag 'work' matches child tag 'work/sprint'
    const res2 = db.search('tag:work project');
    expect(res2.length).toBe(1);
    expect(res2[0]?.path).toBe('Work/Project.md');
  });

  it('filters search results by status: and folder:', () => {
    const note1: NoteRecord = {
      path: 'Archive/Old.md',
      title: 'Old Draft',
      folder: 'Archive',
      mtime_ms: 1000,
      size: 100,
      created: null,
      status: 'draft',
      preview: 'Old plan',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note1, ['misc'], [], 'Old plan for system');

    const note2: NoteRecord = {
      path: 'Active/New.md',
      title: 'New Plan',
      folder: 'Active',
      mtime_ms: 2000,
      size: 100,
      created: null,
      status: 'active',
      preview: 'New plan',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note2, ['misc'], [], 'New plan for system');

    // Filter by status:active
    const resStatus = db.search('status:active plan');
    expect(resStatus.length).toBe(1);
    expect(resStatus[0]?.path).toBe('Active/New.md');

    // Filter by folder:Archive
    const resFolder = db.search('folder:Archive plan');
    expect(resFolder.length).toBe(1);
    expect(resFolder[0]?.path).toBe('Archive/Old.md');
  });

  it('orders title matches first, then sorts by most recently modified (mtime_ms DESC)', () => {
    // Note A: Title contains "Budget", older modified time
    const noteA: NoteRecord = {
      path: 'Work/Budget.md',
      title: 'Annual Budget Plan',
      folder: 'Work',
      mtime_ms: 1000,
      size: 100,
      created: null,
      status: null,
      preview: 'Financial details',
      cover_path: null,
      has_frontmatter: 0
    };
    db.upsertNote(noteA, [], [], 'Financial details for company');

    // Note B: Title does NOT contain "Budget", but body contains "Budget", NEWER modified time
    const noteB: NoteRecord = {
      path: 'Work/Meeting.md',
      title: 'Staff Meeting Notes',
      folder: 'Work',
      mtime_ms: 5000,
      size: 100,
      created: null,
      status: null,
      preview: 'We discussed budget allocations',
      cover_path: null,
      has_frontmatter: 0
    };
    db.upsertNote(noteB, [], [], 'We discussed budget allocations for Q3');

    // Note C: Title also contains "Budget", NEWER than Note A
    const noteC: NoteRecord = {
      path: 'Work/Q4-Budget.md',
      title: 'Q4 Budget Review',
      folder: 'Work',
      mtime_ms: 3000,
      size: 100,
      created: null,
      status: null,
      preview: 'Reviewing budget numbers',
      cover_path: null,
      has_frontmatter: 0
    };
    db.upsertNote(noteC, [], [], 'Reviewing budget numbers thoroughly');

    const results = db.search('budget');
    expect(results.length).toBe(3);

    // Note C and Note A both have "Budget" in title, so they come first, ordered by mtime_ms DESC:
    expect(results[0]?.path).toBe('Work/Q4-Budget.md'); // mtime 3000, title match
    expect(results[1]?.path).toBe('Work/Budget.md');    // mtime 1000, title match
    // Note B only has "budget" in body, so it comes after title matches
    expect(results[2]?.path).toBe('Work/Meeting.md');   // mtime 5000, body match
  });

  it('supports searching with ONLY filter tags (no text keywords)', () => {
    const note1: NoteRecord = {
      path: 'Work/Task1.md',
      title: 'Task One',
      folder: 'Work',
      mtime_ms: 2000,
      size: 100,
      created: null,
      status: 'todo',
      preview: 'First task',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note1, ['work'], [], 'Body 1');

    const note2: NoteRecord = {
      path: 'Personal/Task2.md',
      title: 'Task Two',
      folder: 'Personal',
      mtime_ms: 3000,
      size: 100,
      created: null,
      status: 'todo',
      preview: 'Second task',
      cover_path: null,
      has_frontmatter: 1
    };
    db.upsertNote(note2, ['personal'], [], 'Body 2');

    const res = db.search('status:todo');
    expect(res.length).toBe(2);
    // Ordered by mtime descending
    expect(res[0]?.path).toBe('Personal/Task2.md');
    expect(res[1]?.path).toBe('Work/Task1.md');
  });

  it('generates highlighted snippets for matches in body text', () => {
    const note: NoteRecord = {
      path: 'Notes/Ideas.md',
      title: 'Brainstorming',
      folder: 'Notes',
      mtime_ms: 1000,
      size: 100,
      created: null,
      status: null,
      preview: 'Ideas',
      cover_path: null,
      has_frontmatter: 0
    };
    db.upsertNote(note, [], [], 'The serendipity of unexpected connections leads to breakthrough thinking.');

    const res = db.search('serendipity');
    expect(res.length).toBe(1);
    expect(res[0]?.snippet).toContain('<mark>');
    expect(res[0]?.snippet).toContain('serendipity');
  });

  it('Performance Gate: Search results return in under 200 ms (PERFORMANCE.md)', () => {
    // Bulk insert notes in a fast transaction
    db.runInTransaction(() => {
      for (let i = 0; i < 5000; i++) {
        const note: NoteRecord = {
          path: `Folder${i % 50}/Document-${i}.md`,
          title: `Document ${i} - Product Strategy and Architecture`,
          folder: `Folder${i % 50}`,
          mtime_ms: 1000000 + i,
          size: 500,
          created: '2026-10-28',
          status: i % 2 === 0 ? 'active' : 'draft',
          preview: `This is document preview content for ${i}`,
          cover_path: null,
          has_frontmatter: 1
        };
        db.upsertNote(
          note,
          [`tag${i % 20}`, 'project'],
          [],
          `Detailed body containing strategy, architectural goals, and deliverables for project ${i}`
        );
      }
    });

    // Warm-up query
    db.search('tag:project strategy', 50);

    // Benchmark search query with text and filter
    const t0 = performance.now();
    const results = db.search('folder:Folder1 tag:project deliverables', 50);
    const duration = performance.now() - t0;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200); // Ceiling: 200 ms
  });
});
