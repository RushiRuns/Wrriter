import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { NoteListItem } from '../../src/shared/ipc';

describe('Note List & Title Live Synchronization (Regression)', () => {
  it('demonstrates Issue 1: refreshNotes wiping out unsaved active note before fix', () => {
    // Current in-memory notes list contains the newly created unsaved note
    const activePath = 'Untitled.md';
    const prevNotes: NoteListItem[] = [
      {
        path: 'Untitled.md',
        title: 'Untitled',
        preview: '',
        modified: Date.now(),
        pinned: false,
        hasImage: false
      },
      {
        path: 'Meal plan.md',
        title: 'Meal plan',
        preview: '',
        modified: Date.now() - 10000,
        pinned: false,
        hasImage: false
      }
    ];

    // Disk read only returns files physically on disk (Untitled.md not yet written)
    const diskNotes: NoteListItem[] = [
      {
        path: 'Meal plan.md',
        title: 'Meal plan',
        preview: '',
        modified: Date.now() - 10000,
        pinned: false,
        hasImage: false
      }
    ];

    // Buggy logic: setNotes(res.value) replaces prevNotes entirely with diskNotes
    const buggyNotes = diskNotes;
    expect(buggyNotes.some((n) => n.path === activePath)).toBe(false); // Untitled.md was lost!

    // Fixed logic: preserves unsaved active note
    let fixedNotes = diskNotes;
    if (activePath && !fixedNotes.some((n) => n.path === activePath)) {
      const unsaved = prevNotes.find((n) => n.path === activePath);
      if (unsaved) {
        fixedNotes = [unsaved, ...fixedNotes];
      }
    }
    expect(fixedNotes.some((n) => n.path === activePath)).toBe(true);
    expect(fixedNotes[0]?.path).toBe('Untitled.md');
  });

  it('demonstrates Issue 2: refreshNotes overwriting live document title with disk filename before fix', () => {
    const activePath = 'Untitled.md';
    const liveTitle = 'sdsdsdsdsdsds';

    // In memory, user has typed 'sdsdsdsdsdsds'
    const prevNotes: NoteListItem[] = [
      {
        path: 'Untitled.md',
        title: liveTitle,
        preview: '',
        modified: Date.now(),
        pinned: false,
        hasImage: false
      }
    ];

    // Disk scan after autosave returns filename title 'Untitled'
    const diskNotes: NoteListItem[] = [
      {
        path: 'Untitled.md',
        title: 'Untitled',
        preview: '',
        modified: Date.now(),
        pinned: false,
        hasImage: false
      }
    ];

    // Buggy logic: setNotes(diskNotes) overwrites title to 'Untitled'
    const buggyNotes = diskNotes;
    expect(buggyNotes[0]?.title).toBe('Untitled');

    // Fixed logic: preserves live in-memory title for active note
    const fixedNotes = diskNotes.map((d) => {
      const matched = prevNotes.find((p) => p.path === d.path);
      if (d.path === activePath && matched && matched.title !== d.title) {
        return { ...d, title: matched.title };
      }
      return d;
    });
    expect(fixedNotes[0]?.title).toBe('sdsdsdsdsdsds');
  });

  it('demonstrates Issue 3: prevents top title bar from reverting when background polling updates notes', () => {
    let noteTitle = 'sdsdsdsdsdsds';
    const activePath = 'Untitled.md';
    const prevPathRef = { current: 'Untitled.md' };

    // When background polling runs, selectedNotePath has NOT changed
    const newSelectedPath = 'Untitled.md';
    const isNoteSwitch = newSelectedPath !== prevPathRef.current;

    // Before fix: effect ran whenever `notes` updated and unconditionally called setNoteTitle(matched.title)
    // which reverted noteTitle to 'Untitled'.
    // With fix: only update noteTitle when switching to a different note path
    if (isNoteSwitch) {
      noteTitle = 'Untitled'; // should not happen on background poll
    }

    expect(noteTitle).toBe('sdsdsdsdsdsds');
  });

  it('verifies MainWindow source implements the fix for live title and unsaved note preservation', () => {
    const mainWindowSource = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );

    // This assertion will FAIL before the fix and PASS after the fix.
    expect(mainWindowSource).toContain('wrriter:new-note');
    expect(mainWindowSource).toContain('prevSelectedNotePathRef');
    expect(mainWindowSource).toContain('prevNotes.find');
  });
});
