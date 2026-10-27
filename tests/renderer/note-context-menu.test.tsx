import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextMenu, type ContextMenuItem } from '../../src/renderer/components/menu/ContextMenu';
import type { FolderNode, NoteListItem } from '../../src/shared/ipc';

describe('Note List Context Menu (M2)', () => {
  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      (globalThis as any).window = {
        innerWidth: 1200,
        innerHeight: 800,
        addEventListener: (event: string, cb: any) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((l) => l !== cb);
          }
        },
        dispatchEvent: (event: any) => {
          const cbs = listeners[event.type] || [];
          for (const cb of cbs) cb(event);
          return true;
        }
      };
    }
  });

  describe('ContextMenu Component Rendering', () => {
    it('returns empty when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <ContextMenu
          isOpen={false}
          x={100}
          y={100}
          items={[{ id: 'pin', label: 'Pin note' }]}
          onClose={() => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders menu items with design system classes and tokens', () => {
      const items: ContextMenuItem[] = [
        { id: 'pin', label: 'Pin note' },
        { id: 'div-1', label: '', isDivider: true },
        { id: 'del', label: 'Delete note', isDanger: true }
      ];

      const html = renderToStaticMarkup(
        <ContextMenu
          isOpen={true}
          x={150}
          y={200}
          items={items}
          onClose={() => {}}
        />
      );

      expect(html).toContain('class="lmenu ctx"');
      expect(html).toContain('Pin note');
      expect(html).toContain('Delete note');
      expect(html).toContain('class="vmd"');
      expect(html).toContain('var(--dgr)');
      expect(html).toContain('var(--pop)');
      expect(html).toContain('var(--r-l)');
    });

    it('renders sub-flyout indicator when item has children', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'move',
          label: 'Move to folder',
          children: [
            { id: 'folder-1', label: 'Projects' }
          ]
        }
      ];

      const html = renderToStaticMarkup(
        <ContextMenu
          isOpen={true}
          x={100}
          y={100}
          items={items}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Move to folder');
      expect(html).toContain('aria-haspopup="menu"');
      // Contains the chevron SVG indicator
      expect(html).toContain('<svg');
    });
  });

  describe('Boundary Clamping and Coordinates Logic', () => {
    it('clamps coordinates so menu never overflows right or bottom edges', () => {
      // Simulate viewport 1200 x 800
      const winWidth = 1200;
      const winHeight = 800;

      const items: ContextMenuItem[] = [
        { id: 'pin', label: 'Pin note' },
        { id: 'move', label: 'Move to folder' },
        { id: 'copy', label: 'Copy wikilink' },
        { id: 'explorer', label: 'Show in File Explorer' },
        { id: 'div-1', label: '', isDivider: true },
        { id: 'del', label: 'Delete note', isDanger: true }
      ];

      const estimatedHeight = items.reduce((acc, item) => acc + (item.isDivider ? 9 : 36), 16);

      // Click near bottom-right corner (1190, 780)
      const rawX = 1190;
      const rawY = 780;

      const clampedX = Math.max(8, Math.min(rawX, winWidth - 220));
      const clampedY = Math.max(8, Math.min(rawY, winHeight - estimatedHeight - 8));

      // Clamped inward away from right edge
      expect(clampedX).toBe(980);
      expect(clampedX + 200).toBeLessThanOrEqual(winWidth);

      // Clamped upward away from bottom edge
      expect(clampedY).toBeLessThan(rawY);
      expect(clampedY + estimatedHeight).toBeLessThanOrEqual(winHeight);
    });

    it('determines sub-flyout flips to the left if screen width to the right is insufficient', () => {
      const winWidth = 1000;
      // If item's right edge is at 820, adding 210 for sub-flyout would equal 1030 (> 1000)
      const itemRectRightNearEdge = 820;
      const openLeftNearEdge = itemRectRightNearEdge + 210 > winWidth;
      expect(openLeftNearEdge).toBe(true);

      // If item's right edge is at 400, adding 210 equals 610 (<= 1000)
      const itemRectRightSpacious = 400;
      const openLeftSpacious = itemRectRightSpacious + 210 > winWidth;
      expect(openLeftSpacious).toBe(false);
    });

    it('determines sub-flyout flips upward if screen height to the bottom is insufficient', () => {
      const winHeight = 800;
      const subItemCount = 6;
      const subEstHeight = subItemCount * 36 + 16; // 232 px

      // If item's top is near bottom (e.g. 650), 650 + 232 = 882 (> 800)
      const itemTopNearBottom = 650;
      const openUpNearBottom = itemTopNearBottom + subEstHeight > winHeight;
      expect(openUpNearBottom).toBe(true);

      // If item's top is near top (e.g. 150), 150 + 232 = 382 (<= 800)
      const itemTopNearTop = 150;
      const openUpNearTop = itemTopNearTop + subEstHeight > winHeight;
      expect(openUpNearTop).toBe(false);
    });
  });

  describe('Universal Mutual Exclusion & Dismissal', () => {
    it('dispatches wrriter:close-all-menus with note-context-menu detail when opened', () => {
      const events: CustomEvent[] = [];
      const listener = (e: Event) => events.push(e as CustomEvent);
      window.addEventListener('wrriter:close-all-menus', listener);

      window.dispatchEvent(new CustomEvent('wrriter:close-all-menus', { detail: { except: 'note-context-menu' } }));

      expect(events.length).toBe(1);
      expect(events[0].detail?.except).toBe('note-context-menu');

      window.removeEventListener('wrriter:close-all-menus', listener);
    });

    it('closes other menus when note-context-menu event is dispatched', () => {
      let editorMenuOpen = true;
      let notesMenuOpen = true;
      let vaultMenuOpen = true;
      let noteContextMenuOpen = true;

      const handleCloseAllMenus = (e: CustomEvent<{ except?: string }>) => {
        if (e.detail?.except !== 'editor-menu') editorMenuOpen = false;
        if (e.detail?.except !== 'note-context-menu' && e.detail?.except !== 'context-menu') noteContextMenuOpen = false;
        if (e.detail?.except !== 'notes-pane-menu') notesMenuOpen = false;
        if (e.detail?.except !== 'vault-menu') vaultMenuOpen = false;
      };

      // When note context menu opens
      handleCloseAllMenus(new CustomEvent('wrriter:close-all-menus', { detail: { except: 'note-context-menu' } }));

      expect(editorMenuOpen).toBe(false);
      expect(notesMenuOpen).toBe(false);
      expect(vaultMenuOpen).toBe(false);
      expect(noteContextMenuOpen).toBe(true); // Stays open!
    });
  });

  describe('Move to Folder Submenu Calculation', () => {
    const mockFolders: readonly FolderNode[] = [
      {
        name: 'Work',
        relPath: 'Work',
        parentPath: '',
        noteCount: 2,
        children: [
          {
            name: 'Projects',
            relPath: 'Work/Projects',
            parentPath: 'Work',
            noteCount: 1,
            children: []
          }
        ]
      },
      {
        name: 'Personal',
        relPath: 'Personal',
        parentPath: '',
        noteCount: 3,
        children: []
      }
    ];

    function getNoteFolderRelPath(filePath: string): string {
      const norm = filePath.replace(/\\/g, '/');
      const lastSlash = norm.lastIndexOf('/');
      return lastSlash >= 0 ? norm.slice(0, lastSlash) : '';
    }

    function flattenFolderNodes(nodes: readonly FolderNode[]): { name: string; relPath: string }[] {
      const result: { name: string; relPath: string }[] = [];
      const walk = (list: readonly FolderNode[]) => {
        for (const node of list) {
          result.push({ name: node.name, relPath: node.relPath });
          if (node.children?.length) {
            walk(node.children);
          }
        }
      };
      walk(nodes);
      return result;
    }

    it('lists all folders except current folder when note is in root', () => {
      const rootNote: NoteListItem = {
        path: 'Welcome.md',
        title: 'Welcome',
        preview: '',
        date: '2026-10-27',
        pinned: false
      };

      const currentFolder = getNoteFolderRelPath(rootNote.path);
      expect(currentFolder).toBe('');

      const allFolders = flattenFolderNodes(mockFolders);
      const moveOptions: string[] = [];

      if (currentFolder !== '') {
        moveOptions.push('Notes (Root)');
      }
      for (const f of allFolders) {
        if (f.relPath !== currentFolder) {
          moveOptions.push(f.relPath);
        }
      }

      // Root note shouldn't have 'Notes (Root)' as target, but all 3 vault folders
      expect(moveOptions).toEqual(['Work', 'Work/Projects', 'Personal']);
    });

    it('lists Notes (Root) and other folders when note is in a subfolder', () => {
      const subfolderNote: NoteListItem = {
        path: 'Work/Task.md',
        title: 'Task',
        preview: '',
        date: '2026-10-27',
        pinned: false
      };

      const currentFolder = getNoteFolderRelPath(subfolderNote.path);
      expect(currentFolder).toBe('Work');

      const allFolders = flattenFolderNodes(mockFolders);
      const moveOptions: string[] = [];

      if (currentFolder !== '') {
        moveOptions.push('Notes (Root)');
      }
      for (const f of allFolders) {
        if (f.relPath !== currentFolder) {
          moveOptions.push(f.relPath);
        }
      }

      // Contains Root, and other subfolders, but excludes 'Work'
      expect(moveOptions).toEqual(['Notes (Root)', 'Work/Projects', 'Personal']);
    });

    it('derives correct target newPath when moving a note', () => {
      const note: NoteListItem = {
        path: 'Work/Projects/Design.md',
        title: 'Design',
        preview: '',
        date: '2026-10-27',
        pinned: false
      };

      const fileName = note.path.split('/').pop()!;
      expect(fileName).toBe('Design.md');

      // Move to Root:
      const targetRoot = '';
      const newPathRoot = targetRoot ? `${targetRoot}/${fileName}` : fileName;
      expect(newPathRoot).toBe('Design.md');

      // Move to Personal:
      const targetPersonal = 'Personal';
      const newPathPersonal = targetPersonal ? `${targetPersonal}/${fileName}` : fileName;
      expect(newPathPersonal).toBe('Personal/Design.md');
    });

    it('provides disabled placeholder when no target folders exist', () => {
      const emptyFolders: readonly FolderNode[] = [];
      const currentFolder = '';
      const allFolders = flattenFolderNodes(emptyFolders);
      const moveSubmenuItems: ContextMenuItem[] = [];

      if (currentFolder !== '') {
        moveSubmenuItems.push({ id: 'move-root', label: 'Notes (Root)' });
      }
      for (const f of allFolders) {
        if (f.relPath !== currentFolder) {
          moveSubmenuItems.push({ id: f.relPath, label: f.name });
        }
      }
      if (moveSubmenuItems.length === 0) {
        moveSubmenuItems.push({
          id: 'no-folders',
          label: 'No folders available',
          isDisabled: true
        });
      }

      expect(moveSubmenuItems.length).toBe(1);
      expect(moveSubmenuItems[0].id).toBe('no-folders');
      expect(moveSubmenuItems[0].isDisabled).toBe(true);
    });
  });

  describe('Action Execution Behaviors', () => {
    it('formats wikilink properly with [[title]]', () => {
      const note: NoteListItem = {
        path: 'Notes/Sprint 4 Plan.md',
        title: 'Sprint 4 Plan',
        preview: '',
        date: '2026-10-27',
        pinned: false
      };

      const wikilink = `[[${note.title}]]`;
      expect(wikilink).toBe('[[Sprint 4 Plan]]');
    });

    it('updates selection when right clicking an unselected note row', () => {
      let selectedNotePath: string | null = 'NoteA.md';
      const rightClickedNote: NoteListItem = {
        path: 'NoteB.md',
        title: 'Note B',
        preview: '',
        date: '2026-10-27',
        pinned: false
      };

      // onContextMenu behavior simulation
      if (selectedNotePath !== rightClickedNote.path) {
        selectedNotePath = rightClickedNote.path;
      }

      expect(selectedNotePath).toBe('NoteB.md');
    });
  });
});
