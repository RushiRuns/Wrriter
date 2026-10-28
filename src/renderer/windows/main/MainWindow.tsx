import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { WindowShell } from '../../components/WindowShell';
import {
  NotesTileIcon,
  InboxTileIcon,
  TagsTileIcon,
  SearchTileIcon,
  ArchiveTileIcon,
  TrashTileIcon,
  ChevronUpDownIcon,
  MoreDotsIcon,
  SortIcon,
  PinIcon,
  ChevronRightIcon,
  SettingsIcon,
  MoveToFolderIcon,
  FolderClosedIcon,
  LinkIcon,
  ShowInExplorerIcon,
  NewNoteIcon,
  DuplicateIcon,
  PopOutIcon
} from '../../components/icons';
import { FirstRunScreen } from '../../components/FirstRunScreen';
import { VaultMenu } from '../../components/VaultMenu';
import { FolderTree } from '../../components/FolderTree';
import { TagTree } from '../../components/TagTree';
import { NoteRow } from '../../components/NoteRow';
import { VirtualList } from '../../components/VirtualList';
import { NotesPaneMenu } from '../../components/NotesPaneMenu';
import { Notice } from '../../components/Notice';
import { EditorHost } from '../../editor/EditorHost';
import { EditorMenu } from '../../components/menu/EditorMenu';
import { ContextMenu, type ContextMenuItem } from '../../components/menu/ContextMenu';
import { CommandPalette } from '../../components/CommandPalette';
import { QuickSwitcher } from '../../components/QuickSwitcher';
import { SearchView } from '../../components/SearchView';
import { commandRegistry, type Command } from '../../palette/command-registry';
import { matchesShortcut } from '../../../shared/shortcuts';
import { formatDefaultTitle, deriveFileNameFromTitle } from '../../../shared';
import { resolveLink, resolveMarkdownLink } from '../../../shared/domain/links';
import { crossFadeTransition, subscribeThemeSync } from '../../motion';
import type {
  FolderNode,
  NoteListItem,
  StartupState,
  VaultInfo,
  AppSettingsContract,
  IndexTagCount
} from '../../../shared/ipc';

const SettingsWindow = React.lazy(() => import('../../components/SettingsWindow'));

function getNoteFolderRelPath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const lastSlash = norm.lastIndexOf('/');
  return lastSlash >= 0 ? norm.slice(0, lastSlash) : '';
}

export function noteBelongsToFolder(noteRelPath: string, folderRelPath: string | null): boolean {
  if (folderRelPath === null || folderRelPath === '') {
    return true;
  }
  return getNoteFolderRelPath(noteRelPath) === folderRelPath;
}

