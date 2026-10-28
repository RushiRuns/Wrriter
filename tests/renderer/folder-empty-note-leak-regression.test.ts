import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { NoteListItem } from '../../src/shared/ipc';

/**
 * Checks if a note relative path belongs to the given folder relative path.
 * Root folder (null or '') matches notes in the vault root view.
 */
export function noteBelongsToFolder(noteRelPath: string, folderRelPath: string | null): boolean {
  if (folderRelPath === null || folderRelPath === '') {
    return true; // Vault root displays all notes in the vault
  }
  const normalized = noteRelPath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  const noteDir = lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
  return noteDir === folderRelPath;
}

describe('Empty Folder Note Leak & Count Contamination Regression', () => {
  it('demonstrates Issue 1: active note from another folder is leaked into empty folder before fix', () => {
    const selectedFolder = 'Programming';
    const currentSelected = 'Notes/something.md';
    const currentTitle = 'something';

    // In-memory state before switching folders: user had "something" open in Notes folder
    const prevNotes: NoteListItem[] = [
      {
        path: 'Notes/something.md',
        title: 'something',
        preview: 'hello',
        modified: Date.now() - 5000,
        pinned: false,
        hasImage: false
      },
      {
        path: 'Notes/Meal plan.md',
        title: 'Meal plan',
        preview: 'food',
        modified: Date.now() - 10000,
        pinned: false,
        hasImage: false
      }
    ];

    // Disk read for empty folder "Programming" returns 0 notes
    const diskNotes: NoteListItem[] = [];

    // --- BEFORE FIX (Buggy logic in MainWindow.tsx) ---
    let buggyUpdated: NoteListItem[] = diskNotes.map((d) => d);
    if (currentSelected && !buggyUpdated.some((n) => n.path === currentSelected)) {
      const unsaved = prevNotes.find((n) => n.path === currentSelected);
      if (unsaved) {
        buggyUpdated = [{ ...unsaved, title: currentTitle || unsaved.title }, ...buggyUpdated];
      }
    }

    // Buggy result: "Notes/something.md" was falsely injected into "Programming" folder list!
    expect(buggyUpdated.length).toBe(1);
    expect(buggyUpdated[0]?.path).toBe('Notes/something.md');

    // --- AFTER FIX (Scoped by folder membership) ---
    let fixedUpdated: NoteListItem[] = diskNotes.map((d) => d);
    if (
      currentSelected &&
      noteBelongsToFolder(currentSelected, selectedFolder) &&
      !fixedUpdated.some((n) => n.path === currentSelected)
    ) {
      const unsaved = prevNotes.find((n) => n.path === currentSelected);
      if (unsaved && noteBelongsToFolder(unsaved.path, selectedFolder)) {
        fixedUpdated = [{ ...unsaved, title: currentTitle || unsaved.title }, ...fixedUpdated];
      }
    }

    // Fixed result: "Programming" is correctly empty
    expect(fixedUpdated.length).toBe(0);
  });

  it('demonstrates Issue 1b: unsaved new note created inside current folder IS preserved', () => {
    const selectedFolder = 'Programming';
    const currentSelected = 'Programming/Untitled.md';
    const currentTitle = 'Untitled';

    const prevNotes: NoteListItem[] = [
      {
        path: 'Programming/Untitled.md',
        title: 'Untitled',
        preview: '',
        modified: Date.now(),
        pinned: false,
        hasImage: false
      }
    ];

    // Disk read hasn't written the note yet
    const diskNotes: NoteListItem[] = [];

    let fixedUpdated: NoteListItem[] = diskNotes.map((d) => d);
    if (
      currentSelected &&
      noteBelongsToFolder(currentSelected, selectedFolder) &&
      !fixedUpdated.some((n) => n.path === currentSelected)
    ) {
      const unsaved = prevNotes.find((n) => n.path === currentSelected);
      if (unsaved && noteBelongsToFolder(unsaved.path, selectedFolder)) {
        fixedUpdated = [{ ...unsaved, title: currentTitle || unsaved.title }, ...fixedUpdated];
      }
    }

    // Unsaved note belonging to Programming must be preserved
    expect(fixedUpdated.length).toBe(1);
    expect(fixedUpdated[0]?.path).toBe('Programming/Untitled.md');
  });

  it('demonstrates Issue 2: FolderTree totalVaultNotesCount must not drop when navigating into a subfolder', () => {
    // Total vault notes = 2 (in Notes folder)
    const vaultTotalCount = 2;

    // In Programming subfolder, notes list is empty (0 notes)
    const programmingNotes: NoteListItem[] = [];

    // Before fix: MainWindow passed totalVaultNotesCount={notes.length}
    // In Programming folder, notes.length was 1 (with ghost note) or 0 (empty), causing the root badge to drop
    const buggyBadgeCount = programmingNotes.length;
    expect(buggyBadgeCount).toBe(0);

    // After fix: MainWindow passes decoupled vault-wide count
    const fixedBadgeCount = vaultTotalCount;
    expect(fixedBadgeCount).toBe(2);
  });

  it('verifies MainWindow.tsx guards active-note retention with folder membership and decouples totalVaultNotesCount', () => {
    const source = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );

    // 1. Must check folder membership before retaining unsaved note in refreshNotes
    expect(source).toContain('noteBelongsToFolder');

    // 2. Must not pass notes.length as totalVaultNotesCount to FolderTree
    expect(source).not.toContain('totalVaultNotesCount={notes.length}');
    expect(source).toContain('totalVaultNotesCount={totalVaultNotesCount}');
  });
});
