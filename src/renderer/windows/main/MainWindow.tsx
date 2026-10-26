import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WindowShell } from '../../components/WindowShell';
import {
  NotesTileIcon,
  InboxTileIcon,
  TagsTileIcon,
  SearchTileIcon,
  ArchiveTileIcon,
  TrashTileIcon,
  FolderClosedIcon,
  ChevronRightIcon
} from '../../components/icons';
import type { FirstPaintNoteSummary, StartupState } from '../../../shared/ipc';

export const MainWindow: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(248);
  const [listWidth, setListWidth] = useState(320);
  const [activeTile, setActiveTile] = useState<'notes' | 'inbox' | 'tags' | 'search' | 'archive' | 'trash'>('notes');
  const [notes, setNotes] = useState<readonly FirstPaintNoteSummary[]>([]);
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('Welcome to Wrriter');
  const [vaultName, setVaultName] = useState<string | null>(null);

  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Load initial startup state from IPC (or query string fallback)
  useEffect(() => {
    let isMounted = true;

    async function loadStartup() {
      // 1. Initial query params fallback
      try {
        const params = new URLSearchParams(window.location.search);
        const qSide = parseInt(params.get('sidebarWidth') || '', 10);
        const qList = parseInt(params.get('listWidth') || '', 10);
        if (!isNaN(qSide) && qSide >= 180) setSidebarWidth(qSide);
        if (!isNaN(qList) && qList >= 240) setListWidth(qList);
      } catch (_) {}

      // 2. Read full startup state via typed IPC
      if (window.wrriter?.app?.getStartupState) {
        const res = await window.wrriter.app.getStartupState();
        if (res.ok && isMounted) {
          const state: StartupState = res.value;
          if (state.windowState.sidebarWidth) setSidebarWidth(state.windowState.sidebarWidth);
          if (state.windowState.listWidth) setListWidth(state.windowState.listWidth);
          if (state.activeVault) setVaultName(state.activeVault.name);
          if (state.firstPaintNotes && state.firstPaintNotes.length > 0) {
            setNotes(state.firstPaintNotes);
            setSelectedNotePath(state.firstPaintNotes[0]?.path ?? null);
            setNoteTitle(state.firstPaintNotes[0]?.title ?? 'Untitled');
          }
        }
      }

      // 3. Notify main process that first frame/paint is complete
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

  // Save pane widths (debounced)
  const savePaneWidths = useCallback((newSide: number, newList: number) => {
    void window.wrriter?.window?.setPaneWidths({
      sidebarWidth: newSide,
      listWidth: newList
    });
  }, []);

  // Handle divider dragging for sidebar width
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

  // Handle divider dragging for notes list width
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

  return (
    <WindowShell
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      noteName={noteTitle}
      onRenameNote={(newName) => setNoteTitle(newName)}
      onNewNote={() => {
        const newNote: FirstPaintNoteSummary = {
          path: `Untitled ${Date.now()}.md`,
          title: 'Untitled Note',
          preview: 'Empty note ready for writing...',
          modified: Date.now()
        };
        setNotes((prev) => [newNote, ...prev]);
        setSelectedNotePath(newNote.path);
        setNoteTitle(newNote.title);
      }}
    >
      {/* 1. First Pane: Sidebar (Icon Tiles, Folders, Vault & Settings) */}
      <aside
        className={`side ${!sidebarOpen ? 'shut' : ''}`}
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          position: 'relative'
        }}
      >
        <div className="sin">
          {/* Six Icon Tiles in 2 rows of 3 */}
          <div className="tiles">
            <button
              type="button"
              className={`tile ${activeTile === 'notes' ? 'on' : ''}`}
              onClick={() => setActiveTile('notes')}
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
          <div style={{ height: 1, backgroundColor: 'var(--div)', margin: '0 16px 8px' }} />

          {/* Folders Label */}
          <div style={{ padding: '0 16px 4px', fontSize: 'var(--fs-label)', color: 'var(--tx3)', fontWeight: 600 }}>
            FOLDERS
          </div>

          {/* Folder Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            <div className="fr sel" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 8px', borderRadius: 8 }}>
              <FolderClosedIcon />
              <span style={{ fontSize: 'var(--fs-ui)', flex: 1 }}>Notes</span>
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>{notes.length}</span>
            </div>
          </div>

          {/* Bottom Vault Button and Gear */}
          <div style={{ borderTop: '1px solid var(--div)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--vault-p)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>
                {vaultName ? vaultName[0]?.toUpperCase() : 'W'}
              </div>
              <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 600 }}>{vaultName || 'Personal Vault'}</span>
            </div>
          </div>
        </div>

        {/* Resizer Handle */}
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

      {/* 2. Notes Pane (List of Notes from First Paint State) */}
      <section
        className="list"
        style={{
          width: listWidth,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header (48px tall) */}
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: '1px solid var(--div)' }}>
          <button
            type="button"
            className="ib"
            onClick={() => setSidebarOpen((open) => !open)}
            title="Toggle first pane"
          >
            <ChevronRightIcon style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>Notes</span>
          <span style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>{notes.length} notes</span>
        </div>

        {/* Group Label */}
        <div style={{ padding: '12px 16px 4px', fontSize: 'var(--fs-label)', color: 'var(--tx3)', fontWeight: 600 }}>
          NOTES
        </div>

        {/* Note Rows (Rendered immediately from first-paint state) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {notes.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--tx3)', fontSize: 'var(--fs-small)' }}>
              No notes yet. Click new note to begin writing.
            </div>
          ) : (
            notes.map((note) => {
              const isSelected = selectedNotePath === note.path;
              const dateStr = new Date(note.modified).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              });

              return (
                <div
                  key={note.path}
                  className={`row ${isSelected ? 'sel' : ''}`}
                  onClick={() => {
                    setSelectedNotePath(note.path);
                    setNoteTitle(note.title);
                  }}
                  style={{
                    height: 80,
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {note.title}
                    </span>
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>
                      {dateStr}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.preview || 'No preview text'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resizer Handle */}
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px 32px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', fontSize: 'var(--fs-small)', color: 'var(--tx3)', marginBottom: 8 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <h1 style={{ fontSize: 38, lineHeight: '48px', fontWeight: 800, color: 'var(--tx)', margin: '0 0 24px', textAlign: 'center' }}>
              {noteTitle}
            </h1>
            <p style={{ fontSize: 18, lineHeight: '30px', color: 'var(--tx)', marginTop: 16 }}>
              {notes.find((n) => n.path === selectedNotePath)?.preview ||
                'Welcome to Wrriter. Your distraction-free local markdown editor with instant first-paint, physical disk flushes, and pure offline operation.'}
            </p>
          </div>
        </div>

        {/* 32 px Tabs Strip along the bottom of the editor pane */}
        <div
          style={{
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
              color: 'var(--tx)'
            }}
          >
            <span>{noteTitle}</span>
          </div>
        </div>
      </main>
    </WindowShell>
  );
};
