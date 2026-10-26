import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, ChevronRightIcon } from './icons';

export interface NotesPaneMenuProps {
  isOpen: boolean;
  onClose: () => void;
  sortBy: 'manual' | 'modified' | 'title';
  onSortByChange: (sortBy: 'manual' | 'modified' | 'title') => void;
  showSortIcon: boolean;
  onToggleShowSortIcon: () => void;
  showPreviews: boolean;
  onToggleShowPreviews: () => void;
  showDates: boolean;
  onToggleShowDates: () => void;
  showImages: boolean;
  onToggleShowImages: () => void;
  onNewFolder: () => void;
}

export const NotesPaneMenu: React.FC<NotesPaneMenuProps> = ({
  isOpen,
  onClose,
  sortBy,
  onSortByChange,
  showSortIcon,
  onToggleShowSortIcon,
  showPreviews,
  onToggleShowPreviews,
  showDates,
  onToggleShowDates,
  showImages,
  onToggleShowImages,
  onNewFolder
}) => {
  const [showSortSubmenu, setShowSortSubmenu] = useState(false);
  const menuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowSortSubmenu(false);
      return;
    }

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

    const handleCloseAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ except?: string }>;
      if (customEvent.detail?.except !== 'notes-pane-menu') {
        onClose();
      }
    };

    // Register after current tick to avoid immediate closing from trigger click
    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('wrriter:close-all-menus', handleCloseAll);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wrriter:close-all-menus', handleCloseAll);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getSortLabel = () => {
    switch (sortBy) {
      case 'manual':
        return 'Manual';
      case 'modified':
        return 'Date modified';
      case 'title':
        return 'Title';
      default:
        return 'Manual';
    }
  };

  return (
    <ul
      ref={menuRef}
      className="lmenu"
      style={{
        position: 'absolute',
        top: 44,
        right: 8,
        minWidth: 248,
        zIndex: 50,
        margin: 0,
        padding: 'var(--s-2)',
        listStyle: 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Sort by item with submenu toggle */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={() => setShowSortSubmenu((s) => !s)}
      >
        <span className="vn">Sort by</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>
            {getSortLabel()}
          </span>
          <ChevronRightIcon
            style={{
              width: 14,
              height: 14,
              color: 'var(--tx3)',
              transform: showSortSubmenu ? 'rotate(90deg)' : 'none',
              transition: 'transform var(--t-fast) var(--ease-move)'
            }}
          />
        </div>
      </li>

      {/* Submenu for Sort Options */}
      {showSortSubmenu && (
        <div
          style={{
            paddingLeft: 12,
            marginBottom: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <li
            className="vi"
            style={{
              cursor: 'pointer',
              height: 28,
              padding: '0 8px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onClick={() => {
              onSortByChange('manual');
              setShowSortSubmenu(false);
            }}
          >
            <span className="vn" style={{ fontSize: 'var(--fs-small)' }}>Manual</span>
            <span className={`ck ${sortBy === 'manual' ? 'on' : ''}`}>
              <CheckIcon />
            </span>
          </li>
          <li
            className="vi"
            style={{
              cursor: 'pointer',
              height: 28,
              padding: '0 8px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onClick={() => {
              onSortByChange('modified');
              setShowSortSubmenu(false);
            }}
          >
            <span className="vn" style={{ fontSize: 'var(--fs-small)' }}>Date modified</span>
            <span className={`ck ${sortBy === 'modified' ? 'on' : ''}`}>
              <CheckIcon />
            </span>
          </li>
          <li
            className="vi"
            style={{
              cursor: 'pointer',
              height: 28,
              padding: '0 8px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onClick={() => {
              onSortByChange('title');
              setShowSortSubmenu(false);
            }}
          >
            <span className="vn" style={{ fontSize: 'var(--fs-small)' }}>Title</span>
            <span className={`ck ${sortBy === 'title' ? 'on' : ''}`}>
              <CheckIcon />
            </span>
          </li>
        </div>
      )}

      {/* 2. Show sort icon */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={onToggleShowSortIcon}
      >
        <span className="vn">Show sort icon</span>
        <span className={`ck ${showSortIcon ? 'on' : ''}`}>
          <CheckIcon />
        </span>
      </li>

      {/* 3. Show previews */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={onToggleShowPreviews}
      >
        <span className="vn">Show previews</span>
        <span className={`ck ${showPreviews ? 'on' : ''}`}>
          <CheckIcon />
        </span>
      </li>

      {/* 4. Show dates */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={onToggleShowDates}
      >
        <span className="vn">Show dates</span>
        <span className={`ck ${showDates ? 'on' : ''}`}>
          <CheckIcon />
        </span>
      </li>

      {/* 5. Show images */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={onToggleShowImages}
      >
        <span className="vn">Show images</span>
        <span className={`ck ${showImages ? 'on' : ''}`}>
          <CheckIcon />
        </span>
      </li>

      {/* Divider */}
      <li className="vmd" style={{ height: 1, margin: '6px 0', backgroundColor: 'var(--line)' }} />

      {/* 6. New folder */}
      <li
        className="vi"
        style={{
          cursor: 'pointer',
          height: 32,
          padding: '0 8px',
          borderRadius: 8
        }}
        onClick={() => {
          onClose();
          onNewFolder();
        }}
      >
        <span className="vn">New folder</span>
      </li>
    </ul>
  );
};
