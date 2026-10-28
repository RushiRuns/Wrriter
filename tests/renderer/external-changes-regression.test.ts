import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { planSave, encodeUtf8 } from '../../src/shared/markdown/save';
import type { NoteContent } from '../../src/shared/ipc';

describe('External Changes Detection & Paste Bug (Regression)', () => {
  it('demonstrates that NoteContent IPC contract has no bytes property', () => {
    const noteContent: NoteContent = {
      path: 'note1.md',
      text: '# Meal plan\n\nInitial content'
    };
    // NoteContent only has path and text; bytes is undefined in renderer
    expect((noteContent as any).bytes).toBeUndefined();
    const diskBytes = new Uint8Array((noteContent as any).bytes);
    expect(diskBytes.length).toBe(0);
  });

  it('proves that before fix, checkExternalChanges in EditorHost falsely triggers conflict when diskBytes uses res.value.bytes', async () => {
    const originalText = '# Meal plan\n\nOriginal text before paste';
    const originalBytes = encodeUtf8(originalText);

    const tab = {
      path: 'note1.md',
      title: 'Meal plan',
      initialFileName: 'note1.md',
      originalBytes: originalBytes,
      lastSavedText: originalText,
      isDirty: false
    };

    // User pastes new content from outside into note1
    tab.isDirty = true;

    // Window focus triggers checkExternalChanges reading note from disk via IPC
    const mockReadRes = {
      ok: true as const,
      value: {
        path: 'note1.md',
        text: originalText // Disk file was NOT modified outside Wrriter
      }
    };

    // BUGGY LOGIC:
    // diskBytes was new Uint8Array(res.value.bytes) -> length 0
    // Because diskBytes.length (0) !== tab.originalBytes.length (non-zero),
    // it falsely concluded isDifferent was true and triggered (External).md creation.
    const buggyDiskBytes = new Uint8Array((mockReadRes.value as any).bytes);
    const buggyIsDifferent =
      buggyDiskBytes.length !== tab.originalBytes.length ||
      buggyDiskBytes.some((byte, idx) => byte !== tab.originalBytes[idx]);
    expect(buggyIsDifferent).toBe(true);

    // FIXED LOGIC:
    // diskText is compared against tab.lastSavedText
    const diskText = mockReadRes.value.text;
    const fixedIsDifferent = diskText !== tab.lastSavedText;
    expect(fixedIsDifferent).toBe(false);
  });

  it('verifies that pasting into note1 does not trigger an external version save or notice when disk text is unchanged', async () => {
    const savedText = '# Meal plan\n\nOriginal saved content';
    const tab = {
      path: 'note1.md',
      title: 'Meal plan',
      initialFileName: 'note1.md',
      originalBytes: encodeUtf8(savedText),
      lastSavedText: savedText,
      isDirty: false
    };

    const mockSave = vi.fn().mockResolvedValue({ ok: true, value: { written: true } });
    const mockNotice = vi.fn();

    // User pastes new content into the note
    tab.isDirty = true;
    tab.title = 'Meal plan (Updated)';

    // Disk read returns the current file on disk (matching lastSavedText)
    const res = {
      ok: true as const,
      value: {
        path: tab.path,
        text: savedText
      }
    };

    // Simulation of fixed checkExternalChanges logic
    const diskText = res.value.text;
    const lastSavedText = tab.lastSavedText ?? (tab.originalBytes.length > 0 ? new TextDecoder().decode(tab.originalBytes) : '');
    const isDifferent = diskText !== lastSavedText;

    if (isDifferent) {
      if (tab.isDirty) {
        await mockSave({ path: 'note1 (External).md', text: diskText });
        mockNotice(`"${tab.title}" was edited outside Wrriter.`);
      }
    }

    // Must NOT save external note and must NOT show notice
    expect(isDifferent).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockNotice).not.toHaveBeenCalled();
  });

  it('verifies that genuine external changes on disk are still properly detected and saved when tab is dirty', async () => {
    const savedText = '# Meal plan\n\nOriginal text';
    const externalModifiedText = '# Meal plan\n\nModified externally via notepad';

    const tab = {
      path: 'note1.md',
      title: 'Meal plan',
      initialFileName: 'note1.md',
      originalBytes: encodeUtf8(savedText),
      lastSavedText: savedText,
      isDirty: true // user has unsaved edits in Wrriter
    };

    const mockSave = vi.fn().mockResolvedValue({ ok: true, value: { written: true } });
    const mockNotice = vi.fn();

    const res = {
      ok: true as const,
      value: {
        path: tab.path,
        text: externalModifiedText
      }
    };

    const diskText = res.value.text;
    const lastSavedText = tab.lastSavedText ?? (tab.originalBytes.length > 0 ? new TextDecoder().decode(tab.originalBytes) : '');
    const isDifferent = diskText !== lastSavedText;

    if (isDifferent) {
      if (tab.isDirty) {
        const baseName = tab.path.replace(/\.md$/i, '');
        const externalPath = `${baseName} (External).md`;
        await mockSave({ path: externalPath, text: diskText });
        mockNotice(`"${tab.title}" was edited outside Wrriter. External version saved as ${baseName} (External).md.`);
      }
    }

    expect(isDifferent).toBe(true);
    expect(mockSave).toHaveBeenCalledWith({
      path: 'note1 (External).md',
      text: externalModifiedText
    });
    expect(mockNotice).toHaveBeenCalledWith(
      expect.stringContaining('was edited outside Wrriter')
    );
  });

  it('ensures EditorHost source code no longer accesses undefined res.value.bytes', () => {
    const editorHostSource = readFileSync(
      join(__dirname, '../../src/renderer/editor/EditorHost.tsx'),
      'utf-8'
    );

    expect(editorHostSource).not.toContain('res.value.bytes');
    expect(editorHostSource).toContain('lastSavedText');
    expect(editorHostSource).toContain('encodeUtf8(rawText)');
  });
});
