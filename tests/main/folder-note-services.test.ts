import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FolderService } from '../../src/main/services/folder-service';
import { NoteService } from '../../src/main/services/note-service';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { OrderService } from '../../src/main/services/order-service';

// Mock Electron shell.trashItem to track deletion and clean up test files
const trashedPaths: string[] = [];
vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(async (targetPath: string) => {
      trashedPaths.push(targetPath);
      await fs.promises.rm(targetPath, { recursive: true, force: true }).catch(() => {});
    })
  }
}));

describe('FolderService', () => {
  let tmpVault: string;
  let folderService: FolderService;

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-folder-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });
    folderService = new FolderService();
    trashedPaths.length = 0;
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('lists folders recursively, computes note count, and ignores dot folders and attachments', async () => {
    // 1. Create directory structure
    const projectsDir = path.join(tmpVault, 'Projects');
    const wrriterDir = path.join(projectsDir, 'Wrriter');
    const personalDir = path.join(tmpVault, 'Personal');
    const dotDir = path.join(tmpVault, '.hidden');
    const attachmentsDir = path.join(tmpVault, 'attachments');

    await fs.promises.mkdir(projectsDir, { recursive: true });
    await fs.promises.mkdir(wrriterDir, { recursive: true });
    await fs.promises.mkdir(personalDir, { recursive: true });
    await fs.promises.mkdir(dotDir, { recursive: true });
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    // 2. Add notes
    await fs.promises.writeFile(path.join(projectsDir, 'Spec.md'), '# Spec');
    await fs.promises.writeFile(path.join(wrriterDir, 'Architecture.md'), '# Architecture');
    await fs.promises.writeFile(path.join(wrriterDir, 'Changelog.md'), '# Changelog');
    await fs.promises.writeFile(path.join(dotDir, 'ignore.md'), '# Ignore');
    await fs.promises.writeFile(path.join(attachmentsDir, 'image.md'), '# Ignore');

    // 3. List folders
    const res = await folderService.listFolders(tmpVault);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const folders = res.value;
    // Should have Personal and Projects at root
    expect(folders.map((f) => f.name)).toEqual(['Personal', 'Projects']);

    const projects = folders.find((f) => f.name === 'Projects')!;
    expect(projects.children.length).toBe(1);
    expect(projects.children[0]?.name).toBe('Wrriter');
    expect(projects.children[0]?.relPath).toBe('Projects/Wrriter');

    // Empty folder shows 0 notes
    const personal = folders.find((f) => f.name === 'Personal')!;
    expect(personal.noteCount).toBe(0);

    // Projects noteCount includes notes in its subfolders
    expect(projects.noteCount).toBe(3);
    expect(projects.children[0]?.noteCount).toBe(2);
  });

  it('creates valid folders and refuses invalid Windows characters and reserved names', async () => {
    // 1. Valid folder
    const validRes = await folderService.createFolder(tmpVault, 'Ideas');
    expect(validRes.ok).toBe(true);
    expect(fs.existsSync(path.join(tmpVault, 'Ideas'))).toBe(true);

    // 2. Invalid Windows characters
    const invalidChars = ['Ideas/Invalid:Name', 'Ideas/Bad*Folder', 'Quotes"Test', 'Pipe|Folder'];
    for (const badName of invalidChars) {
      const errRes = await folderService.createFolder(tmpVault, badName);
      expect(errRes.ok).toBe(false);
      if (!errRes.ok) {
        expect(errRes.error.kind).toBe('validation');
      }
    }

    // 3. Reserved Windows names
    const reservedRes = await folderService.createFolder(tmpVault, 'CON');
    expect(reservedRes.ok).toBe(false);
    if (!reservedRes.ok) {
      expect(reservedRes.error.kind).toBe('validation');
    }

    // 4. Duplicate folder
    const dupRes = await folderService.createFolder(tmpVault, 'Ideas');
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.error.kind).toBe('ruleViolation');
    }
  });

  it('renames folders and refuses invalid or colliding destination names', async () => {
    await folderService.createFolder(tmpVault, 'OldName');
    await folderService.createFolder(tmpVault, 'ExistingName');

    // 1. Valid rename
    const renameRes = await folderService.renameFolder(tmpVault, 'OldName', 'NewName');
    expect(renameRes.ok).toBe(true);
    expect(fs.existsSync(path.join(tmpVault, 'NewName'))).toBe(true);
    expect(fs.existsSync(path.join(tmpVault, 'OldName'))).toBe(false);

    // 2. Refuses invalid character in new name
    const invalidRes = await folderService.renameFolder(tmpVault, 'NewName', 'Bad?Name');
    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.error.kind).toBe('validation');
    }

    // 3. Refuses collision with existing folder
    const collideRes = await folderService.renameFolder(tmpVault, 'NewName', 'ExistingName');
    expect(collideRes.ok).toBe(false);
    if (!collideRes.ok) {
      expect(collideRes.error.kind).toBe('ruleViolation');
    }
  });

  it('deletes folder by sending it to Recycle Bin and reporting note count', async () => {
    const folderPath = path.join(tmpVault, 'ToTrash');
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, 'Note1.md'), 'First');
    await fs.promises.writeFile(path.join(folderPath, 'Note2.md'), 'Second');

    const sub = path.join(folderPath, 'Sub');
    await fs.promises.mkdir(sub, { recursive: true });
    await fs.promises.writeFile(path.join(sub, 'Note3.md'), 'Third');

    const deleteRes = await folderService.deleteFolder(tmpVault, 'ToTrash');
    expect(deleteRes.ok).toBe(true);
    if (deleteRes.ok) {
      expect(deleteRes.value.noteCount).toBe(3);
    }

    // Verify it was dispatched to trashItem
    expect(trashedPaths.length).toBe(1);
    expect(trashedPaths[0]?.replace(/\\/g, '/')).toContain('ToTrash');
  });
});