export function areNoteListsEqual(
  a: readonly NoteListItem[],
  b: readonly NoteListItem[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (!itemA || !itemB) return false;
    if (
      itemA.path !== itemB.path ||
      itemA.title !== itemB.title ||
      itemA.modified !== itemB.modified ||
      itemA.pinned !== itemB.pinned ||
      itemA.preview !== itemB.preview ||
      itemA.hasImage !== itemB.hasImage ||
      itemA.imageSrc !== itemB.imageSrc ||
      itemA.orderKey !== itemB.orderKey
    ) {
      return false;
    }
  }
  return true;
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


export const MainWindow: React.FC = () => {
  // Window & pane dimensions
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(248);
  const [listWidth, setListWidth] = useState(320);

  // Vault state
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);

  // Tile navigation state
  const [activeTile, setActiveTile] = useState<'notes' | 'inbox' | 'tags' | 'search' | 'archive' | 'trash'>('notes');

  // Folder & notes state
  const [folders, setFolders] = useState<readonly FolderNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagsWithCounts, setTagsWithCounts] = useState<readonly IndexTagCount[]>([]);
  const [notes, setNotes] = useState<readonly NoteListItem[]>([]);
  const [totalVaultNotesCount, setTotalVaultNotesCount] = useState<number>(0);
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('Welcome to Wrriter');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState<number>(Date.now());
  const selectedNotePathRef = useRef<string | null>(selectedNotePath);
  selectedNotePathRef.current = selectedNotePath;
  const noteTitleRef = useRef<string>(noteTitle);
  noteTitleRef.current = noteTitle;
  const prevSelectedNotePathRef = useRef<string | null>(null);

  // Notes pane 3-dot menu, editor menu, and context menu state
  const [notesMenuOpen, setNotesMenuOpen] = useState(false);
  const [editorMenuOpen, setEditorMenuOpen] = useState(false);
  const [noteContextMenu, setNoteContextMenu] = useState<{ x: number; y: number; note: NoteListItem } | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [newFolderInputError, setNewFolderInputError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const handleDismissNotice = useCallback(() => {
    setNoticeMessage(null);
  }, []);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);

  // Per-tab navigation history and panes state
  const tabHistoriesRef = useRef<Map<string, { stack: string[]; index: number }>>(new Map());
  const prevPaneWidthsRef = useRef<{ sidebarOpen: boolean; listWidth: number }>({
    sidebarOpen: true,
    listWidth: 320
  });
  const lastSavedTabsRef = useRef<string>('');

  // Settings state (defaults per SCHEMA.md)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<AppSettingsContract>({
    theme: 'follow-windows',
    accent: 'yellow',
    motion: 'follow-windows',
    noteMargin: 24,
    keepRunningInBackground: true,
    startWithWindows: false,
    captureHotkey: 'Ctrl+Alt+N',
    captureVault: 'last-active',
    noteList: {
      sortBy: 'manual',
      showSortIcon: false,
      showPreviews: true,
      showDates: true,
      showImages: true
    },
    dragHintShown: false
  });
  const currentSettingsRef = useRef(currentSettings);
  currentSettingsRef.current = currentSettings;

  const [sortBy, setSortBy] = useState<'manual' | 'modified' | 'title'>('manual');
  const [showSortIcon, setShowSortIcon] = useState(false);
  const [showPreviews, setShowPreviews] = useState(true);
  const [showDates, setShowDates] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const [noteMargin, setNoteMargin] = useState(24);

  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Save pane widths to main process (debounced)
  const savePaneWidths = useCallback((newSide: number, newList: number) => {
    void window.wrriter?.window?.setPaneWidths({
      sidebarWidth: newSide,
      listWidth: newList
    });
  }, []);

  // Save settings helper
  const updateSettings = useCallback(async (patch: Partial<AppSettingsContract>) => {
    if (window.wrriter?.app?.saveSettings) {
      await window.wrriter.app.saveSettings(patch);
    }
  }, []);

  const handleSaveSettings = useCallback(async (patch: Partial<AppSettingsContract>) => {
    setCurrentSettings((prev) => ({ ...prev, ...patch }));
    if (patch.noteMargin !== undefined) {
      setNoteMargin(patch.noteMargin);
    }
    await updateSettings(patch);
  }, [updateSettings]);


  // Refresh folders from disk
  const refreshFolders = useCallback(async () => {
    if (window.wrriter?.folder?.list) {
      const res = await window.wrriter.folder.list();
      if (res.ok) {
        setFolders(res.value);
      }
    }
    if (window.wrriter?.note?.list) {
      const allRes = await window.wrriter.note.list({});
      if (allRes.ok) {
        setTotalVaultNotesCount(allRes.value.length);
      }
    }
  }, []);

  // Refresh tags from index/disk
  const refreshTags = useCallback(async () => {
    if (window.wrriter?.index?.getTagCounts) {
      const res = await window.wrriter.index.getTagCounts();
      if (res.ok) {
        setTagsWithCounts(res.value);
      }
    }
  }, []);

  // Refresh notes from disk/index
  const refreshNotes = useCallback(async (
    folderPath: string | null = selectedFolder,
    currentSort: 'manual' | 'modified' | 'title' = sortBy,
    tagFilter: string | null = selectedTag
  ) => {
    if (window.wrriter?.note?.list) {
      const res = await window.wrriter.note.list({
        folder: folderPath ?? undefined,
        tag: tagFilter ?? undefined,
        sortBy: currentSort
      });
      if (res.ok) {
        if ((folderPath === null || folderPath === '') && !tagFilter) {
          setTotalVaultNotesCount(res.value.length);
        }
        setNotes((prevNotes) => {
          const currentSelected = selectedNotePathRef.current;
          const currentTitle = noteTitleRef.current;

          let updated: NoteListItem[] = res.value.map((diskNote: NoteListItem): NoteListItem => {
            const prev = prevNotes.find((p) => p.path === diskNote.path);
            if (diskNote.path === currentSelected && currentTitle) {
              return { ...diskNote, title: currentTitle };
            }
            if (prev && prev.title && prev.title !== diskNote.title && diskNote.title.startsWith('Untitled')) {
              return { ...diskNote, title: prev.title };
            }
            return diskNote;
          });

          // Preserve unsaved active note that is not yet on disk only if it belongs to current folder view
          if (
            currentSelected &&
            noteBelongsToFolder(currentSelected, folderPath) &&
            !updated.some((n: NoteListItem) => n.path === currentSelected)
          ) {
            const unsaved = prevNotes.find((n) => n.path === currentSelected);
            if (unsaved && noteBelongsToFolder(unsaved.path, folderPath)) {
              updated = [{ ...unsaved, title: currentTitle || unsaved.title }, ...updated];
            }
          }

          // If notes content hasn't changed, retain previous reference to avoid unnecessary re-renders
          if (areNoteListsEqual(prevNotes, updated)) {
            return prevNotes;
          }

          return updated;
        });

        // If current selected note no longer exists, select first available
        if (res.value.length > 0) {
          const currentExists = res.value.some((n: NoteListItem) => n.path === selectedNotePathRef.current);
          if (!currentExists && !selectedNotePathRef.current) {
            setSelectedNotePath(res.value[0]?.path ?? null);
            setNoteTitle(res.value[0]?.title ?? 'Untitled');
          }
        }
      }
    }
  }, [selectedFolder, sortBy]);

  // Load note text from disk
  const loadNoteContent = useCallback(async (relPath: string) => {
    if (window.wrriter?.note?.read) {
      const res = await window.wrriter.note.read({ path: relPath });
      if (res.ok) {
        setNoteContent(res.value.text);
      }
    }
  }, []);

  // Cycle sort when clicking sort icon
  const handleCycleSort = () => {
    const nextSort: 'manual' | 'modified' | 'title' =
      sortBy === 'manual' ? 'modified' : sortBy === 'modified' ? 'title' : 'manual';
    setSortBy(nextSort);
    void updateSettings({ noteList: { sortBy: nextSort, showSortIcon, showPreviews, showDates, showImages } });
    void refreshNotes(selectedFolder, nextSort);
  };

  // Close context menu and floating menus on outside click, escape, or close-all event
  useEffect(() => {
    const handleOutside = () => {
      setNoteContextMenu(null);
      setEditorMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNoteContextMenu(null);
        setEditorMenuOpen(false);
        setNotesMenuOpen(false);
        setVaultMenuOpen(false);
        setShowNewFolderModal(false);
      }
    };
    const handleCloseAllMenus = (e: Event) => {
      const customEvent = e as CustomEvent<{ except?: string }>;
      if (customEvent.detail?.except !== 'editor-menu') setEditorMenuOpen(false);
      if (customEvent.detail?.except !== 'note-context-menu' && customEvent.detail?.except !== 'context-menu') setNoteContextMenu(null);
      if (customEvent.detail?.except !== 'notes-pane-menu') setNotesMenuOpen(false);
      if (customEvent.detail?.except !== 'vault-menu') setVaultMenuOpen(false);
    };

    window.addEventListener('click', handleOutside);
    window.addEventListener('contextmenu', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('wrriter:close-all-menus', handleCloseAllMenus);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('contextmenu', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('wrriter:close-all-menus', handleCloseAllMenus);
    };
  }, []);

  // Startup initialization: load window state, active vault, settings, and first paint notes
  useEffect(() => {
    let isMounted = true;

    async function loadStartup() {
      // 1. Initial query params fallback
      try {
        const params = new URLSearchParams(window.location.search);
        const qSide = parseInt(params.get('sidebarWidth') || '', 10);
        const qList = parseInt(params.get('listWidth') || '', 10);
        if (!isNaN(qSide) && qSide >= 180 && qSide <= 400) setSidebarWidth(qSide);
        if (!isNaN(qList) && qList >= 240 && qList <= 500) setListWidth(qList);
      } catch (_) {}

      // 2. Read full startup state via typed IPC
      if (window.wrriter?.app?.getStartupState) {
        const res = await window.wrriter.app.getStartupState();
        if (res.ok && isMounted) {
          const state: StartupState = res.value;
          if (state.windowState.sidebarWidth) setSidebarWidth(state.windowState.sidebarWidth);
          if (state.windowState.listWidth) setListWidth(state.windowState.listWidth);

          if (state.activeVault) {
            setActiveVault(state.activeVault);
            setShowFirstRun(false);
            if (state.activeTabPath) {
              setSelectedNotePath(state.activeTabPath);
              tabHistoriesRef.current.set(state.activeTabPath, { stack: [state.activeTabPath], index: 0 });
            }
          } else {
            setActiveVault(null);
            setShowFirstRun(true);
          }
        }
      }

      // 3. Load user settings
      if (window.wrriter?.app?.getSettings) {
        const sRes = await window.wrriter.app.getSettings();
        if (sRes.ok && isMounted) {
          const s = sRes.value;
          setCurrentSettings(s);
          if (s.noteList) {
            const mappedSort = s.noteList.sortBy === 'created' ? 'modified' : s.noteList.sortBy;
            setSortBy(mappedSort);
            setShowSortIcon(Boolean(s.noteList.showSortIcon));
            setShowPreviews(s.noteList.showPreviews ?? true);
            setShowDates(s.noteList.showDates ?? true);
            setShowImages(s.noteList.showImages ?? true);
          }
          if (s.noteMargin) setNoteMargin(s.noteMargin);
          if (s.motion === 'reduced') {
            document.documentElement.setAttribute('data-motion', 'reduced');
          }
          if (s.theme) {
            let effectiveTheme = s.theme;
            if (s.theme === 'follow-windows' && typeof window !== 'undefined' && window.matchMedia) {
              effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', effectiveTheme);
          }
          if (s.accent) {
            document.documentElement.setAttribute('data-accent', s.accent);
          }
        }
      }


      // 4. Load initial folders and notes
      await refreshFolders();
      await refreshNotes(null);

      // 5. Notify main process that first paint is complete
      if (window.wrriter?.window?.firstPaintComplete) {
        void window.wrriter.window.firstPaintComplete();
      }
    }

    void loadStartup();

    return () => {
      isMounted = false;
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
        resizeCleanupRef.current = null;
      }
    };
  }, []);

  // Listen for Windows system theme changes and cross-window theme broadcasts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Windows system theme change
    let mediaQuery: MediaQueryList | null = null;
    let handleSystemThemeChange: ((e: MediaQueryListEvent) => void) | null = null;

    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (currentSettingsRef.current.theme === 'follow-windows') {
          const newTheme = e.matches ? 'dark' : 'light';
          void crossFadeTransition(() => {
            document.documentElement.setAttribute('data-theme', newTheme);
          });
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
      } else {
        mediaQuery.addListener(handleSystemThemeChange);
      }
    }

    // 2. Cross-window theme broadcast
    const unsubscribe = subscribeThemeSync((msg) => {
      if (msg.type === 'theme') {
        let effectiveTheme = msg.value;
        if (msg.value === 'follow-windows' && window.matchMedia) {
          effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        void crossFadeTransition(() => {
          document.documentElement.setAttribute('data-theme', effectiveTheme);
        });
      } else if (msg.type === 'accent') {
        void crossFadeTransition(() => {
          document.documentElement.setAttribute('data-accent', msg.value);
        });
      }
    });

    return () => {
      if (mediaQuery && handleSystemThemeChange) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemThemeChange);
        } else {
          mediaQuery.removeListener(handleSystemThemeChange);
        }
      }
      unsubscribe();
    };
  }, []);


  // Poll for external changes and refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      void refreshFolders();
      void refreshNotes();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      void refreshFolders();
      void refreshNotes();
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [refreshFolders, refreshNotes]);

  // When selected note changes, load note body
  useEffect(() => {
    if (selectedNotePath) {
      const isSwitchingNote = selectedNotePath !== prevSelectedNotePathRef.current;
      prevSelectedNotePathRef.current = selectedNotePath;

      if (isSwitchingNote) {
        void loadNoteContent(selectedNotePath);
        const matched = notes.find((n) => n.path === selectedNotePath);
        if (matched) {
          setNoteTitle(matched.title);
          setNoteDate(matched.modified);
        }
      }
    } else {
      prevSelectedNotePathRef.current = null;
    }
  }, [selectedNotePath, notes, loadNoteContent]);

  // Divider resize handlers (with limits: sidebar 180-400px, list 240-500px)
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let currentW = startW;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const clamped = Math.max(180, Math.min(400, startW + delta));
      currentW = clamped;
      setSidebarWidth(clamped);
      document.documentElement.style.setProperty('--sidew', `${clamped}px`);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      savePaneWidths(currentW, listWidth);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleListResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listWidth;
    let currentW = startW;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const clamped = Math.max(240, Math.min(500, startW + delta));
      currentW = clamped;
      setListWidth(clamped);
      document.documentElement.style.setProperty('--listw', `${clamped}px`);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      savePaneWidths(sidebarWidth, currentW);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };


  // Pin/Unpin note action
  const handleTogglePinNote = async (note: NoteListItem) => {
    setNoteContextMenu(null);
    if (window.wrriter?.note?.setPinned) {
      const res = await window.wrriter.note.setPinned({
        path: note.path,
        pinned: !note.pinned
      });
      if (res.ok) {
        await refreshNotes();
      }
    }
  };

  // Delete note action (sends to Recycle Bin)
  const handleDeleteNote = async (note: NoteListItem) => {
    setNoteContextMenu(null);

    const remaining = notes.filter((n) => n.path !== note.path);
    setNotes(remaining);

    if (selectedNotePath === note.path) {
      const nextNote = remaining[0] ?? null;
      setSelectedNotePath(nextNote?.path ?? null);
      selectedNotePathRef.current = nextNote?.path ?? null;
      setNoteTitle(nextNote?.title ?? (remaining.length === 0 ? 'Welcome to Wrriter' : 'Untitled'));
      if (!nextNote) {
        setNoteContent('');
      }
    }

    // Drop open tab in EditorHost without saving
    window.dispatchEvent(
      new CustomEvent('wrriter:note-deleted', { detail: { path: note.path } })
    );

    setTotalVaultNotesCount((prev) => Math.max(0, prev - 1));

    if (window.wrriter?.note?.delete) {
      const res = await window.wrriter.note.delete({ path: note.path });
      if (res.ok) {
        await refreshNotes();
        await refreshFolders();
      }
    }
  };

  // Copy wikilink action
  const handleCopyWikilink = (note: NoteListItem) => {
    setNoteContextMenu(null);
    const wikilink = `[[${note.title}]]`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(wikilink)
        .then(() => setNoticeMessage('Wikilink copied'))
        .catch(() => setNoticeMessage('Wikilink copied'));
    } else {
      setNoticeMessage('Wikilink copied');
    }
  };

  // Show in Explorer action
  const handleShowInExplorer = (notePath: string) => {
    setNoteContextMenu(null);
    if (window.wrriter?.vault?.showInExplorer) {
      void window.wrriter.vault.showInExplorer({ path: notePath });
    } else if (window.wrriter?.showItemInFolder) {
      void window.wrriter.showItemInFolder(notePath);
    }
  };

  // Move note to folder action
  const handleMoveNoteToFolder = async (note: NoteListItem, targetFolderRelPath: string) => {
    setNoteContextMenu(null);
    const normalizedPath = note.path.replace(/\\/g, '/');
    const fileName = normalizedPath.includes('/') ? normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1) : normalizedPath;
    const newPath = targetFolderRelPath ? `${targetFolderRelPath}/${fileName}` : fileName;

    if (newPath === note.path) return;

    const moveFn = window.wrriter?.note?.move ?? window.wrriter?.folder?.rename;
    if (moveFn) {
      const res = await moveFn({
        oldPath: note.path,
        newPath
      });
      if (res.ok) {
        if (selectedNotePath === note.path) {
          setSelectedNotePath(newPath);
        }
        if (tabHistoriesRef.current.has(note.path)) {
          const hist = tabHistoriesRef.current.get(note.path)!;
          tabHistoriesRef.current.delete(note.path);
          tabHistoriesRef.current.set(newPath, {
            stack: hist.stack.map((p) => (p === note.path ? newPath : p)),
            index: hist.index
          });
        }
        await refreshNotes();
        await refreshFolders();
        setNoticeMessage(`Moved to ${targetFolderRelPath || 'Notes'}`);
      } else {
        setNoticeMessage((res.error as any)?.rule || 'Failed to move note');
      }
    }
  };

  // In-place rename from toolbar or F2
  const handleRenameNote = useCallback(async (newName: string) => {
    if (!selectedNotePath) return;
    const folder = selectedNotePath.includes('/') ? selectedNotePath.slice(0, selectedNotePath.lastIndexOf('/')) : '';
    const newFileName = deriveFileNameFromTitle(newName);
    const newPath = folder ? `${folder}/${newFileName}` : newFileName;

    if (newPath === selectedNotePath) {
      setNoteTitle(newName);
      return;
    }

    const renameFn = window.wrriter?.note?.rename ?? window.wrriter?.folder?.rename;
    if (renameFn) {
      const res = await renameFn({
        oldPath: selectedNotePath,
        newPath
      });
      if (res.ok) {
        setSelectedNotePath(newPath);
        setNoteTitle(newName);
        await refreshNotes();
      }
    }
  }, [selectedNotePath, refreshNotes]);

  // Pop-out note action (M4 Quick capture & pop-out)
  const handlePopOutNote = useCallback((noteRelPath: string) => {
    setNoteContextMenu(null);
    if (window.wrriter?.capture?.openPopOut) {
      void window.wrriter.capture.openPopOut({ path: noteRelPath });
    }
  }, []);

  // Create new note action (Ctrl+N, Compose button, tab plus)
  const handleCreateNewNote = useCallback(() => {
    const folder = selectedFolder;
    const defaultTitle = formatDefaultTitle(notes.map((n) => n.title));
    const newFileName = `${defaultTitle}.md`;
    const newPath = folder ? `${folder}/${newFileName}` : newFileName;

    const newNoteItem: NoteListItem = {
      path: newPath,
      title: defaultTitle,
      preview: '',
      modified: Date.now(),
      pinned: false,
      hasImage: false
    };

    setNotes((prev) => [newNoteItem, ...prev]);
    setTotalVaultNotesCount((prev) => prev + 1);
    setSelectedNotePath(newPath);
    setNoteTitle(defaultTitle);
    tabHistoriesRef.current.set(newPath, { stack: [newPath], index: 0 });

    setTimeout(() => {
      if (typeof document !== 'undefined') {
        document.querySelector<HTMLElement>('.wrriter-prosemirror')?.focus();
      }
    }, 0);
  }, [selectedFolder, notes]);

  // Per-tab navigation: canGoBack and canGoForward
  const currentHistory = tabHistoriesRef.current.get(selectedNotePath ?? '');

  const canGoBack = Boolean(
    currentHistory &&
      currentHistory.index > 0 &&
      currentHistory.stack.slice(0, currentHistory.index).some((p) => notes.some((n) => n.path === p))
  );

  const canGoForward = Boolean(
    currentHistory &&
      currentHistory.index < currentHistory.stack.length - 1 &&
      currentHistory.stack.slice(currentHistory.index + 1).some((p) => notes.some((n) => n.path === p))
  );

  const handleGoBack = useCallback(() => {
    if (!currentHistory) return;
    for (let i = currentHistory.index - 1; i >= 0; i--) {
      const p = currentHistory.stack[i];
      if (p && notes.some((n) => n.path === p)) {
        currentHistory.index = i;
        setSelectedNotePath(p);
        const match = notes.find((n) => n.path === p);
        if (match) setNoteTitle(match.title);
        return;
      }
    }
  }, [currentHistory, notes]);

  const handleGoForward = useCallback(() => {
    if (!currentHistory) return;
    for (let i = currentHistory.index + 1; i < currentHistory.stack.length; i++) {
      const p = currentHistory.stack[i];
      if (p && notes.some((n) => n.path === p)) {
        currentHistory.index = i;
        setSelectedNotePath(p);
        const match = notes.find((n) => n.path === p);
        if (match) setNoteTitle(match.title);
        return;
      }
    }
  }, [currentHistory, notes]);

  const handleToggleBothPanes = useCallback(() => {
    if (sidebarOpen || listWidth > 0) {
      prevPaneWidthsRef.current = {
        sidebarOpen,
        listWidth: listWidth > 0 ? listWidth : 320
      };
      setSidebarOpen(false);
      setListWidth(0);
    } else {
      setSidebarOpen(prevPaneWidthsRef.current.sidebarOpen);
      setListWidth(prevPaneWidthsRef.current.listWidth);
    }
  }, [sidebarOpen, listWidth]);

  const handleSelectNote = useCallback(
    (e: React.MouseEvent | undefined, notePath: string) => {
      const isNewTab = e && (e.ctrlKey || e.metaKey || e.button === 1);
      if (isNewTab) {
        setSelectedNotePath(notePath);
        const match = notes.find((n) => n.path === notePath);
        if (match) setNoteTitle(match.title);
        if (!tabHistoriesRef.current.has(notePath)) {
          tabHistoriesRef.current.set(notePath, { stack: [notePath], index: 0 });
        }
      } else {
        const prevPath = selectedNotePath;
        if (prevPath && prevPath !== notePath) {
          const hist = tabHistoriesRef.current.get(prevPath) ?? { stack: [prevPath], index: 0 };
          const newStack = hist.stack.slice(0, hist.index + 1).concat(notePath);
          const updatedHist = { stack: newStack, index: newStack.length - 1 };
          tabHistoriesRef.current.delete(prevPath);
          tabHistoriesRef.current.set(notePath, updatedHist);
        } else if (!tabHistoriesRef.current.has(notePath)) {
          tabHistoriesRef.current.set(notePath, { stack: [notePath], index: 0 });
        }
        setSelectedNotePath(notePath);
        const match = notes.find((n) => n.path === notePath);
        if (match) setNoteTitle(match.title);
      }
    },
    [selectedNotePath, notes]
  );

  // Handle external open in main window & note saved cross-window sync
  useEffect(() => {
    const handleOpenedInMain = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path) {
        handleSelectNote(undefined, detail.path);
      }
    };
    const handleNoteSaved = () => {
      void refreshNotes();
    };

    window.addEventListener('wrriter:note-opened-in-main', handleOpenedInMain);
    window.addEventListener('wrriter:note-saved', handleNoteSaved);
    return () => {
      window.removeEventListener('wrriter:note-opened-in-main', handleOpenedInMain);
      window.removeEventListener('wrriter:note-saved', handleNoteSaved);
    };
  }, [handleSelectNote, refreshNotes]);

  // Duplicate note action
  const handleDuplicateNote = useCallback(
    async (notePath: string) => {
      setNoteContextMenu(null);
      if (!window.wrriter?.note?.duplicate) return;
      const res = await window.wrriter.note.duplicate({ path: notePath });
      if (res.ok) {
        await refreshFolders();
        await refreshNotes();
        handleSelectNote(undefined, res.value.path);
      } else {
        setNoticeMessage('Failed to duplicate note');
      }
    },
    [refreshFolders, refreshNotes, handleSelectNote]
  );

  const handleFollowLink = useCallback(
    async (targetOrHref: string, isNewTab: boolean) => {
      const activePath = selectedNotePath ?? '';

      // 1. Check if it's a vault markdown link [text](path.md)
      const mdResolved = resolveMarkdownLink(targetOrHref, activePath, notes);
      if (mdResolved) {
        if (mdResolved.resolved && mdResolved.path) {
          handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, mdResolved.path);
          return;
        }
        if (mdResolved.isMissing && mdResolved.path) {
          const targetRelPath = mdResolved.path.endsWith('.md') ? mdResolved.path : `${mdResolved.path}.md`;
          const defaultContent = `# ${mdResolved.targetName}\n\n`;
          if (window.wrriter?.note?.save) {
            const saveRes = await window.wrriter.note.save({
              path: targetRelPath,
              content: defaultContent
            });
            if (saveRes.ok) {
              await refreshFolders();
              await refreshNotes();
              handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, targetRelPath);
            }
          }
          return;
        }
      }

      // 2. Resolve as wikilink [[target]]
      const resolved = resolveLink(targetOrHref, activePath, notes);
      if (resolved.resolved && resolved.path) {
        handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, resolved.path);
        return;
      }

      // 3. Link to missing note: create note in current folder
      if (resolved.isMissing) {
        const sourceFolder = getNoteFolderRelPath(activePath);
        const fileNameBase = deriveFileNameFromTitle(resolved.targetName);
        const fileName = fileNameBase.endsWith('.md') ? fileNameBase : `${fileNameBase}.md`;
        const newPath = sourceFolder ? `${sourceFolder}/${fileName}` : fileName;

        const defaultContent = `# ${resolved.targetName}\n\n`;
        if (window.wrriter?.note?.save) {
          const saveRes = await window.wrriter.note.save({
            path: newPath,
            content: defaultContent
          });
          if (saveRes.ok) {
            await refreshFolders();
            await refreshNotes();
            handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, newPath);
          }
        }
      }
    },
    [selectedNotePath, notes, handleSelectNote, refreshFolders, refreshNotes]
  );

  // Global Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, 'Ctrl+\\')) {
        e.preventDefault();
        handleToggleBothPanes();
        return;
      }
      if (matchesShortcut(e, 'Ctrl+Shift+P')) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (matchesShortcut(e, 'Ctrl+P')) {
        e.preventDefault();
        setQuickSwitcherOpen((prev) => !prev);
        return;
      }
      if (matchesShortcut(e, 'Ctrl+Shift+F')) {
        e.preventDefault();
        setActiveTile('search');
        setSidebarOpen(true);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('wrriter:focus-search'));
        }, 0);
        return;
      }
      if (matchesShortcut(e, 'Ctrl+N')) {
        e.preventDefault();
        handleCreateNewNote();
        return;
      }
      if (matchesShortcut(e, 'Ctrl+W')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('wrriter:close-tab'));
        return;
      }
      if (matchesShortcut(e, 'Ctrl+Tab')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('wrriter:next-tab'));
        return;
      }
      if (matchesShortcut(e, 'Ctrl+Shift+Tab')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('wrriter:prev-tab'));
        return;
      }
      if (matchesShortcut(e, 'Alt+Left')) {
        if (canGoBack) {
          e.preventDefault();
          handleGoBack();
        }
        return;
      }
      if (matchesShortcut(e, 'Alt+Right')) {
        if (canGoForward) {
          e.preventDefault();
          handleGoForward();
        }
        return;
      }
      if (matchesShortcut(e, 'Ctrl+B')) {
        e.preventDefault();
        setSidebarOpen((open) => !open);
        return;
      }
      if (matchesShortcut(e, 'Ctrl+,')) {
        e.preventDefault();
        setSettingsOpen((open) => !open);
        return;
      }
    };

    const handleNewNoteEvent = () => {
      handleCreateNewNote();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wrriter:new-note', handleNewNoteEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wrriter:new-note', handleNewNoteEvent);
    };
  }, [
    handleToggleBothPanes,
    handleCreateNewNote,
    canGoBack,
    canGoForward,
    handleGoBack,
    handleGoForward
  ]);

  // Command Registry Batch Registration
  useEffect(() => {
    const commands: Command[] = [
      {
        id: 'wrriter:new-note',
        title: 'New note',
        category: 'File',
        shortcut: 'Ctrl+N',
        keywords: ['create', 'note'],
        run: () => handleCreateNewNote()
      },
      {
        id: 'wrriter:close-tab',
        title: 'Close tab',
        category: 'File',
        shortcut: 'Ctrl+W',
        keywords: ['tab', 'dismiss'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:close-tab'));
        }
      },
      {
        id: 'wrriter:close-other-tabs',
        title: 'Close other tabs',
        category: 'File',
        keywords: ['tab', 'others'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:close-other-tabs'));
        }
      },
      {
        id: 'wrriter:close-tabs-to-right',
        title: 'Close tabs to right',
        category: 'File',
        keywords: ['tab', 'right'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:close-tabs-to-right'));
        }
      },
      {
        id: 'wrriter:pin-note',
        title: 'Pin or unpin note',
        category: 'File',
        keywords: ['pin', 'star', 'favorite'],
        run: () => {
          const sel = notes.find((n) => n.path === selectedNotePath);
          if (sel) void handleTogglePinNote(sel);
        }
      },
      {
        id: 'wrriter:duplicate-note',
        title: 'Duplicate note',
        category: 'File',
        keywords: ['copy', 'clone'],
        run: () => {
          if (selectedNotePath) {
            void handleDuplicateNote(selectedNotePath);
          }
        }
      },
      {
        id: 'wrriter:pop-out-note',
        title: 'Pop out note',
        category: 'File',
        keywords: ['popout', 'detach', 'window', 'separate', 'float'],
        run: () => {
          if (selectedNotePathRef.current) {
            handlePopOutNote(selectedNotePathRef.current);
          }
        }
      },
      {
        id: 'wrriter:add-tag',
        title: 'Add tag',
        category: 'Properties',
        keywords: ['tag', 'properties', 'label', 'pill'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:open-add-tag'));
        }
      },
      {
        id: 'wrriter:set-status',
        title: 'Set status',
        category: 'Properties',
        keywords: ['status', 'properties', 'state'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:open-set-status'));
        }
      },
      {
        id: 'wrriter:show-in-explorer',
        title: 'Show in File Explorer',
        category: 'File',
        keywords: ['explorer', 'reveal', 'folder'],
        run: () => {
          if (selectedNotePath && window.wrriter?.showItemInFolder) {
            void window.wrriter.showItemInFolder(selectedNotePath);
          }
        }
      },
      {
        id: 'wrriter:delete-note',
        title: 'Delete note',
        category: 'File',
        keywords: ['trash', 'remove'],
        run: () => {
          const sel = notes.find((n) => n.path === selectedNotePath);
          if (sel) void handleDeleteNote(sel);
        }
      },
      {
        id: 'wrriter:new-folder',
        title: 'New folder',
        category: 'File',
        keywords: ['create', 'directory'],
        run: () => setShowNewFolderModal(true)
      },
      {
        id: 'wrriter:toggle-both-panes',
        title: 'Toggle both panes',
        category: 'View',
        shortcut: 'Ctrl+\\',
        keywords: ['sidebar', 'navigation', 'hide', 'show'],
        run: () => handleToggleBothPanes()
      },
      {
        id: 'wrriter:toggle-sidebar',
        title: 'Toggle sidebar',
        category: 'View',
        shortcut: 'Ctrl+B',
        keywords: ['folder', 'tree'],
        run: () => setSidebarOpen((open) => !open)
      },
      {
        id: 'wrriter:toggle-theme',
        title: 'Toggle light / dark theme',
        category: 'View',
        keywords: ['dark', 'light', 'mode'],
        run: () => {
          const cur = document.documentElement.getAttribute('data-theme');
          const next = cur === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          if (window.wrriter?.app?.setTheme) {
            void window.wrriter.app.setTheme({ theme: next });
          }
        }
      },
      {
        id: 'wrriter:next-tab',
        title: 'Next tab',
        category: 'Navigation',
        shortcut: 'Ctrl+Tab',
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:next-tab'));
        }
      },
      {
        id: 'wrriter:prev-tab',
        title: 'Previous tab',
        category: 'Navigation',
        shortcut: 'Ctrl+Shift+Tab',
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:prev-tab'));
        }
      },
      {
        id: 'wrriter:go-back',
        title: 'Go back',
        category: 'Navigation',
        shortcut: 'Alt+Left',
        run: () => {
          handleGoBack();
        },
        isEnabled: () => canGoBack
      },
      {
        id: 'wrriter:go-forward',
        title: 'Go forward',
        category: 'Navigation',
        shortcut: 'Alt+Right',
        run: () => {
          handleGoForward();
        },
        isEnabled: () => canGoForward
      },
      {
        id: 'wrriter:quick-switcher',
        title: 'Quick switcher: Open note',
        category: 'Navigation',
        shortcut: 'Ctrl+P',
        keywords: ['switch', 'open', 'find', 'quick', 'goto'],
        run: () => setQuickSwitcherOpen(true)
      },
      {
        id: 'wrriter:search-in-vault',
        title: 'Search in vault',
        category: 'Search',
        shortcut: 'Ctrl+Shift+F',
        keywords: ['search', 'find', 'vault', 'filter', 'locate'],
        run: () => {
          setActiveTile('search');
          setSidebarOpen(true);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wrriter:focus-search'));
          }, 0);
        }
      },
      {
        id: 'wrriter:find-in-note',
        title: 'Find in note',
        category: 'Search',
        shortcut: 'Ctrl+F',
        keywords: ['search', 'locate'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:find-in-note'));
        }
      },
      {
        id: 'wrriter:replace-in-note',
        title: 'Replace in note',
        category: 'Search',
        shortcut: 'Ctrl+H',
        keywords: ['substitute'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:replace-in-note'));
        }
      },
      {
        id: 'wrriter:fold-all',
        title: 'Fold all headings',
        category: 'View',
        keywords: ['collapse'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:fold-all'));
        }
      },
      {
        id: 'wrriter:unfold-all',
        title: 'Unfold all headings',
        category: 'View',
        keywords: ['expand'],
        run: () => {
          window.dispatchEvent(new CustomEvent('wrriter:unfold-all'));
        }
      },
      {
        id: 'wrriter:open-log-folder',
        title: 'Open log folder',
        category: 'Help',
        keywords: ['logs', 'debug', 'troubleshoot'],
        run: () => {
          if (window.wrriter?.app?.openLogFolder) {
            void window.wrriter.app.openLogFolder();
          }
        }
      },
      {
        id: 'wrriter:open-settings',
        title: 'Open settings',
        category: 'Settings',
        shortcut: 'Ctrl+,',
        keywords: ['preferences', 'options'],
        run: () => setSettingsOpen(true)
      },
      {
        id: 'settings:open',
        title: 'Open settings',
        category: 'Settings',
        shortcut: 'Ctrl+,',
        keywords: ['preferences', 'options'],
        run: () => setSettingsOpen(true)
      }
    ];


    commandRegistry.registerBatch(commands);
  }, [
    handleCreateNewNote,
    selectedNotePath,
    notes,
    handleTogglePinNote,
    handleDeleteNote,
    handleToggleBothPanes,
    canGoBack,
    canGoForward,
    handleGoBack,
    handleGoForward
  ]);

  // Group notes into pinned and unpinned
  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  // Drag and drop: manual reorder notes in note list
  const handleReorderNotes = async (
    draggedPath: string,
    targetPath: string,
    position: 'before' | 'after'
  ) => {
    const allCurrentNotes = [...pinnedNotes, ...unpinnedNotes];
    const targetIdx = allCurrentNotes.findIndex((n) => n.path === targetPath);
    if (targetIdx === -1) return;

    let beforeKey: string | undefined = undefined;
    let afterKey: string | undefined = undefined;

    if (position === 'before') {
      const prevNote = allCurrentNotes[targetIdx - 1];
      const targetNote = allCurrentNotes[targetIdx]!;
      beforeKey = prevNote?.orderKey;
      afterKey = targetNote.orderKey;
    } else {
      const targetNote = allCurrentNotes[targetIdx]!;
      const nextNote = allCurrentNotes[targetIdx + 1];
      beforeKey = targetNote.orderKey;
      afterKey = nextNote?.orderKey;
    }

    if (window.wrriter?.note?.setOrder) {
      await window.wrriter.note.setOrder({
        path: draggedPath,
        folder: selectedFolder ?? undefined,
        beforeKey,
        afterKey
      });
      setSortBy('manual');
      void updateSettings({ noteList: { sortBy: 'manual', showSortIcon, showPreviews, showDates, showImages } });
      await refreshNotes(selectedFolder, 'manual');
    }
  };

  // Drag and drop: external files dropped on note list pane
  const handleNotesPaneDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0 && window.wrriter?.attachment?.importDroppedPath) {
      e.preventDefault();
      e.stopPropagation();
      let lastImportedNotePath: string | undefined = undefined;
      for (const file of files) {
        const sourcePath = window.wrriter?.getPathForFile
          ? window.wrriter.getPathForFile(file)
          : (file as any).path || '';
        if (sourcePath) {
          const res = await window.wrriter.attachment.importDroppedPath({
            targetFolder: selectedFolder ?? '',
            sourcePath
          });
          if (res.ok && res.value.notePath) {
            lastImportedNotePath = res.value.notePath;
          }
        }
      }
      await refreshFolders();
      await refreshNotes(selectedFolder, sortBy);
      if (lastImportedNotePath) {
        handleSelectNote(undefined, lastImportedNotePath);
      }
    }
  };

  // Compute folder title in notes pane header
  const getFolderHeaderName = () => {
    if (activeTile === 'tags') {
      if (selectedTag) return `#${selectedTag}`;
      return 'All Tags';
    }
    if (activeTile === 'search') {
      return 'Search';
    }
    if (activeTile === 'inbox' || selectedFolder === 'Inbox') {
      return 'Inbox';
    }
    if (!selectedFolder) return 'Notes';
    const parts = selectedFolder.split('/');
    return parts[parts.length - 1] || 'Notes';
  };

  // First-Run Screen if no vault exists
  if (showFirstRun) {
    return (
      <WindowShell
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        noteName="Wrriter"
      >
        <FirstRunScreen
          onVaultOpened={async (vault) => {
            setActiveVault(vault);
            setShowFirstRun(false);
            await refreshFolders();
            await refreshNotes();
          }}
        />
      </WindowShell>
    );
  }

  return (
    <WindowShell
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      noteName={noteTitle}
      onRenameNote={handleRenameNote}
      onNewNote={handleCreateNewNote}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onGoBack={handleGoBack}
      onGoForward={handleGoForward}
    >
      {/* 1. First Pane: Sidebar (Tiles, Folders, Vault & Settings) */}
      <aside
        className={`side ${!sidebarOpen ? 'shut' : ''}`}
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          position: 'relative'
        }}
        aria-hidden={!sidebarOpen}
      >
        <div className="sin">
          {/* Six Icon Tiles in 2 rows of 3 with smooth active highlight transition */}
          <div className="tiles">
            <button
              type="button"
              className={`tile ${activeTile === 'notes' ? 'on' : ''}`}
              onClick={() => {
                setActiveTile('notes');
                setSelectedFolder(null);
                setSelectedTag(null);
                void refreshNotes(null, sortBy, null);
              }}
              title="Notes"
            >
              <NotesTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'inbox' ? 'on' : ''}`}
              onClick={() => {
                setActiveTile('inbox');
                setSelectedFolder('Inbox');
                setSelectedTag(null);
                void refreshNotes('Inbox', sortBy, null);
              }}
              title="Inbox"
            >
              <InboxTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'tags' ? 'on' : ''}`}
              onClick={() => {
                setActiveTile('tags');
                setSelectedFolder(null);
                void refreshTags();
                void refreshNotes(null, sortBy, selectedTag);
              }}
              title="Tags"
            >
              <TagsTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'search' ? 'on' : ''}`}
              onClick={() => {
                setActiveTile('search');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('wrriter:focus-search'));
                }, 0);
              }}
              title="Search (Ctrl+Shift+F)"
            >
              <SearchTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'archive' ? 'on' : ''}`}
              onClick={() => setActiveTile('archive')}
              title="Archive"
            >
              <ArchiveTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'trash' ? 'on' : ''}`}
              onClick={() => setActiveTile('trash')}
              title="Trash"
            >
              <TrashTileIcon />
            </button>
          </div>

          {/* 1px divider */}
          <div className="sep" />

          {/* Lower Pane: Tag Tree or Folder Tree based on active tile */}
          {activeTile === 'tags' ? (
            <TagTree
              tagsWithCounts={tagsWithCounts}
              selectedTag={selectedTag}
              onSelectTag={(tag) => {
                setSelectedTag(tag);
                void refreshNotes(null, sortBy, tag);
              }}
              onRefresh={async () => {
                await refreshTags();
                await refreshNotes(null, sortBy, selectedTag);
              }}
              onNotice={(msg) => setNoticeMessage(msg)}
            />
          ) : (
            <FolderTree
              folders={folders}
              selectedFolder={selectedFolder}
              onSelectFolder={(path) => {
                setSelectedFolder(path);
                setSelectedTag(null);
                void refreshNotes(path, sortBy, null);
              }}
              totalVaultNotesCount={totalVaultNotesCount}
              onRefresh={async () => {
                await refreshFolders();
                await refreshNotes(selectedFolder, sortBy, null);
              }}
            />
          )}

          {/* Bottom Vault Button, Settings Gear and Popup Menu */}
          <div className="vaults" style={{ position: 'relative' }}>
            <button
              type="button"
              className="vtrig"
              aria-expanded={vaultMenuOpen}
              onClick={() => setVaultMenuOpen((open) => !open)}
              title="Vault menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, marginRight: 'var(--s-2)' }}>
                <ChevronUpDownIcon style={{ width: 14, height: 14, color: 'var(--tx3)' }} />
              </span>
              <span className="vn">{activeVault?.name || 'Personal Vault'}</span>
            </button>

            <button
              type="button"
              className="ib"
              onClick={() => setSettingsOpen(true)}
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>


            {/* Floating Vault Menu */}
            <VaultMenu
              isOpen={vaultMenuOpen}
              onClose={() => setVaultMenuOpen(false)}
              activeVaultId={activeVault?.vaultId ?? null}
              onVaultSwitched={async (newVault) => {
                setActiveVault(newVault);
                await refreshFolders();
                await refreshNotes();
              }}
              onVaultListChanged={async () => {
                if (window.wrriter?.vault?.getActive) {
                  const res = await window.wrriter.vault.getActive();
                  if (res.ok && res.value) {
                    setActiveVault(res.value);
                  }
                }
              }}
              onShowFirstRun={() => {
                setActiveVault(null);
                setShowFirstRun(true);
              }}
            />
          </div>
        </div>

        {/* Resizer Handle for Sidebar */}
        {sidebarOpen && (
          <div
            onMouseDown={handleSidebarResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              right: -3,
              width: 6,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10
            }}
          />
        )}
      </aside>

      {/* 2. Notes Pane */}
      <section
        className={`list ${!showImages ? 'noim' : ''}`}
        style={{
          width: listWidth,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header (48px tall) with pane toggle, folder title, sort icon, and 3-dot menu */}
        <div
          className="lh"
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px 0 16px',
            gap: 8,
            borderBottom: '1px solid var(--div)'
          }}
        >
          {/* Pane toggle icon (chevron left when open, right when shut) */}
          <button
            type="button"
            className="ib pnl"
            onClick={() => setSidebarOpen((open) => !open)}
            title="Toggle first pane"
            aria-expanded={sidebarOpen}
            style={{ width: 28, height: 28, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <ChevronRightIcon
              style={{
                transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform var(--t-base) var(--ease-move)'
              }}
            />
          </button>

          {/* Folder Name */}
          <span className="lname" style={{ flex: 1 }}>
            {getFolderHeaderName()}
          </span>

          {/* Sort Icon (shown only if Show sort icon is toggled on) */}
          {showSortIcon && (
            <button
              type="button"
              className="ib"
              onClick={handleCycleSort}
              title={`Sort: ${sortBy}`}
              style={{ width: 28, height: 28, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              <SortIcon />
            </button>
          )}

          {/* New Note Button (resides on the left of 3-dot icon) */}
          <button
            type="button"
            className="ib"
            onClick={handleCreateNewNote}
            title="New note"
            aria-label="New note"
            style={{ width: 28, height: 28, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <NewNoteIcon />
          </button>

          {/* 3-Dot Menu Button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="ib"
              onClick={() => setNotesMenuOpen((o) => !o)}
              title="More options"
              style={{ width: 28, height: 28, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              <MoreDotsIcon />
            </button>

            {/* Notes Pane Menu */}
            <NotesPaneMenu
              isOpen={notesMenuOpen}
              onClose={() => setNotesMenuOpen(false)}
              sortBy={sortBy}
              onSortByChange={(newSort) => {
                setSortBy(newSort);
                void updateSettings({ noteList: { sortBy: newSort, showSortIcon, showPreviews, showDates, showImages } });
                void refreshNotes(selectedFolder, newSort);
              }}
              showSortIcon={showSortIcon}
              onToggleShowSortIcon={() => {
                const next = !showSortIcon;
                setShowSortIcon(next);
                void updateSettings({ noteList: { sortBy, showSortIcon: next, showPreviews, showDates, showImages } });
              }}
              showPreviews={showPreviews}
              onToggleShowPreviews={() => {
                const next = !showPreviews;
                setShowPreviews(next);
                void updateSettings({ noteList: { sortBy, showSortIcon, showPreviews: next, showDates, showImages } });
              }}
              showDates={showDates}
              onToggleShowDates={() => {
                const next = !showDates;
                setShowDates(next);
                void updateSettings({ noteList: { sortBy, showSortIcon, showPreviews, showDates: next, showImages } });
              }}
              showImages={showImages}
              onToggleShowImages={() => {
                const next = !showImages;
                setShowImages(next);
                void updateSettings({ noteList: { sortBy, showSortIcon, showPreviews, showDates, showImages: next } });
              }}
              onNewFolder={() => setShowNewFolderModal(true)}
            />
          </div>
        </div>

        {/* Note List / Virtualized Note Rows / Search View */}
        {activeTile === 'search' ? (
          <SearchView
            selectedNotePath={selectedNotePath}
            onSelectNote={(relPath, isNewTab) => {
              handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, relPath);
            }}
            onContextMenu={(e, itemPath, itemTitle) => {
              const matched = notes.find((n) => n.path === itemPath);
              const item: NoteListItem = matched ?? {
                path: itemPath,
                title: itemTitle,
                modified: Date.now(),
                preview: '',
                pinned: false
              };
              setNoteContextMenu({ x: e.clientX, y: e.clientY, note: item });
            }}
          />
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {notes.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tx3)', fontSize: 'var(--fs-small)' }}>
                No notes yet. Click new note to begin writing.
              </div>
            ) : (
              <div
                className="notes-scroll"
                style={{ flex: 1, overflowY: 'auto' }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                  }
                }}
                onDrop={handleNotesPaneDrop}
              >
                {/* Pinned Group */}
                {pinnedNotes.length > 0 && (
                  <>
                    <div className="grp first">
                      <PinIcon style={{ width: 12, height: 12, marginRight: 4 }} />
                      PINNED
                    </div>
                    <VirtualList
                      items={pinnedNotes}
                      getKey={(n) => n.path}
                      renderItem={(note) => (
                        <NoteRow
                          note={note}
                          isSelected={selectedNotePath === note.path}
                          showDates={showDates}
                          showPreviews={showPreviews}
                          showImages={showImages}
                          onSelect={(e) => handleSelectNote(e, note.path)}
                          onReorder={handleReorderNotes}
                          onContextMenu={(e, item) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (selectedNotePath !== item.path) {
                              handleSelectNote(undefined, item.path);
                            }
                            setNoteContextMenu({ x: e.clientX, y: e.clientY, note: item });
                          }}
                        />
                      )}
                    />
                  </>
                )}

                {/* Unpinned Notes Group */}
                <div className={`grp ${pinnedNotes.length === 0 ? 'first' : ''}`}>
                  NOTES
                </div>
                <VirtualList
                  items={unpinnedNotes}
                  getKey={(n) => n.path}
                  renderItem={(note) => (
                    <NoteRow
                      note={note}
                      isSelected={selectedNotePath === note.path}
                      showDates={showDates}
                      showPreviews={showPreviews}
                      showImages={showImages}
                      onSelect={(e) => handleSelectNote(e, note.path)}
                      onReorder={handleReorderNotes}
                      onContextMenu={(e, item) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedNotePath !== item.path) {
                          handleSelectNote(undefined, item.path);
                        }
                        setNoteContextMenu({ x: e.clientX, y: e.clientY, note: item });
                      }}
                    />
                  )}
                />
              </div>
            )}
          </div>
        )}

        {/* Note Context Menu (Right Click on Note Row) */}
        {noteContextMenu && (() => {
          const currentFolder = getNoteFolderRelPath(noteContextMenu.note.path);
          const allFolders = flattenFolderNodes(folders);
          const moveSubmenuItems: ContextMenuItem[] = [];

          if (currentFolder !== '') {
            moveSubmenuItems.push({
              id: 'move-root',
              label: 'Notes (Root)',
              icon: <FolderClosedIcon style={{ width: 14, height: 14 }} />,
              onClick: () => void handleMoveNoteToFolder(noteContextMenu.note, '')
            });
          }

          for (const f of allFolders) {
            if (f.relPath !== currentFolder) {
              moveSubmenuItems.push({
                id: `move-folder-${f.relPath}`,
                label: f.relPath.includes('/') ? f.relPath : f.name,
                icon: <FolderClosedIcon style={{ width: 14, height: 14 }} />,
                onClick: () => void handleMoveNoteToFolder(noteContextMenu.note, f.relPath)
              });
            }
          }

          if (moveSubmenuItems.length === 0) {
            moveSubmenuItems.push({
              id: 'no-folders',
              label: 'No folders available',
              isDisabled: true
            });
          }

          return (
            <ContextMenu
              isOpen={true}
              menuId="note-context-menu"
              x={noteContextMenu.x}
              y={noteContextMenu.y}
              onClose={() => setNoteContextMenu(null)}
              items={[
                {
                  id: 'pin',
                  label: noteContextMenu.note.pinned ? 'Unpin note' : 'Pin note',
                  icon: <PinIcon style={{ width: 14, height: 14 }} />,
                  onClick: () => void handleTogglePinNote(noteContextMenu.note)
                },
                {
                  id: 'duplicate',
                  label: 'Duplicate note',
                  icon: <DuplicateIcon style={{ width: 14, height: 14 }} />,
                  onClick: () => void handleDuplicateNote(noteContextMenu.note.path)
                },
                {
                  id: 'move-to-folder',
                  label: 'Move to folder',
                  icon: <MoveToFolderIcon style={{ width: 14, height: 14 }} />,
                  children: moveSubmenuItems
                },
                {
                  id: 'copy-wikilink',
                  label: 'Copy wikilink',
                  icon: <LinkIcon style={{ width: 14, height: 14 }} />,
                  onClick: () => handleCopyWikilink(noteContextMenu.note)
                },
                {
                  id: 'explorer',
                  label: 'Show in File Explorer',
                  icon: <ShowInExplorerIcon style={{ width: 14, height: 14 }} />,
                  onClick: () => handleShowInExplorer(noteContextMenu.note.path)
                },
                {
                  id: 'pop-out',
                  label: 'Pop out',
                  icon: <PopOutIcon style={{ width: 14, height: 14 }} />,
                  onClick: () => handlePopOutNote(noteContextMenu.note.path)
                },
                { id: 'div-danger', label: '', isDivider: true },
                {
                  id: 'del',
                  label: 'Delete note',
                  icon: <TrashTileIcon style={{ width: 14, height: 14 }} />,
                  isDanger: true,
                  onClick: () => void handleDeleteNote(noteContextMenu.note)
                }
              ]}
            />
          );
        })()}

        {/* Resizer Handle for Notes List */}
        <div
          onMouseDown={handleListResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            right: -3,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 10
          }}
        />
      </section>

      {/* 3. Editor Pane and Tabs Strip */}
      <main
        className="ed"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Editor 3-dot button in top right corner (pinned, hidden when no note is open) */}
        {(() => {
          if (!selectedNotePath) return null;
          const selectedNote = notes.find((n) => n.path === selectedNotePath);
          if (!selectedNote) return null;
          return (
            <div className="nmore">
              <button
                type="button"
                className="ib"
                title="Note options"
                aria-label="Note options"
                onClick={() => setEditorMenuOpen((prev) => !prev)}
                style={{ width: 28, height: 28, cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <MoreDotsIcon />
              </button>
              <EditorMenu
                isOpen={editorMenuOpen}
                onClose={() => setEditorMenuOpen(false)}
                isPinned={selectedNote.pinned ?? false}
                onTogglePin={() => void handleTogglePinNote(selectedNote)}
                onFindInNote={() => window.dispatchEvent(new CustomEvent('wrriter:find-in-note'))}
                onPopOut={() => handlePopOutNote(selectedNote.path)}
                onShowInExplorer={() => {
                  if (selectedNotePath && window.wrriter?.showItemInFolder) {
                    void window.wrriter.showItemInFolder(selectedNotePath);
                  }
                }}
                onDuplicateNote={() => {
                  if (selectedNotePath) {
                    void handleDuplicateNote(selectedNotePath);
                  }
                }}
                onDeleteNote={() => void handleDeleteNote(selectedNote)}
              />
            </div>
          );
        })()}

        {/* Live TipTap Editor Host */}
        <EditorHost
          activeNotePath={selectedNotePath}
          noteMargin={noteMargin}
          availableNotes={notes}
          onFollowLink={handleFollowLink}
          onTitleChange={(title) => {
            setNoteTitle(title);
            setNotes((prev) => prev.map((n) => (n.path === selectedNotePath ? { ...n, title } : n)));
          }}
          onNoteSummaryChange={(summary) => {
            setNotes((prev) =>
              prev.map((n) =>
                n.path === summary.path
                  ? { ...n, preview: summary.preview, hasImage: summary.hasImage, imageSrc: summary.imageSrc }
                  : n
              )
            );
          }}
          onSelectTab={(path) => {
            setSelectedNotePath(path);
            if (path) {
              const matched = notes.find((n) => n.path === path);
              if (matched) {
                setNoteTitle(matched.title);
              }
            }
          }}
          onTabsUpdate={(tabsList, activePath) => {
            const paths = tabsList.map((t) => t.path);
            const signature = `${activePath ?? ''}::${paths.join(',')}`;
            if (lastSavedTabsRef.current === signature) return;
            lastSavedTabsRef.current = signature;
            if (window.wrriter?.window?.setOpenTabs) {
              void window.wrriter.window.setOpenTabs({
                openTabs: paths,
                activeTabPath: activePath
              });
            }
          }}
          onPathChange={(_oldPath, newPath) => {
            setSelectedNotePath(newPath);
            for (const [key, hist] of tabHistoriesRef.current.entries()) {
              hist.stack = hist.stack.map((p) => (p === _oldPath ? newPath : p));
              if (key === _oldPath) {
                tabHistoriesRef.current.delete(_oldPath);
                tabHistoriesRef.current.set(newPath, hist);
              }
            }
            void refreshNotes();
          }}
          onNotice={(msg) => setNoticeMessage(msg)}
        />
      </main>

      {/* New Folder Modal (triggered from 3-dot menu) */}
      {showNewFolderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'center'
          }}
          onClick={() => setShowNewFolderModal(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = newFolderNameInput.trim();
              if (!trimmed) {
                setNewFolderInputError('Folder name cannot be empty');
                return;
              }
              const folderPath = selectedFolder ? `${selectedFolder}/${trimmed}` : trimmed;
              if (window.wrriter?.folder?.create) {
                const res = await window.wrriter.folder.create({ path: folderPath });
                if (res.ok) {
                  setShowNewFolderModal(false);
                  setNewFolderNameInput('');
                  setNewFolderInputError(null);
                  await refreshFolders();
                } else {
                  setNewFolderInputError(res.error.kind === 'ruleViolation' ? res.error.rule : 'Failed to create folder');
                }
              }
            }}
            style={{
              width: 380,
              backgroundColor: 'var(--pop)',
              borderRadius: 'var(--r-l)',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--line)',
              padding: 24,
              animation: 'lin var(--t-fast) var(--ease-arrive) both'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>
              New folder
            </h3>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                autoFocus
                placeholder="Folder name"
                value={newFolderNameInput}
                onChange={(e) => {
                  setNewFolderNameInput(e.target.value);
                  setNewFolderInputError(null);
                }}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  fontSize: 'var(--fs-ui)',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--pop)',
                  border: newFolderInputError ? '1px solid var(--dgr)' : '1px solid var(--div)',
                  borderRadius: 8,
                  color: 'var(--tx)',
                  outline: 'none'
                }}
              />
              {newFolderInputError && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--dgr)' }}>
                  {newFolderInputError}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="fb"
                onClick={() => setShowNewFolderModal(false)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid var(--div)',
                  background: 'none',
                  color: 'var(--tx)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--onacc)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Quick Switcher Overlay (Ctrl+P) */}
      <QuickSwitcher
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onOpenNote={(path, isNewTab) => {
          handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, path);
        }}
        onCreateNote={(title, isNewTab) => {
          const folder = selectedFolder;
          const fileName = deriveFileNameFromTitle(title);
          const newPath = folder ? `${folder}/${fileName}` : fileName;

          const newNoteItem: NoteListItem = {
            path: newPath,
            title,
            preview: '',
            modified: Date.now(),
            pinned: false,
            hasImage: false
          };

          setNotes((prev) => [newNoteItem, ...prev]);
          setTotalVaultNotesCount((prev) => prev + 1);

          handleSelectNote(isNewTab ? ({ ctrlKey: true } as any) : undefined, newPath);

          setTimeout(() => {
            if (typeof document !== 'undefined') {
              document.querySelector<HTMLElement>('.wrriter-prosemirror')?.focus();
            }
          }, 0);
        }}
      />

      {/* Settings Window Overlay (Loaded on first use) */}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsWindow
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            currentSettings={currentSettings}
            onSaveSettings={handleSaveSettings}
            onMarginChangeLive={(val) => setNoteMargin(val)}
          />
        </Suspense>
      )}


      {/* Temporary Notice Banner */}
      {noticeMessage && (
        <Notice message={noticeMessage} onDismiss={handleDismissNotice} />
      )}
    </WindowShell>
  );
};
