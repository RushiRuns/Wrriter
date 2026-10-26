import React, { useState, useRef, useEffect } from 'react';
import {
  SidebarToggleIcon,
  BackIcon,
  ForwardIcon,
  NewNoteIcon,
  MinimiseIcon,
  MaximiseIcon,
  CloseIcon
} from './icons';

export interface WindowShellProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  noteName: string;
  onRenameNote?: (newName: string) => void;
  onNewNote?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
}

export const WindowShell: React.FC<WindowShellProps> = ({
  children,
  sidebarOpen,
  onToggleSidebar,
  noteName,
  onRenameNote,
  onNewNote,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(noteName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedName(noteName);
  }, [noteName]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const commitRename = () => {
    setIsEditingName(false);
    const trimmed = editedName.trim().slice(0, 60);
    if (trimmed && trimmed !== noteName) {
      onRenameNote?.(trimmed);
    } else {
      setEditedName(noteName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditedName(noteName);
    }
  };

  const handleMinimise = () => {
    void window.wrriter?.window?.minimize();
  };

  const handleMaximise = () => {
    void window.wrriter?.window?.maximize();
  };

  const handleClose = () => {
    void window.wrriter?.window?.close();
  };

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        borderRadius: 16,
        boxShadow: 'inset 0 0 0 1px var(--div)'
      }}
    >
      {/* 40 px Frameless Toolbar */}
      <div
        className="tbw"
        style={dragStyle}
        onDoubleClick={handleMaximise}
      >
        <div className="tb">
          {/* Sidebar toggle button (28 px at left) */}
          <button
            type="button"
            className="sbt ib"
            style={noDragStyle}
            onClick={onToggleSidebar}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <SidebarToggleIcon />
          </button>

          {/* Left navigation buttons (Back / Forward) */}
          <div className="tbl" style={noDragStyle}>
            <button
              type="button"
              className={`ib ${!canGoBack ? 'dim' : ''}`}
              onClick={canGoBack ? onGoBack : undefined}
              title="Back (Alt+Left)"
              disabled={!canGoBack}
            >
              <BackIcon />
            </button>
            <button
              type="button"
              className={`ib ${!canGoForward ? 'dim' : ''}`}
              onClick={canGoForward ? onGoForward : undefined}
              title="Forward (Alt+Right)"
              disabled={!canGoForward}
            >
              <ForwardIcon />
            </button>
          </div>

          {/* Middle: Centered Note Name Field with in-place rename */}
          <div className="tbmid" style={noDragStyle}>
            <div className={`tbpill ${isEditingName ? 'ed' : ''}`}>
              {isEditingName ? (
                <input
                  ref={inputRef}
                  className="rin"
                  value={editedName}
                  maxLength={60}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  title="Rename note"
                />
              ) : (
                <button
                  type="button"
                  className="pnb"
                  onClick={() => setIsEditingName(true)}
                  title="Click to rename"
                >
                  <span className="pn">{noteName || 'Untitled'}</span>
                </button>
              )}
            </div>

            {/* New Note Button (8 px right of name field pill) */}
            <button
              type="button"
              className="tbnew ib"
              onClick={onNewNote}
              title="New note"
            >
              <NewNoteIcon />
            </button>
          </div>

          {/* Right: Three drawn round window buttons */}
          <div className="wc" style={noDragStyle}>
            <button
              type="button"
              className="mn"
              onClick={handleMinimise}
              title="Minimise"
              aria-label="Minimise"
            >
              <MinimiseIcon />
            </button>
            <button
              type="button"
              className="mx"
              onClick={handleMaximise}
              title="Maximise"
              aria-label="Maximise"
            >
              <MaximiseIcon />
            </button>
            <button
              type="button"
              className="x"
              onClick={handleClose}
              title="Close"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Main Panes Container */}
      <div className="main" style={{ flex: 1, minHeight: 0, marginTop: 'var(--tb-h)' }}>
        {children}
      </div>
    </div>
  );
};
