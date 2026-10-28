import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoteRow } from '../../src/renderer/components/NoteRow';
import { FolderTree } from '../../src/renderer/components/FolderTree';
import type { NoteListItem, FolderNode } from '../../src/shared/ipc/contracts';

describe('Drag and Drop Components: NoteRow and FolderTree', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {
      wrriter: {
        note: {
          startDrag: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
          move: vi.fn().mockResolvedValue({ ok: true, value: { affectedCount: 1 } }),
          setOrder: vi.fn().mockResolvedValue({ ok: true, value: undefined })
        },
        folder: {
          rename: vi.fn().mockResolvedValue({ ok: true, value: undefined })
        },
        attachment: {
          importDroppedPath: vi.fn().mockResolvedValue({ ok: true, value: { importedCount: 1, rootName: 'file' } })
        }
      }
    };
  });

  describe('NoteRow', () => {
    const mockNote: NoteListItem = {
      path: 'Ideas.md',
      title: 'Ideas Note',
      preview: 'Some preview text',
      modified: Date.now(),
      pinned: false
    };

    it('renders as draggable', () => {
      const html = renderToStaticMarkup(
        <NoteRow
          note={mockNote}
          isSelected={false}
          showDates={true}
          showPreviews={true}
          showImages={false}
          onSelect={vi.fn()}
          onContextMenu={vi.fn()}
        />
      );

      expect(html).toContain('draggable="true"');
      expect(html).toContain('Ideas Note');
    });
  });

  describe('FolderTree', () => {
    const mockFolders: FolderNode[] = [
      {
        name: 'Projects',
        relPath: 'Projects',
        parentPath: '',
        children: [],
        noteCount: 3
      }
    ];

    it('renders folder rows as draggable', () => {
      const html = renderToStaticMarkup(
        <FolderTree
          folders={mockFolders}
          selectedFolder={null}
          onSelectFolder={vi.fn()}
          totalVaultNotesCount={10}
          onRefresh={vi.fn()}
        />
      );

      expect(html).toContain('draggable="true"');
      expect(html).toContain('Projects');
      expect(html).toContain('Notes');
    });
  });
});