describe('NoteService', () => {
  let tmpVault: string;
  let safeWriter: SafeWriter;
  let vaultReader: VaultReader;
  let orderService: OrderService;
  let noteService: NoteService;

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-note-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });

    safeWriter = new SafeWriter();
    vaultReader = new VaultReader();
    orderService = new OrderService(safeWriter);
    noteService = new NoteService({ safeWriter, vaultReader, orderService });
    trashedPaths.length = 0;
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('reads and saves notes atomically via SafeWriter', async () => {
    const saveRes = await noteService.saveNote(tmpVault, 'MyNote.md', '# Hello World\n\nContent here.');
    expect(saveRes.ok).toBe(true);

    const readRes = await noteService.readNote(tmpVault, 'MyNote.md');
    expect(readRes.ok).toBe(true);
    if (readRes.ok) {
      expect(readRes.value.text).toBe('# Hello World\n\nContent here.');
      expect(readRes.value.lineEnding).toBe('\n');
    }
  });

  it('toggles pin in .wrriter/pins.json without modifying note file on disk', async () => {
    const notePath = 'Design.md';
    const initialText = '# Design Doc\n\nExact bytes must remain untouched.';
    await noteService.saveNote(tmpVault, notePath, initialText);

    const fullNotePath = path.join(tmpVault, notePath);
    const beforeStat = await fs.promises.stat(fullNotePath);
    const beforeBytes = await fs.promises.readFile(fullNotePath);

    // 1. Pin note
    const pinRes = await noteService.setPinned(tmpVault, notePath, true);
    expect(pinRes.ok).toBe(true);

    // Verify pins.json created
    const pinsFile = path.join(tmpVault, '.wrriter', 'pins.json');
    expect(fs.existsSync(pinsFile)).toBe(true);
    const pinsContent = JSON.parse(await fs.promises.readFile(pinsFile, 'utf8'));
    expect(pinsContent.pins).toContain(notePath);

    // Verify note file is byte-for-byte identical
    const afterBytes = await fs.promises.readFile(fullNotePath);
    expect(afterBytes).toEqual(beforeBytes);
    const afterStat = await fs.promises.stat(fullNotePath);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);

    // 2. Unpin note
    const unpinRes = await noteService.setPinned(tmpVault, notePath, false);
    expect(unpinRes.ok).toBe(true);
    const updatedPins = JSON.parse(await fs.promises.readFile(pinsFile, 'utf8'));
    expect(updatedPins.pins).not.toContain(notePath);
  });

  it('lists notes applying pinned grouping and sorting (title, modified, manual)', async () => {
    // Create 3 notes
    await noteService.saveNote(tmpVault, 'Zeta.md', '# Zeta\nLast letter');
    await new Promise((r) => setTimeout(r, 20));
    await noteService.saveNote(tmpVault, 'Alpha.md', '# Alpha\nFirst letter');
    await new Promise((r) => setTimeout(r, 20));
    await noteService.saveNote(tmpVault, 'Beta.md', '# Beta\nSecond letter');

    // Pin Beta
    await noteService.setPinned(tmpVault, 'Beta.md', true);

    // 1. Sort by title
    const titleSortRes = await noteService.listNotes(tmpVault, { sortBy: 'title' });
    expect(titleSortRes.ok).toBe(true);
    if (titleSortRes.ok) {
      const items = titleSortRes.value;
      // Pinned item (Beta) always appears at the top
      expect(items[0]?.path).toBe('Beta.md');
      expect(items[0]?.pinned).toBe(true);

      // Unpinned items sorted by title: Alpha then Zeta
      expect(items[1]?.path).toBe('Alpha.md');
      expect(items[2]?.path).toBe('Zeta.md');
    }

    // 2. Sort by modified
    const modSortRes = await noteService.listNotes(tmpVault, { sortBy: 'modified' });
    expect(modSortRes.ok).toBe(true);
    if (modSortRes.ok) {
      const items = modSortRes.value;
      expect(items[0]?.path).toBe('Beta.md'); // Pinned
      // Unpinned sorted modified desc: Beta is pinned, remaining are Alpha (newer) then Zeta (older)
      expect(items[1]?.path).toBe('Alpha.md');
      expect(items[2]?.path).toBe('Zeta.md');
    }

    // 3. Manual order via fractional keys
    await noteService.setOrder(tmpVault, '', 'Zeta.md', null, null); // sets key
    const manualSortRes = await noteService.listNotes(tmpVault, { sortBy: 'manual' });
    expect(manualSortRes.ok).toBe(true);
    if (manualSortRes.ok) {
      const items = manualSortRes.value;
      expect(items[0]?.path).toBe('Beta.md'); // Pinned
    }
  });

  it('deletes note by unpinning and sending to Recycle Bin', async () => {
    const notePath = 'Obsolete.md';
    await noteService.saveNote(tmpVault, notePath, '# Obsolete');
    await noteService.setPinned(tmpVault, notePath, true);

    const delRes = await noteService.deleteNote(tmpVault, notePath);
    expect(delRes.ok).toBe(true);

    // Verify dispatched to trashItem
    expect(trashedPaths.length).toBe(1);
    expect(trashedPaths[0]?.replace(/\\/g, '/')).toContain('Obsolete.md');

    // Verify unpinned
    const pins = await orderService.getPins(tmpVault);
    expect(pins).not.toContain(notePath);
  });
});
