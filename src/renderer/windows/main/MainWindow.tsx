import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ChevronRightIcon
} from '../../components/icons';
import { FirstRunScreen } from '../../components/FirstRunScreen';
import { VaultMenu } from '../../components/VaultMenu';
import { FolderTree } from '../../components/FolderTree';
import { NoteRow } from '../../components/NoteRow';
import { VirtualList } from '../../components/VirtualList';
import { NotesPaneMenu } from '../../components/NotesPaneMenu';
import type {
  FolderNode,
  NoteListItem,
  StartupState,
  VaultInfo,
  AppSettingsContract
} from '../../../shared/ipc';

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
  const [notes, setNotes] = useState<readonly NoteListItem[]>([]);
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('Welcome to Wrriter');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState<number>(Date.now());

  // Notes pane 3-dot menu and context menu state
  const [notesMenuOpen, setNotesMenuOpen] = useState(false);
  const [noteContextMenu, setNoteContextMenu] = useState<{ x: number; y: number; note: NoteListItem } | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [newFolderInputError, setNewFolderInputError] = useState<string | null>(null);

  // Settings state (defaults per SCHEMA.md)
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

  // Refresh folders from disk
  const refreshFolders = useCallback(async () => {
    if (window.wrriter?.folder?.list) {
      const res = await window.wrriter.folder.list();
      if (res.ok) {
        setFolders(res.value);
      }
    }
  }, []);

  // Refresh notes from disk
  const refreshNotes = useCallback(async (folderPath: string | null = selectedFolder, currentSort: 'manual' | 'modified' | 'title' = sortBy) => {
    if (window.wrriter?.note?.list) {
      const res = await window.wrriter.note.list({
        folder: folderPath ?? undefined,
        sortBy: currentSort
      });
      if (res.ok) {
        setNotes(res.value);
        // If current selected note no longer exists, select first available
        if (res.value.length > 0) {
          const currentExists = res.value.some((n: NoteListItem) => n.path === selectedNotePath);
          if (!currentExists && !selectedNotePath) {
            setSelectedNotePath(res.value[0]?.path ?? null);
            setNoteTitle(res.value[0]?.title ?? 'Untitled');
          }
        }
      }
    }
  }, [selectedFolder, sortBy, selectedNotePath]);

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

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutside = () => setNoteContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNoteContextMenu(null);
        setNotesMenuOpen(false);
        setVaultMenuOpen(false);
        setShowNewFolderModal(false);
      }
    };
    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleKey);
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
          if (s.noteList) {
            const mappedSort = s.noteList.sortBy === 'created' ? 'modified' : s.noteList.sortBy;
            setSortBy(mappedSort);
            setShowSortIcon(Boolean(s.noteList.showSortIcon));
            setShowPreviews(s.noteList.showPreviews ?? true);
            setShowDates(s.noteList.showDates ?? true);
            setShowImages(s.noteList.showImages ?? true);
          }
          if (s.noteMargin) setNoteMargin(s.noteMargin);
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
      void loadNoteContent(selectedNotePath);
      const matched = notes.find((n) => n.path === selectedNotePath);
      if (matched) {
        setNoteTitle(matched.title);
        setNoteDate(matched.modified);
      }
    }
  }, [selectedNotePath, notes, loadNoteContent]);

  // Divider resize handlers (with limits: sidebar 180-400px, list 240-500px)
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const clamped = Math.max(180, Math.min(400, startW + delta));
      setSidebarWidth(clamped);
      document.documentElement.style.setProperty('--sidew', `${clamped}px`);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      savePaneWidths(sidebarWidth, listWidth);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleListResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const clamped = Math.max(240, Math.min(500, startW + delta));
      setListWidth(clamped);
      document.documentElement.style.setProperty('--listw', `${clamped}px`);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      savePaneWidths(sidebarWidth, listWidth);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Create new note action
  const handleCreateNewNote = async () => {
    const parentFolder = selectedFolder ? `${selectedFolder}/` : '';
    const noteFileName = `${parentFolder}Untitled ${Date.now()}.md`;
    const initialText = `# Untitled Note\n\nStart typing your note here...`;

    if (window.wrriter?.note?.save) {
      const res = await window.wrriter.note.save({
        path: noteFileName,
        text: initialText
      });
      if (res.ok) {
        await refreshNotes();
        await refreshFolders();
        setSelectedNotePath(noteFileName);
        setNoteTitle('Untitled Note');
        setNoteContent(initialText);
        setNoteDate(Date.now());
      }
    }
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
    if (window.wrriter?.note?.delete) {
      const res = await window.wrriter.note.delete({ path: note.path });
      if (res.ok) {
        await refreshNotes();
        await refreshFolders();
        if (selectedNotePath === note.path) {
          const remaining = notes.filter((n) => n.path !== note.path);
          if (remaining.length > 0) {
            setSelectedNotePath(remaining[0]?.path ?? null);
            setNoteTitle(remaining[0]?.title ?? 'Untitled');
          } else {
            setSelectedNotePath(null);
            setNoteTitle('Welcome to Wrriter');
            setNoteContent('');
          }
        }
      }
    }
  };

  // In-place rename from toolbar
  const handleRenameNote = async (newName: string) => {
    if (!selectedNotePath) return;
    setNoteTitle(newName);
    // In M1, updating title in note text
    const updatedBody = noteContent ? noteContent.replace(/^#\s+.*$/m, `# ${newName}`) : `# ${newName}\n\n`;
    if (window.wrriter?.note?.save) {
      await window.wrriter.note.save({
        path: selectedNotePath,
        text: updatedBody
      });
      await refreshNotes();
    }
  };

  // Group notes into pinned and unpinned
  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  // Compute folder title in notes pane header
  const getFolderHeaderName = () => {
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
                void refreshNotes(null);
              }}
              title="Notes"
            >
              <NotesTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'inbox' ? 'on' : ''}`}
              onClick={() => setActiveTile('inbox')}
              title="Inbox"
            >
              <InboxTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'tags' ? 'on' : ''}`}
              onClick={() => setActiveTile('tags')}
              title="Tags"
            >
              <TagsTileIcon />
            </button>
            <button
              type="button"
              className={`tile ${activeTile === 'search' ? 'on' : ''}`}
              onClick={() => setActiveTile('search')}
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

          {/* Folders label */}
          <div className="lbl">
            FOLDERS
          </div>

          {/* Folder Tree Hierarchy */}
          <FolderTree
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={(path) => {
              setSelectedFolder(path);
              void refreshNotes(path);
            }}
            totalVaultNotesCount={notes.length}
            onRefresh={async () => {
              await refreshFolders();
              await refreshNotes();
            }}
          />

          {/* Bottom Vault Button and Popup Menu */}
          <div className="vaults" style={{ position: 'relative' }}>
            <button
              type="button"
              className="vtrig"
              aria-expanded={vaultMenuOpen}
              onClick={() => setVaultMenuOpen((open) => !open)}
              title="Vault menu"
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <div
                className="vc p"
                style={{
                  backgroundColor: 'var(--vault-p)',
                  color: '#fff'
                }}
              >
                {activeVault?.name ? activeVault.name[0]?.toUpperCase() : 'W'}
              </div>
              <span className="vn">{activeVault?.name || 'Personal Vault'}</span>
              <ChevronUpDownIcon style={{ marginLeft: 'auto', width: 16, height: 16, color: 'var(--tx3)' }} />
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

        {/* Note List / Virtualized Note Rows */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {notes.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tx3)', fontSize: 'var(--fs-small)' }}>
              No notes yet. Click new note to begin writing.
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
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
                        onSelect={() => {
                          setSelectedNotePath(note.path);
                          setNoteTitle(note.title);
                        }}
                        onContextMenu={(e, item) => {
                          e.preventDefault();
                          e.stopPropagation();
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
                    onSelect={() => {
                      setSelectedNotePath(note.path);
                      setNoteTitle(note.title);
                    }}
                    onContextMenu={(e, item) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNoteContextMenu({ x: e.clientX, y: e.clientY, note: item });
                    }}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Note Context Menu (Right Click on Note Row) */}
        {noteContextMenu && (
          <div
            className="lmenu"
            style={{
              position: 'fixed',
              left: Math.min(noteContextMenu.x, window.innerWidth - 200),
              top: Math.min(noteContextMenu.y, window.innerHeight - 120),
              minWidth: 180,
              zIndex: 100,
              animation: 'lin var(--t-fast) var(--ease-arrive) both'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <li
              className="vi"
              style={{ cursor: 'pointer', height: 32, padding: '0 8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => void handleTogglePinNote(noteContextMenu.note)}
            >
              <PinIcon style={{ width: 14, height: 14 }} />
              <span className="vn">{noteContextMenu.note.pinned ? 'Unpin note' : 'Pin note'}</span>
            </li>
            <li className="vmd" style={{ height: 1, margin: '4px 0', backgroundColor: 'var(--line)' }} />
            <li
              className="vi"
              style={{ cursor: 'pointer', height: 32, padding: '0 8px', borderRadius: 8, color: 'var(--dgr)' }}
              onClick={() => void handleDeleteNote(noteContextMenu.note)}
            >
              <span className="vn" style={{ color: 'var(--dgr)' }}>Delete note</span>
            </li>
          </div>
        )}

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
        {/* Editor 3-dot button in top right corner */}
        <div className="nmore">
          <button
            type="button"
            className="ib"
            title="Note options"
            style={{ width: 32, height: 32, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <MoreDotsIcon />
          </button>
        </div>

        {/* Scrollable Note Content Column */}
        <div className="edscroll">
          <div
            className="col"
            style={{
              paddingLeft: noteMargin,
              paddingRight: noteMargin,
              minWidth: 360
            }}
          >
            <div className="meta">
              {new Date(noteDate).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <h1 className="ed1" style={{ textAlign: 'center' }}>
              {noteTitle}
            </h1>
            <div style={{ fontSize: 18, lineHeight: '30px', color: 'var(--tx)', marginTop: 24, whiteSpace: 'pre-wrap' }}>
              {noteContent || (
                <span style={{ color: 'var(--tx3)' }}>
                  Empty note ready for writing. Type / for commands.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 32px Tabs Strip along the bottom of the editor pane */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 'var(--tab-h, 32px)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderTop: '1px solid var(--div)',
            backgroundColor: 'var(--ed)'
          }}
        >
          <div
            className="tab on"
            style={{
              height: 24,
              padding: '0 12px',
              borderRadius: 8,
              fontSize: 'var(--fs-small)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--tx)',
              backgroundColor: 'color-mix(in srgb, var(--tx) 6%, transparent)'
            }}
          >
            <span>{noteTitle}</span>
          </div>
        </div>
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
    </WindowShell>
  );
};
