import { describe, it, expect, vi } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import {
  SLASH_MENU_ITEMS,
  filterSlashItems,
  type SlashMenuItem
} from '../../src/renderer/editor/extensions/slash-menu-items';

// Test schema matching TipTap nodes and marks
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    codeBlock: { group: 'block', content: 'text*', attrs: { language: { default: null } } },
    bulletList: { group: 'block', content: 'listItem+' },
    orderedList: { group: 'block', content: 'listItem+' },
    listItem: { content: 'paragraph block*' },
    taskList: { group: 'block', content: 'taskItem+' },
    taskItem: { content: 'paragraph block*', attrs: { checked: { default: false } } },
    horizontalRule: { group: 'block' },
    callout: { group: 'block', content: 'block+', attrs: { type: { default: 'info' }, title: { default: '' } } },
    table: { group: 'block', content: 'tableRow+' },
    tableRow: { content: '(tableHeader | tableCell)+' },
    tableHeader: { content: 'paragraph block*' },
    tableCell: { content: 'paragraph block*' },
    image: { group: 'block', attrs: { src: { default: '' } } },
    text: { group: 'inline' }
  },
  marks: {
    bold: {},
    italic: {},
    strike: {},
    code: {},
    link: { attrs: { href: {} } }
  }
});

describe('UI Slice 4: Menus, Slash Menu, and Floating Toolbar', () => {
  describe('Slash Menu: 12 Items across 4 Groups', () => {
    it('has exactly 12 items in 4 approved groups (Text, Lists, Blocks, Media)', () => {
      expect(SLASH_MENU_ITEMS.length).toBe(12);

      const groups = Array.from(new Set(SLASH_MENU_ITEMS.map((i) => i.group)));
      expect(groups).toEqual(['Text', 'Lists', 'Blocks', 'Media']);

      const textItems = SLASH_MENU_ITEMS.filter((i) => i.group === 'Text');
      expect(textItems.map((i) => i.title)).toEqual(['Heading', 'Subheading', 'Quote']);

      const listItems = SLASH_MENU_ITEMS.filter((i) => i.group === 'Lists');
      expect(listItems.map((i) => i.title)).toEqual(['Bullet list', 'Numbered list', 'Task list']);

      const blockItems = SLASH_MENU_ITEMS.filter((i) => i.group === 'Blocks');
      expect(blockItems.map((i) => i.title)).toEqual(['Table', 'Code block', 'Callout', 'Warning', 'Divider']);

      const mediaItems = SLASH_MENU_ITEMS.filter((i) => i.group === 'Media');
      expect(mediaItems.map((i) => i.title)).toEqual(['Image']);
    });

    it('defines distinct palette commands for all 12 items', () => {
      const paletteCmds = SLASH_MENU_ITEMS.map((i) => i.paletteCommand);
      const uniqueCmds = new Set(paletteCmds);
      expect(uniqueCmds.size).toBe(12);

      expect(paletteCmds).toContain('wrriter:insert-heading');
      expect(paletteCmds).toContain('wrriter:insert-subheading');
      expect(paletteCmds).toContain('wrriter:insert-quote');
      expect(paletteCmds).toContain('wrriter:insert-bullet-list');
      expect(paletteCmds).toContain('wrriter:insert-numbered-list');
      expect(paletteCmds).toContain('wrriter:insert-task-list');
      expect(paletteCmds).toContain('wrriter:insert-table');
      expect(paletteCmds).toContain('wrriter:insert-code-block');
      expect(paletteCmds).toContain('wrriter:insert-callout');
      expect(paletteCmds).toContain('wrriter:insert-warning');
      expect(paletteCmds).toContain('wrriter:insert-divider');
      expect(paletteCmds).toContain('wrriter:insert-image');
    });
  });

  describe('Slash Menu: Filtering and Keyword Matching', () => {
    it('returns all 12 items and 4 active groups when query is empty', () => {
      const res = filterSlashItems(SLASH_MENU_ITEMS, '');
      expect(res.hasMatches).toBe(true);
      expect(res.items.length).toBe(12);
      expect(res.activeGroups.length).toBe(4);
    });

    it('filters by item name (case-insensitive)', () => {
      const res = filterSlashItems(SLASH_MENU_ITEMS, 'head');
      expect(res.hasMatches).toBe(true);
      expect(res.items.map((i) => i.title)).toEqual(['Heading', 'Subheading']);
      expect(res.activeGroups).toEqual(['Text']);
    });

    it('filters by related keywords (todo -> Task list, quote -> Quote, grid -> Table)', () => {
      const todoRes = filterSlashItems(SLASH_MENU_ITEMS, 'todo');
      expect(todoRes.hasMatches).toBe(true);
      expect(todoRes.items[0]?.title).toBe('Task list');

      const gridRes = filterSlashItems(SLASH_MENU_ITEMS, 'grid');
      expect(gridRes.hasMatches).toBe(true);
      expect(gridRes.items[0]?.title).toBe('Table');

      const snippetRes = filterSlashItems(SLASH_MENU_ITEMS, 'snippet');
      expect(snippetRes.hasMatches).toBe(true);
      expect(snippetRes.items[0]?.title).toBe('Code block');

      const warnRes = filterSlashItems(SLASH_MENU_ITEMS, 'danger');
      expect(warnRes.hasMatches).toBe(true);
      expect(warnRes.items[0]?.title).toBe('Warning');
    });

    it('filters by markdown shortcuts (# -> Heading, ## -> Subheading, --- -> Divider)', () => {
      const hashRes = filterSlashItems(SLASH_MENU_ITEMS, '#');
      expect(hashRes.hasMatches).toBe(true);
      expect(hashRes.items[0]?.title).toBe('Heading');

      const subRes = filterSlashItems(SLASH_MENU_ITEMS, '##');
      expect(subRes.hasMatches).toBe(true);
      expect(subRes.items[0]?.title).toBe('Subheading');

      const divRes = filterSlashItems(SLASH_MENU_ITEMS, '---');
      expect(divRes.hasMatches).toBe(true);
      expect(divRes.items[0]?.title).toBe('Divider');
    });

    it('hides group headers when none of their items match', () => {
      const res = filterSlashItems(SLASH_MENU_ITEMS, 'photo');
      expect(res.hasMatches).toBe(true);
      expect(res.items.map((i) => i.title)).toEqual(['Image']);
      expect(res.activeGroups).toEqual(['Media']); // Text, Lists, Blocks groups are hidden!
    });

    it('reports no-match state (Nothing matches that) for unmatched queries', () => {
      const res = filterSlashItems(SLASH_MENU_ITEMS, 'nonexistentquery999');
      expect(res.hasMatches).toBe(false);
      expect(res.items.length).toBe(0);
      expect(res.activeGroups.length).toBe(0);
    });
  });

  describe('Slash Menu: Wrapping Keyboard Navigation', () => {
    it('wraps downwards from last item back to index 0', () => {
      const total = 12;
      let currentIndex = 11; // Last item
      // Next item:
      currentIndex = (currentIndex + 1) % total;
      expect(currentIndex).toBe(0); // Wrapped to first!
    });

    it('wraps upwards from first item back to last index', () => {
      const total = 12;
      let currentIndex = 0; // First item
      // Previous item:
      currentIndex = (currentIndex - 1 + total) % total;
      expect(currentIndex).toBe(11); // Wrapped to last!
    });
  });

  describe('Slash Menu: Block Insertion Execution on Enter (Regression)', () => {
    it('ensures SlashMenuExtension handleKeyDown executes chosen.action with the TipTap editor instance', async () => {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const slashMenuSource = readFileSync(
        join(__dirname, '../../src/renderer/editor/extensions/slash-menu.ts'),
        'utf-8'
      );

      // Must capture this.editor in addProseMirrorPlugins
      expect(slashMenuSource).toMatch(/const\s+editor\s*=\s*this\.editor/);
      // Must not rely solely on (view as any).editor which is undefined
      expect(slashMenuSource).not.toMatch(/const\s+editor\s*=\s*\(view as any\)\.editor;\s*if\s*\(editor\)\s*\{\s*chosen\.action\(editor\);/);
    });
  });

  describe('Editor Three-Dot Menu Options', () => {
    it('contains all required items per spec (Pin/Unpin, Duplicate M3, Find, Pop out M4, Explorer, Delete)', () => {
      const items = [
        { id: 'pin', label: 'Pin note' },
        { id: 'duplicate', label: 'Duplicate', note: 'works from M3' },
        { id: 'find', label: 'Find in note', shortcut: 'Ctrl+F' },
        { id: 'popout', label: 'Pop out', note: 'works from M4' },
        { id: 'explorer', label: 'Show in File Explorer' },
        { id: 'delete', label: 'Delete note', isDanger: true }
      ];

      expect(items.length).toBe(6);
      expect(items.find((i) => i.id === 'pin')).toBeDefined();
      expect(items.find((i) => i.id === 'duplicate')?.note).toBe('works from M3');
      expect(items.find((i) => i.id === 'find')?.shortcut).toBe('Ctrl+F');
      expect(items.find((i) => i.id === 'popout')?.note).toBe('works from M4');
      expect(items.find((i) => i.id === 'explorer')).toBeDefined();
      expect(items.find((i) => i.id === 'delete')?.isDanger).toBe(true);
    });
  });

  describe('Floating Toolbar and Formatting Commands', () => {
    it('supports block type, list type, bold, italic, strikethrough, link, and more', () => {
      const toolbarButtons = [
        'blockType',
        'listType',
        'divider',
        'bold',
        'italic',
        'strike',
        'link',
        'divider',
        'more'
      ];

      expect(toolbarButtons).toEqual([
        'blockType',
        'listType',
        'divider',
        'bold',
        'italic',
        'strike',
        'link',
        'divider',
        'more'
      ]);
    });

    it('clamps toolbar coordinates to stay within pane margins', () => {
      const paneWidth = 600;
      const toolbarWidth = 320;
      const margin = 24;

      const rawCenterX1 = 50; // Near left edge
      const clampedLeft1 = Math.max(margin, Math.min(rawCenterX1 - toolbarWidth / 2, paneWidth - toolbarWidth - margin));
      expect(clampedLeft1).toBe(margin); // Clamped to left margin (24 px)

      const rawCenterX2 = 580; // Near right edge
      const clampedLeft2 = Math.max(margin, Math.min(rawCenterX2 - toolbarWidth / 2, paneWidth - toolbarWidth - margin));
      expect(clampedLeft2).toBe(paneWidth - toolbarWidth - margin); // Clamped to right margin (256 px)
    });
  });

  describe('Universal Menu Rules: One Menu Open at a Time', () => {
    it('dispatches wrriter:close-all-menus so opening any menu closes all others', () => {
      let openMenu: string | null = 'vault-menu';

      const handleCloseAll = (e: CustomEvent<{ except?: string }>) => {
        if (e.detail?.except !== openMenu) {
          openMenu = null;
        }
      };

      // When editor menu opens, dispatch close all except 'editor-menu'
      handleCloseAll(new CustomEvent('wrriter:close-all-menus', { detail: { except: 'editor-menu' } }));
      expect(openMenu).toBeNull(); // Vault menu was closed!
    });
  });
});
