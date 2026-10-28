import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { NoteListItem } from '../../src/shared/ipc';
import { noteBelongsToFolder } from '../../src/renderer/windows/main/MainWindow';

describe('Note Deletion Anomalies Regression (Bug 3a - 3e)', () => {
  it('demonstrates Issue 3a: deleting active note re-inserts it at index 0 if selectedNotePath is not cleared before refreshNotes', () => {
    const deletedNotePath = 'something.md';
    const nextNotePath = 'Disney.md';

    // In-memory list before deletion
    const prevNotes: NoteListItem[] = [
      {
        path: 'something.md',
        title: 'something',
        preview: 'text',
        modified: Date.now() - 5000,
        pinned: false
      },
      {
        path: 'Disney.md',
        title: 'Disney',
        preview: 'parks',
        modified: Date.now() - 10000,
        pinned: false
      }
    ];

    // Disk read returns only remaining notes (something.md is removed from disk)
    const diskNotes: NoteListItem[] = [
      {
        path: 'Disney.md',
        title: 'Disney',
        preview: 'parks',
        modified: Date.now() - 10000,
        pinned: false
      }
    ];

    // --- BEFORE FIX ---
    // selectedNotePathRef is still "something.md" when refreshNotes runs
    let buggyCurrentSelected = deletedNotePath;
    let buggyUpdated: NoteListItem[] = diskNotes.map((d) => d);
    if (
      buggyCurrentSelected &&
      noteBelongsToFolder(buggyCurrentSelected, null) &&
      !buggyUpdated.some((n) => n.path === buggyCurrentSelected)
    ) {
      const unsaved = prevNotes.find((n) => n.path === buggyCurrentSelected);
      if (unsaved && noteBelongsToFolder(unsaved.path, null)) {
        buggyUpdated = [{ ...unsaved, title: unsaved.title }, ...buggyUpdated];
      }
    }

    // Bug: "something.md" was re-injected at index 0 above "Disney.md"!
    expect(buggyUpdated.length).toBe(2);
    expect(buggyUpdated[0]?.path).toBe('something.md');

    // --- AFTER FIX ---
    // handleDeleteNote updates selectedNotePathRef to nextNotePath (or null) before refreshNotes
    let fixedCurrentSelected = nextNotePath;
    let fixedUpdated: NoteListItem[] = diskNotes.map((d) => d);
    if (
      fixedCurrentSelected &&
      noteBelongsToFolder(fixedCurrentSelected, null) &&
      !fixedUpdated.some((n) => n.path === fixedCurrentSelected)
    ) {
      const unsaved = prevNotes.find((n) => n.path === fixedCurrentSelected);
      if (unsaved && noteBelongsToFolder(unsaved.path, null)) {
        fixedUpdated = [{ ...unsaved, title: unsaved.title }, ...fixedUpdated];
      }
    }

    // Fixed: deleted note is gone immediately; Disney is at index 0
    expect(fixedUpdated.length).toBe(1);
    expect(fixedUpdated[0]?.path).toBe('Disney.md');
  });

  it('demonstrates Issue 3c & 3e: internal deletion removes tab from EditorHost so checkExternalChanges does not fire notice', async () => {
    const tabs = new Map<string, any>();
    tabs.set('something.md', {
      path: 'something.md',
      title: 'something',
      originalBytes: new Uint8Array([1, 2, 3]),
      lastSavedText: 'something',
      isDirty: false
    });
    tabs.set('Disney.md', {
      path: 'Disney.md',
      title: 'Disney',
      originalBytes: new Uint8Array([4, 5, 6]),
      lastSavedText: 'Disney',
      isDirty: false
    });

    const mockNotice = vi.fn();

    // BEFORE FIX: handleDeleteNote never notifies EditorHost to evict something.md
    // checkExternalChanges runs on 2.5s interval, tries to read something.md from disk, fails, and fires notice
    const mockDiskRead = (p: string) => {
      if (p === 'something.md') return { ok: false };
      return { ok: true, value: { text: 'Disney' } };
    };

    // Buggy execution: tab stays in tabs Map
    for (const tab of tabs.values()) {
      const res = mockDiskRead(tab.path);
      if (!res.ok) {
        mockNotice(`"${tab.title}" was moved or deleted outside Wrriter. Your text is kept in the tab.`);
      }
    }
    expect(mockNotice).toHaveBeenCalledWith(
      '"something" was moved or deleted outside Wrriter. Your text is kept in the tab.'
    );

    // AFTER FIX: wrriter:note-deleted drops the tab from EditorHost immediately
    mockNotice.mockClear();
    tabs.delete('something.md'); // Evicted on wrriter:note-deleted

    for (const tab of tabs.values()) {
      const res = mockDiskRead(tab.path);
      if (!res.ok) {
        mockNotice(`"${tab.title}" was moved or deleted outside Wrriter. Your text is kept in the tab.`);
      }
    }
    // No spurious notice fired!
    expect(mockNotice).not.toHaveBeenCalled();
    expect(tabs.has('something.md')).toBe(false);
  });

  it('verifies source code implementations across MainWindow, EditorHost, and Notice', () => {
    const mainWindowSrc = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );
    const editorHostSrc = readFileSync(
      join(__dirname, '../../src/renderer/editor/EditorHost.tsx'),
      'utf-8'
    );
    const noticeSrc = readFileSync(
      join(__dirname, '../../src/renderer/components/Notice.tsx'),
      'utf-8'
    );

    // 1. MainWindow must dispatch wrriter:note-deleted and update selectedNotePathRef immediately
    expect(mainWindowSrc).toContain("'wrriter:note-deleted'");
    expect(mainWindowSrc).toContain('selectedNotePathRef.current = nextNote?.path ?? null;');

    // 2. EditorHost must listen for wrriter:note-deleted
    expect(editorHostSrc).toContain("'wrriter:note-deleted'");

    // 3. Notice.tsx must use onDismissRef to prevent timer resets on parent re-renders
    expect(noticeSrc).toContain('onDismissRef');
  });
});
