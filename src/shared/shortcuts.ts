export interface ShortcutDefinition {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly category: 'File' | 'Edit' | 'View' | 'Navigation' | 'Format' | 'Search' | 'Settings';
  readonly description: string;
}

/**
 * Master list of keyboard shortcuts in Wrriter, derived from Features 1.
 * Single source of truth for the app shortcut list.
 */
export const SHORTCUTS: readonly ShortcutDefinition[] = [
  // 1. File
  {
    id: 'file:new-note',
    key: 'Ctrl+N',
    title: 'New note',
    category: 'File',
    description: 'Create a new note in the selected folder'
  },
  {
    id: 'file:close-tab',
    key: 'Ctrl+W',
    title: 'Close tab',
    category: 'File',
    description: 'Close the active note tab'
  },
  {
    id: 'file:rename',
    key: 'F2',
    title: 'Rename',
    category: 'File',
    description: 'Rename the active note or selected folder'
  },

  // 2. Navigation & Tabs
  {
    id: 'nav:next-tab',
    key: 'Ctrl+Tab',
    title: 'Next tab',
    category: 'Navigation',
    description: 'Switch to the next tab to the right'
  },
  {
    id: 'nav:prev-tab',
    key: 'Ctrl+Shift+Tab',
    title: 'Previous tab',
    category: 'Navigation',
    description: 'Switch to the previous tab to the left'
  },
  {
    id: 'nav:go-back',
    key: 'Alt+Left',
    title: 'Go back',
    category: 'Navigation',
    description: 'Navigate back to the previous note in tab history'
  },
  {
    id: 'nav:go-forward',
    key: 'Alt+Right',
    title: 'Go forward',
    category: 'Navigation',
    description: 'Navigate forward in tab history'
  },
  {
    id: 'nav:command-palette',
    key: 'Ctrl+Shift+P',
    title: 'Command palette',
    category: 'Navigation',
    description: 'Open the command palette'
  },
  {
    id: 'nav:quick-switcher',
    key: 'Ctrl+P',
    title: 'Quick switcher',
    category: 'Navigation',
    description: 'Open quick switcher to jump to a note'
  },

  // 3. View & Panes
  {
    id: 'view:toggle-both-panes',
    key: 'Ctrl+\\',
    title: 'Toggle both panes',
    category: 'View',
    description: 'Hide or show both sidebar and notes list panes'
  },
  {
    id: 'view:toggle-sidebar',
    key: 'Ctrl+B',
    title: 'Toggle sidebar',
    category: 'View',
    description: 'Hide or show the folder tree sidebar'
  },

  // 4. Search & Replace
  {
    id: 'search:find-in-note',
    key: 'Ctrl+F',
    title: 'Find in note',
    category: 'Search',
    description: 'Open the find bar in the active note'
  },
  {
    id: 'search:replace-in-note',
    key: 'Ctrl+H',
    title: 'Replace in note',
    category: 'Search',
    description: 'Open the find and replace bar in the active note'
  },
  {
    id: 'search:find-next',
    key: 'F3',
    title: 'Find next match',
    category: 'Search',
    description: 'Jump to the next search occurrence'
  },
  {
    id: 'search:find-prev',
    key: 'Shift+F3',
    title: 'Find previous match',
    category: 'Search',
    description: 'Jump to the previous search occurrence'
  },
  {
    id: 'search:search-notes',
    key: 'Ctrl+Shift+F',
    title: 'Search notes',
    category: 'Search',
    description: 'Search across notes in the current vault'
  },

  // 5. Edit & Formatting
  {
    id: 'edit:undo',
    key: 'Ctrl+Z',
    title: 'Undo',
    category: 'Edit',
    description: 'Undo the last editor action'
  },
  {
    id: 'edit:redo',
    key: 'Ctrl+Y',
    title: 'Redo',
    category: 'Edit',
    description: 'Redo the last undone editor action'
  },
  {
    id: 'edit:move-block-up',
    key: 'Alt+Up',
    title: 'Move block up',
    category: 'Edit',
    description: 'Move current block or heading section up'
  },
  {
    id: 'edit:move-block-down',
    key: 'Alt+Down',
    title: 'Move block down',
    category: 'Edit',
    description: 'Move current block or heading section down'
  },
  {
    id: 'format:bold',
    key: 'Ctrl+B',
    title: 'Bold',
    category: 'Format',
    description: 'Toggle bold on selected text'
  },
  {
    id: 'format:italic',
    key: 'Ctrl+I',
    title: 'Italic',
    category: 'Format',
    description: 'Toggle italic on selected text'
  },
  {
    id: 'format:strike',
    key: 'Ctrl+Shift+X',
    title: 'Strikethrough',
    category: 'Format',
    description: 'Toggle strikethrough on selected text'
  },
  {
    id: 'format:link',
    key: 'Ctrl+K',
    title: 'Insert link',
    category: 'Format',
    description: 'Create or edit a link on selected text'
  },
  {
    id: 'format:paste-plain',
    key: 'Ctrl+Shift+V',
    title: 'Paste plain text',
    category: 'Format',
    description: 'Paste clipboard contents as plain text without formatting'
  },

  // 6. Settings & System
  {
    id: 'settings:open',
    key: 'Ctrl+,',
    title: 'Open settings',
    category: 'Settings',
    description: 'Open application settings window'
  },
  {
    id: 'settings:quick-capture',
    key: 'Ctrl+Alt+N',
    title: 'Quick capture',
    category: 'Settings',
    description: 'Global hotkey to open quick capture note'
  }
];

export interface KeyboardEventLike {
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * Checks whether a keyboard event matches a given shortcut descriptor (e.g. "Ctrl+\", "Ctrl+Shift+P", "Alt+Left").
 */
export function matchesShortcut(event: KeyboardEventLike, shortcutKey: string): boolean {
  const parts = shortcutKey.split('+');
  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');
  const primaryKey = parts[parts.length - 1]?.toLowerCase();

  const isCtrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
  if (needsCtrl !== isCtrlOrMeta) return false;
  if (needsShift !== Boolean(event.shiftKey)) return false;
  if (needsAlt !== Boolean(event.altKey)) return false;

  const eventKey = event.key.toLowerCase();

  if (primaryKey === '\\') {
    return eventKey === '\\' || event.code === 'Backslash';
  }
  if (primaryKey === ',') {
    return eventKey === ',' || event.code === 'Comma';
  }
  if (primaryKey === 'left') {
    return eventKey === 'arrowleft';
  }
  if (primaryKey === 'right') {
    return eventKey === 'arrowright';
  }
  if (primaryKey === 'up') {
    return eventKey === 'arrowup';
  }
  if (primaryKey === 'down') {
    return eventKey === 'arrowdown';
  }
  if (primaryKey === 'tab') {
    return eventKey === 'tab';
  }

  return eventKey === primaryKey;
}
