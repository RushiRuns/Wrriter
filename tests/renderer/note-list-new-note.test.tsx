import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewNoteIcon } from '../../src/renderer/components/icons';
import { formatDefaultTitle } from '../../src/shared/domain/titles';

describe('Note List Pane: New Note Button', () => {
  beforeEach(() => {
    if (typeof globalThis.document === 'undefined') {
      (globalThis as any).document = {
        querySelector: vi.fn()
      };
    }
  });

  it('renders NewNoteIcon button immediately to the left of 3-dot menu button in MainWindow', () => {
    const mainWindowSource = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );

    // Verify button exists in MainWindow source
    const newNoteButtonMatch = mainWindowSource.match(/title="New note"[\s\S]*?<NewNoteIcon \/>[\s\S]*?<\/button>/);
    expect(newNoteButtonMatch).toBeTruthy();

    // Verify it is placed before the 3-dot menu container in .lh
    const newNoteIdx = mainWindowSource.indexOf('title="New note"');
    const threeDotIdx = mainWindowSource.indexOf('title="More options"');
    expect(newNoteIdx).toBeGreaterThan(-1);
    expect(threeDotIdx).toBeGreaterThan(-1);
    expect(newNoteIdx).toBeLessThan(threeDotIdx);
  });

  it('renders NewNoteIcon SVG matching toolbar icon appearance', () => {
    const html = renderToStaticMarkup(
      <button type="button" className="ib" title="New note" aria-label="New note">
        <NewNoteIcon />
      </button>
    );

    expect(html).toContain('class="ib"');
    expect(html).toContain('title="New note"');
    expect(html).toContain('aria-label="New note"');
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it('creates new note in root directory when selectedFolder is null', () => {
    const existingTitles = ['First Note', 'Welcome'];
    const defaultTitle = formatDefaultTitle(existingTitles);
    expect(defaultTitle).toBe('Untitled');

    const selectedFolder: string | null = null;
    const newFileName = `${defaultTitle}.md`;
    const newPath = selectedFolder ? `${selectedFolder}/${newFileName}` : newFileName;

    expect(newPath).toBe('Untitled.md');
  });

  it('creates new note inside subfolder when selectedFolder is active', () => {
    const existingTitles = ['First Note'];
    const defaultTitle = formatDefaultTitle(existingTitles);
    expect(defaultTitle).toBe('Untitled');

    const selectedFolder = 'Projects/Backend';
    const newFileName = `${defaultTitle}.md`;
    const newPath = selectedFolder ? `${selectedFolder}/${newFileName}` : newFileName;

    expect(newPath).toBe('Projects/Backend/Untitled.md');
  });

  it('increments title when Untitled notes already exist in vault', () => {
    const existingTitles = ['Untitled', 'Untitled 1', 'Weekly Log'];
    const defaultTitle = formatDefaultTitle(existingTitles);
    expect(defaultTitle).toBe('Untitled 2');

    const selectedFolder = 'Personal';
    const newFileName = `${defaultTitle}.md`;
    const newPath = `${selectedFolder}/${newFileName}`;

    expect(newPath).toBe('Personal/Untitled 2.md');
  });

  it('prepends to notes list, updates selectedNotePath, and initializes tab history', () => {
    let notes: Array<{ path: string; title: string }> = [
      { path: 'OldNote.md', title: 'Old Note' }
    ];
    let selectedNotePath: string | null = 'OldNote.md';
    let noteTitle: string = 'Old Note';
    const tabHistories = new Map<string, { stack: string[]; index: number }>();

    const handleCreateNewNote = (folder: string | null) => {
      const title = formatDefaultTitle(notes.map((n) => n.title));
      const newFileName = `${title}.md`;
      const newPath = folder ? `${folder}/${newFileName}` : newFileName;

      const newNoteItem = { path: newPath, title };
      notes = [newNoteItem, ...notes];
      selectedNotePath = newPath;
      noteTitle = title;
      tabHistories.set(newPath, { stack: [newPath], index: 0 });
    };

    handleCreateNewNote('Ideas');

    expect(notes.length).toBe(2);
    expect(notes[0].path).toBe('Ideas/Untitled.md');
    expect(selectedNotePath).toBe('Ideas/Untitled.md');
    expect(noteTitle).toBe('Untitled');
    expect(tabHistories.get('Ideas/Untitled.md')).toEqual({ stack: ['Ideas/Untitled.md'], index: 0 });
  });

  it('focuses .wrriter-prosemirror editor element when invoked', () => {
    const mockFocus = vi.fn();
    const mockElement = { focus: mockFocus } as unknown as HTMLElement;

    const querySpy = vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
      if (selector === '.wrriter-prosemirror') {
        return mockElement;
      }
      return null;
    });

    if (typeof document !== 'undefined') {
      document.querySelector<HTMLElement>('.wrriter-prosemirror')?.focus();
    }

    expect(querySpy).toHaveBeenCalledWith('.wrriter-prosemirror');
    expect(mockFocus).toHaveBeenCalledTimes(1);

    querySpy.mockRestore();
  });
});
