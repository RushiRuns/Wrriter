import React, { useEffect, useRef } from 'react';
import {
  PinIcon,
  DuplicateIcon,
  SearchTileIcon,
  PopOutIcon,
  ShowInExplorerIcon,
  TrashTileIcon
} from '../icons';

export interface EditorMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onFindInNote: () => void;
  onShowInExplorer: () => void;
  onDeleteNote: () => void;
  onDuplicateNote?: () => void;
  onPopOut?: () => void;
}

export const EditorMenu: React.FC<EditorMenuProps> = ({
  isOpen,
  onClose,
  isPinned,
  onTogglePin,
  onFindInNote,
  onShowInExplorer,
  onDeleteNote,
  onDuplicateNote,
  onPopOut
}) => {
  const menuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Close any other open menu
    window.dispatchEvent(new CustomEvent('wrriter:close-all-menus', { detail: { except: 'editor-menu' } }));

    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ul
      ref={menuRef}
      className="lmenu ed"
      role="menu"
      aria-label="Editor note options"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Pin / Unpin */}
      <li
        className="vi"
        role="menuitem"
        onClick={() => {
          onClose();
          onTogglePin();
        }}
        style={{ cursor: 'pointer' }}
      >
        <PinIcon className="ic m" />
        <span className="vn">{isPinned ? 'Unpin note' : 'Pin note'}</span>
      </li>

      {/* 2. Duplicate */}
      <li
        className="vi"
        role="menuitem"
        onClick={() => {
          onClose();
          onDuplicateNote?.();
        }}
        style={{ cursor: 'pointer' }}
      >
        <DuplicateIcon />
        <span className="vn">Duplicate</span>
      </li>

      {/* 3. Find in note */}
      <li
        className="vi"
        role="menuitem"
        onClick={() => {
          onClose();
          onFindInNote();
        }}
        style={{ cursor: 'pointer' }}
      >
        <SearchTileIcon className="ic m" />
        <span className="vn">Find in note</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>Ctrl+F</span>
      </li>

      {/* 4. Pop out */}
      <li
        className={`vi ${!onPopOut ? 'disabled' : ''}`}
        role="menuitem"
        aria-disabled={!onPopOut}
        onClick={() => {
          if (onPopOut) {
            onClose();
            onPopOut();
          }
        }}
        style={{ cursor: onPopOut ? 'pointer' : 'default', opacity: onPopOut ? 1 : 0.5 }}
      >
        <PopOutIcon />
        <span className="vn">Pop out</span>
      </li>

      {/* 5. Show in File Explorer */}
      <li
        className="vi"
        role="menuitem"
        onClick={() => {
          onClose();
          onShowInExplorer();
        }}
        style={{ cursor: 'pointer' }}
      >
        <ShowInExplorerIcon />
        <span className="vn">Show in File Explorer</span>
      </li>

      {/* Divider */}
      <li className="vmd" style={{ height: 1, margin: 'var(--s-2) 0', backgroundColor: 'var(--line)' }} />

      {/* 6. Delete note */}
      <li
        className="vi"
        role="menuitem"
        onClick={() => {
          onClose();
          onDeleteNote();
        }}
        style={{ cursor: 'pointer', color: 'var(--dgr)' }}
      >
        <TrashTileIcon className="ic m" style={{ color: 'var(--dgr)' }} />
        <span className="vn" style={{ color: 'var(--dgr)' }}>Delete note</span>
      </li>
    </ul>
  );
};
