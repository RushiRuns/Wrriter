import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NoteService } from '../../src/main/services/note-service';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { OrderService } from '../../src/main/services/order-service';
import { parseFrontmatter } from '../../src/shared/domain/frontmatter';
import { resolveLink, resolveMarkdownLink } from '../../src/shared/domain/links';
import { IndexDb } from '../../src/workers/index/db';
import { TitleList } from '../../src/workers/index/titles';
import { Indexer } from '../../src/workers/index/indexer';

// Mock Electron shell.trashItem to track deletion
const trashedPaths: string[] = [];
vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(async (targetPath: string) => {
      trashedPaths.push(targetPath);
      await fs.promises.rm(targetPath, { recursive: true, force: true }).catch(() => {});
    })
  }
}));

describe('Note duplication, deleted note links, and index rebuild', () => {
  let tmpVault: string;
  let noteService: NoteService;
  let safeWriter: SafeWriter;
  let vaultReader: VaultReader;
  let orderService: OrderService;
  let mockIndexClient: {
    noteChanged: ReturnType<typeof vi.fn>;
    noteDeleted: ReturnType<typeof vi.fn>;
    getNotes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-dup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });

    safeWriter = new SafeWriter();
    vaultReader = new VaultReader();
    orderService = new OrderService(safeWriter);
    mockIndexClient = {
      noteChanged: vi.fn(),
      noteDeleted: vi.fn(),
      getNotes: vi.fn()
    };

    noteService = new NoteService({
      safeWriter,
      vaultReader,
      orderService,
      indexClient: mockIndexClient as any
    });

    trashedPaths.length = 0;
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  describe('Duplicate Note', () => {
    it('duplicates note in the same folder with a number added and first line unchanged', async () => {
      const originalPath = 'Project.md';
      const originalContent = `# Project Alpha\n\nSome body text.\n`;
      await fs.promises.writeFile(path.join(tmpVault, originalPath), originalContent, 'utf8');

      const res = await noteService.duplicateNote(tmpVault, originalPath);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe('Project 2.md');
      expect(res.value.title).toBe('Project Alpha');

      const dupDiskContent = await fs.promises.readFile(path.join(tmpVault, 'Project 2.md'), 'utf8');
      const parsed = parseFrontmatter(dupDiskContent);

      // Fresh created timestamp
      expect(parsed.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

      // First line of the body remains strictly unchanged
      const bodyLines = parsed.body.trim().split(/\r?\n/);
      expect(bodyLines[0]).toBe('# Project Alpha');

      // Notifies index client
      expect(mockIndexClient.noteChanged).toHaveBeenCalledWith('Project 2.md');
    });

    it('increments number if candidate already exists (Note 2 -> Note 3)', async () => {
      await fs.promises.writeFile(path.join(tmpVault, 'Ideas.md'), '# Ideas\n', 'utf8');
      await fs.promises.writeFile(path.join(tmpVault, 'Ideas 2.md'), '# Ideas 2\n', 'utf8');

      const res = await noteService.duplicateNote(tmpVault, 'Ideas.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe('Ideas 3.md');
    });

    it('increments from an already numbered note (Ideas 2 -> Ideas 3)', async () => {
      await fs.promises.writeFile(path.join(tmpVault, 'Ideas 2.md'), '# Ideas 2\n', 'utf8');

      const res = await noteService.duplicateNote(tmpVault, 'Ideas 2.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe('Ideas 3.md');
    });

    it('handles numeric note titles gracefully (1984 -> 1984 2)', async () => {
      await fs.promises.writeFile(path.join(tmpVault, '1984.md'), '# 1984\n', 'utf8');

      const res = await noteService.duplicateNote(tmpVault, '1984.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe('1984 2.md');
    });

    it('duplicates inside subfolders in the same subfolder', async () => {
      const subDir = path.join(tmpVault, 'Work', 'Specs');
      await fs.promises.mkdir(subDir, { recursive: true });
      await fs.promises.writeFile(path.join(subDir, 'Design.md'), '# Design\n', 'utf8');

      const res = await noteService.duplicateNote(tmpVault, 'Work/Specs/Design.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe('Work/Specs/Design 2.md');
      expect(fs.existsSync(path.join(tmpVault, 'Work', 'Specs', 'Design 2.md'))).toBe(true);
    });

    it('keeps tags, status, unowned keys, and comments while updating created:', async () => {
      const noteContent = `---
# Important note comment
tags: [urgent, research]
status: in-progress
created: 2026-01-01T08:00:00
aliases: [spec-v1]
---
# Original Title

Some details here.
`;
      await fs.promises.writeFile(path.join(tmpVault, 'Spec.md'), noteContent, 'utf8');

      const res = await noteService.duplicateNote(tmpVault, 'Spec.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const dupDisk = await fs.promises.readFile(path.join(tmpVault, 'Spec 2.md'), 'utf8');
      const parsed = parseFrontmatter(dupDisk);

      expect(parsed.tags).toEqual(['urgent', 'research']);
      expect(parsed.status).toBe('in-progress');
      expect(parsed.unownedKeys.get('aliases')).toBe('[spec-v1]');
      expect(parsed.created).not.toBe('2026-01-01T08:00:00');
      expect(parsed.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(dupDisk).toContain('# Important note comment');

      // First line of body is unchanged
      const bodyLines = parsed.body.trim().split(/\r?\n/);
      expect(bodyLines[0]).toBe('# Original Title');
    });

    it('does not pin the duplicate even if the source note is pinned', async () => {
      await fs.promises.writeFile(path.join(tmpVault, 'PinnedNote.md'), '# Pinned Note\n', 'utf8');
      await noteService.setPinned(tmpVault, 'PinnedNote.md', true);

      // Verify source is pinned
      const pinsBefore = await orderService.getPins(tmpVault);
      expect(pinsBefore).toContain('PinnedNote.md');

      const res = await noteService.duplicateNote(tmpVault, 'PinnedNote.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pinsAfter = await orderService.getPins(tmpVault);
      expect(pinsAfter).toContain('PinnedNote.md');
      expect(pinsAfter).not.toContain('PinnedNote 2.md');
    });

    it('shares attachment references without copying attachment files', async () => {
      const attachDir = path.join(tmpVault, 'attachments');
      await fs.promises.mkdir(attachDir, { recursive: true });
      await fs.promises.writeFile(path.join(attachDir, 'diagram.png'), 'fake-binary-data');

      const noteWithImage = `# Architectural Diagram

![](attachments/diagram.png)
`;
      await fs.promises.writeFile(path.join(tmpVault, 'DiagramDoc.md'), noteWithImage, 'utf8');

      const res = await noteService.duplicateNote(tmpVault, 'DiagramDoc.md');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const dupContent = await fs.promises.readFile(path.join(tmpVault, 'DiagramDoc 2.md'), 'utf8');
      expect(dupContent).toContain('![](attachments/diagram.png)');

      // Confirm no duplicate attachment file was created
      const attachFiles = await fs.promises.readdir(attachDir);
      expect(attachFiles).toEqual(['diagram.png']);
    });
  });

  describe('Links to Deleted Notes', () => {
    it('leaves referencing notes untouched on disk when target note is deleted', async () => {
      await fs.promises.writeFile(path.join(tmpVault, 'TargetNote.md'), '# Target Note\n', 'utf8');
      const referencingContent = `# Main Note

See [[TargetNote]] and [Target Note](TargetNote.md) for background.
`;
      await fs.promises.writeFile(path.join(tmpVault, 'MainNote.md'), referencingContent, 'utf8');

      // Delete target note
      const delRes = await noteService.deleteNote(tmpVault, 'TargetNote.md');
      expect(delRes.ok).toBe(true);

      // Verify MainNote.md on disk was NOT touched
      const mainContentAfter = await fs.promises.readFile(path.join(tmpVault, 'MainNote.md'), 'utf8');
      expect(mainContentAfter).toBe(referencingContent);
      expect(mockIndexClient.noteDeleted).toHaveBeenCalledWith('TargetNote.md');
    });

    it('resolves links to deleted note as isMissing: true', () => {
      const availableNotes = [
        { path: 'MainNote.md', title: 'Main Note', modified: 1000 }
      ];

      // Wikilink to deleted note
      const wlRes = resolveLink('TargetNote', 'MainNote.md', availableNotes);
      expect(wlRes.resolved).toBe(false);
      expect(wlRes.isMissing).toBe(true);

      // Markdown link to deleted note
      const mdRes = resolveMarkdownLink('TargetNote.md', 'MainNote.md', availableNotes);
      expect(mdRes).not.toBeNull();
      expect(mdRes?.resolved).toBe(false);
      expect(mdRes?.isMissing).toBe(true);
    });
  });

  describe('Index rebuild on deletion', () => {
    it('deleting the index file and restarting rebuilds it without losing data', async () => {
      const dbPath = path.join(tmpVault, 'index.db');
      const db = new IndexDb(dbPath);
      const titles = new TitleList();
      const indexer = new Indexer(tmpVault, db, titles);

      // Create two notes on disk
      await fs.promises.writeFile(
        path.join(tmpVault, 'NoteA.md'),
        '---\ntags: [research]\nstatus: done\n---\n# Note Alpha\n\nBody text\n',
        'utf8'
      );
      await fs.promises.writeFile(
        path.join(tmpVault, 'NoteB.md'),
        '# Note Beta\n\nLink to [[Note Alpha]]\n',
        'utf8'
      );

      // Initial index
      await indexer.scanAndIndex();
      expect(db.listNotes().length).toBe(2);
      expect(db.getTags().length).toBe(1);

      db.close();

      // Delete the index file
      await fs.promises.rm(dbPath, { force: true });
      expect(fs.existsSync(dbPath)).toBe(false);

      // Restart indexer (creates new DB and syncs)
      const rebuiltDb = new IndexDb(dbPath);
      const rebuiltTitles = new TitleList();
      const rebuiltIndexer = new Indexer(tmpVault, rebuiltDb, rebuiltTitles);
      await rebuiltIndexer.scanAndIndex();

      // Everything rebuilt from disk, nothing lost
      const notes = rebuiltDb.listNotes();
      expect(notes.length).toBe(2);
      const tags = rebuiltDb.getTags();
      expect(tags).toContain('research');

      const noteA = rebuiltDb.getNote('NoteA.md');
      expect(noteA?.title).toBe('Note Alpha');
      expect(noteA?.status).toBe('done');

      rebuiltDb.close();
    });
  });
});
