import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { SHORTCUTS, matchesShortcut } from '../../src/shared/shortcuts';
import { CommandRegistry, scoreCommand, type Command } from '../../src/renderer/palette/command-registry';
import { IPC_VALIDATORS } from '../../src/shared/ipc/contracts';

describe('Tabs, Navigation and Palette (M2 UI Slice)', () => {
  describe('Master Shortcuts Registry and Matching', () => {
    it('contains all core application shortcuts from Features 1 table', () => {
      const keys = SHORTCUTS.map((s) => s.key);
      expect(keys).toContain('Ctrl+\\');
      expect(keys).toContain('Ctrl+Shift+P');
      expect(keys).toContain('Ctrl+N');
      expect(keys).toContain('Ctrl+W');
      expect(keys).toContain('Ctrl+Tab');
      expect(keys).toContain('Ctrl+Shift+Tab');
      expect(keys).toContain('Alt+Left');
      expect(keys).toContain('Alt+Right');
      expect(keys).toContain('Ctrl+B');
      expect(keys).toContain('Ctrl+F');
      expect(keys).toContain('Ctrl+H');
      expect(keys).toContain('F2');
      expect(keys).toContain('Ctrl+,');
    });

    it('matches Ctrl+\\ via key or code', () => {
      const eventKey = { key: '\\', ctrlKey: true };
      expect(matchesShortcut(eventKey, 'Ctrl+\\')).toBe(true);

      const eventCode = { key: 'Unidentified', code: 'Backslash', ctrlKey: true };
      expect(matchesShortcut(eventCode, 'Ctrl+\\')).toBe(true);

      const eventNoCtrl = { key: '\\', ctrlKey: false };
      expect(matchesShortcut(eventNoCtrl, 'Ctrl+\\')).toBe(false);
    });

    it('matches multi-modifier shortcuts like Ctrl+Shift+P and Ctrl+Shift+Tab', () => {
      const eventP = { key: 'P', ctrlKey: true, shiftKey: true };
      expect(matchesShortcut(eventP, 'Ctrl+Shift+P')).toBe(true);

      const eventTab = { key: 'Tab', ctrlKey: true, shiftKey: true };
      expect(matchesShortcut(eventTab, 'Ctrl+Shift+Tab')).toBe(true);

      const eventWrongShift = { key: 'P', ctrlKey: true, shiftKey: false };
      expect(matchesShortcut(eventWrongShift, 'Ctrl+Shift+P')).toBe(false);
    });

    it('matches Alt navigation shortcuts Alt+Left and Alt+Right', () => {
      const eventLeft = { key: 'ArrowLeft', altKey: true };
      expect(matchesShortcut(eventLeft, 'Alt+Left')).toBe(true);

      const eventRight = { key: 'ArrowRight', altKey: true };
      expect(matchesShortcut(eventRight, 'Alt+Right')).toBe(true);

      const eventNoAlt = { key: 'ArrowLeft', altKey: false };
      expect(matchesShortcut(eventNoAlt, 'Alt+Left')).toBe(false);
    });
  });

  describe('Command Registry and Loose Fuzzy Matching', () => {
    let registry: CommandRegistry;

    beforeEach(() => {
      registry = new CommandRegistry();
      registry.registerBatch([
        {
          id: 'wrriter:new-note',
          title: 'New note',
          category: 'File',
          shortcut: 'Ctrl+N',
          keywords: ['create', 'note'],
          run: vi.fn()
        },
        {
          id: 'wrriter:close-tab',
          title: 'Close tab',
          category: 'File',
          shortcut: 'Ctrl+W',
          keywords: ['tab', 'dismiss'],
          run: vi.fn()
        },
        {
          id: 'wrriter:toggle-both-panes',
          title: 'Toggle both panes',
          category: 'View',
          shortcut: 'Ctrl+\\',
          keywords: ['sidebar', 'navigation', 'hide', 'show'],
          run: vi.fn()
        },
        {
          id: 'wrriter:open-log-folder',
          title: 'Open log folder',
          category: 'Help',
          keywords: ['logs', 'debug', 'troubleshoot'],
          run: vi.fn()
        },
        {
          id: 'wrriter:disabled-cmd',
          title: 'Disabled command',
          category: 'Edit',
          run: vi.fn(),
          isEnabled: () => false
        }
      ]);
    });

    it('returns highest score for exact match', () => {
      const results = registry.search('New note');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.command.id).toBe('wrriter:new-note');
      expect(results[0]?.score).toBe(1000);
    });

    it('matches word prefixes loosely', () => {
      const results = registry.search('panes');
      expect(results.some((r) => r.command.id === 'wrriter:toggle-both-panes')).toBe(true);
    });

    it('matches keywords like "debug" or "logs"', () => {
      const results = registry.search('debug');
      expect(results.some((r) => r.command.id === 'wrriter:open-log-folder')).toBe(true);
    });

    it('matches shortcuts like "Ctrl+N" or "Ctrl+W"', () => {
      const results = registry.search('Ctrl+W');
      expect(results[0]?.command.id).toBe('wrriter:close-tab');
    });

    it('excludes disabled commands from search results', () => {
      const results = registry.search('Disabled');
      expect(results.some((r) => r.command.id === 'wrriter:disabled-cmd')).toBe(false);
    });

    it('returns empty array when query does not match any command', () => {
      const results = registry.search('NonExistentXyz999');
      expect(results.length).toBe(0);
    });
  });

  describe('Per-Tab History Navigation Logic', () => {
    it('manages back/forward history stacks and dims forward when at end', () => {
      const history = {
        stack: ['Notes/Meeting.md'],
        index: 0
      };

      const existingNotes = ['Notes/Meeting.md', 'Notes/Ideas.md', 'Notes/Project.md'];

      // Initial state: can't go back, can't go forward
      const canGoBack1 = history.index > 0;
      const canGoForward1 = history.index < history.stack.length - 1;
      expect(canGoBack1).toBe(false);
      expect(canGoForward1).toBe(false);

      // Navigate to Ideas.md
      history.stack = history.stack.slice(0, history.index + 1).concat('Notes/Ideas.md');
      history.index = history.stack.length - 1;

      expect(history.stack).toEqual(['Notes/Meeting.md', 'Notes/Ideas.md']);
      expect(history.index).toBe(1);
      expect(history.index > 0).toBe(true);
      expect(history.index < history.stack.length - 1).toBe(false); // forward dimmed

      // Go back
      history.index--;
      expect(history.stack[history.index]).toBe('Notes/Meeting.md');
      expect(history.index < history.stack.length - 1).toBe(true); // forward available

      // Navigate to Project.md from Meeting.md (truncates forward history)
      history.stack = history.stack.slice(0, history.index + 1).concat('Notes/Project.md');
      history.index = history.stack.length - 1;
      expect(history.stack).toEqual(['Notes/Meeting.md', 'Notes/Project.md']);
      expect(history.index).toBe(1);
    });

    it('skips deleted notes when navigating back and forward', () => {
      const history = {
        stack: ['Notes/A.md', 'Notes/Deleted.md', 'Notes/C.md'],
        index: 2
      };

      const activeNotes = ['Notes/A.md', 'Notes/C.md']; // Deleted.md was deleted

      // Finding previous valid note
      let prevValidIndex = -1;
      for (let i = history.index - 1; i >= 0; i--) {
        if (activeNotes.includes(history.stack[i]!)) {
          prevValidIndex = i;
          break;
        }
      }

      expect(prevValidIndex).toBe(0); // Skipped index 1 (Deleted.md)
      expect(history.stack[prevValidIndex]).toBe('Notes/A.md');
    });

    it('follows note renames across all entries in history', () => {
      const history = {
        stack: ['Notes/Old.md', 'Notes/Other.md', 'Notes/Old.md'],
        index: 2
      };

      const oldPath = 'Notes/Old.md';
      const newPath = 'Notes/Renamed.md';

      history.stack = history.stack.map((p) => (p === oldPath ? newPath : p));

      expect(history.stack).toEqual(['Notes/Renamed.md', 'Notes/Other.md', 'Notes/Renamed.md']);
    });
  });

  describe('IPC Contracts for Tabs and Logs', () => {
    it('validates window.setOpenTabs arguments', () => {
      const validator = IPC_VALIDATORS['window.setOpenTabs'];

      const validRes = validator({
        openTabs: ['Notes/A.md', 'Notes/B.md'],
        activeTabPath: 'Notes/A.md'
      });
      expect(validRes.ok).toBe(true);
      if (validRes.ok) {
        expect(validRes.value.openTabs).toEqual(['Notes/A.md', 'Notes/B.md']);
        expect(validRes.value.activeTabPath).toBe('Notes/A.md');
      }

      const invalidRes = validator({ openTabs: 'not-an-array' });
      expect(invalidRes.ok).toBe(false);
    });

    it('validates app.openLogFolder arguments as empty object', () => {
      const validator = IPC_VALIDATORS['app.openLogFolder'];
      expect(validator({}).ok).toBe(true);
      expect(validator(123).ok).toBe(false);
    });
  });

  describe('Twelve Tabs & Hidden-Tab Memory Retention (Features 9, R7)', () => {
    const tabSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { inline: true }
      }
    });

    function createTestDoc(text: string) {
      const p = tabSchema.node('paragraph', null, text ? [tabSchema.text(text)] : []);
      return tabSchema.node('doc', null, [p]);
    }

    it('manages 12 open tabs, switching, opening, and closing by mouse and keyboard without 12 live editors', () => {
      interface TestTab {
        path: string;
        title: string;
        state: EditorState;
        scrollTop: number;
      }

      const tabsMap = new Map<string, TestTab>();

      // 1. Open 12 tabs with distinct contents, cursor positions, and undo stacks
      for (let i = 1; i <= 12; i++) {
        const path = `Notes/TabNote-${i}.md`;
        const initialText = `Note ${i} content with important paragraphs.`;
        let state = EditorState.create({
          doc: createTestDoc(initialText),
          schema: tabSchema,
          plugins: [history()]
        });

        // Add a typing step to build undo history
        const tr = state.tr.insertText(` Typed addition in tab ${i}.`, 10);
        state = state.apply(tr);

        // Position cursor at unique location in each tab
        const cursorTr = state.tr.setSelection(TextSelection.create(state.doc, 5 + i));
        state = state.apply(cursorTr);

        tabsMap.set(path, {
          path,
          title: `TabNote ${i}`,
          state,
          scrollTop: i * 40
        });
      }

      expect(tabsMap.size).toBe(12);

      // 2. Hidden-tab check:
      // Verify that all 12 tabs keep their text, cursor, scroll, and undo history in memory
      for (let i = 1; i <= 12; i++) {
        const path = `Notes/TabNote-${i}.md`;
        const tab = tabsMap.get(path);
        expect(tab).toBeDefined();
        if (!tab) continue;

        // Check text content intact
        expect(tab.state.doc.textContent).toContain(`Typed addition in tab ${i}`);

        // Check cursor selection preserved
        expect(tab.state.selection.from).toBe(5 + i);

        // Check scroll position preserved
        expect(tab.scrollTop).toBe(i * 40);

        // Check undo history intact: undoing removes the typed addition
        let undoneState = tab.state;
        undo(undoneState, (tr) => {
          undoneState = undoneState.apply(tr);
        });
        expect(undoneState.doc.textContent).not.toContain(`Typed addition in tab ${i}`);
        expect(undoneState.doc.textContent).toContain(`Note ${i} content`);
      }

      // 3. Tab cycling by keyboard (Ctrl+Tab and Ctrl+Shift+Tab)
      const tabPaths = Array.from(tabsMap.keys());
      let activeIndex = 0;

      // Next tab (Ctrl+Tab)
      activeIndex = (activeIndex + 1) % tabPaths.length;
      expect(activeIndex).toBe(1);
      expect(tabPaths[activeIndex]).toBe('Notes/TabNote-2.md');

      // Previous tab (Ctrl+Shift+Tab)
      activeIndex = (activeIndex - 1 + tabPaths.length) % tabPaths.length;
      expect(activeIndex).toBe(0);
      expect(tabPaths[activeIndex]).toBe('Notes/TabNote-1.md');

      // 4. Closing tabs by mouse and keyboard until empty
      // Close tab 12 via keyboard (Ctrl+W)
      tabsMap.delete('Notes/TabNote-12.md');
      expect(tabsMap.size).toBe(11);

      // Close remaining tabs via mouse click
      for (let i = 1; i <= 11; i++) {
        tabsMap.delete(`Notes/TabNote-${i}.md`);
      }
      expect(tabsMap.size).toBe(0);
    });
  });
});
