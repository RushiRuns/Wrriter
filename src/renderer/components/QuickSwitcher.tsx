import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  matchQuickSwitcher,
  type QuickSwitcherItem,
  type QuickSwitcherSourceNote
} from '../../shared/domain/quick-switcher';
import { SearchIcon, FileIcon } from './icons';

export interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote: (path: string, openInNewTab?: boolean) => void;
  onCreateNote: (title: string, openInNewTab?: boolean) => void;
}

/**
 * Quick Switcher overlay (Ctrl+P) providing instant loose title matching against
 * the in-memory notes list, recent notes on empty query, Ctrl+Enter for a new tab,
 * and Create "what you typed" when nothing matches (M3, ADR-W15, PERFORMANCE.md).
 */
export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  onOpenNote,
  onCreateNote
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sourceNotes, setSourceNotes] = useState<readonly QuickSwitcherSourceNote[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load in-memory titles on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.dispatchEvent(new CustomEvent('wrriter:close-all-menus'));

      void (async () => {
        if (window.wrriter?.index?.getTitleList) {
          const res = await window.wrriter.index.getTitleList();
          if (res.ok) {
            setSourceNotes(res.value);
          }
        }
      })();

      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen]);

  // Compute matches instantly from in-memory titles
  const matches: readonly QuickSwitcherItem[] = useMemo(() => {
    if (!isOpen) return [];
    return matchQuickSwitcher(sourceNotes, query, 30);
  }, [isOpen, sourceNotes, query]);

  // Keep selected index within bounds
  useEffect(() => {
    if (matches.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= matches.length) {
      setSelectedIndex(matches.length - 1);
    }
  }, [matches, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.quick-switcher-item');
    const selectedItem = items[selectedIndex] as HTMLElement | undefined;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (matches.length > 0 ? (prev + 1) % matches.length : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          matches.length > 0 ? (prev - 1 + matches.length) % matches.length : 0
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const isNewTab = e.ctrlKey || e.metaKey;
        const selected = matches[selectedIndex];
        if (selected) {
          onClose();
          if (selected.type === 'create') {
            onCreateNote(selected.title, isNewTab);
          } else {
            onOpenNote(selected.path, isNewTab);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, matches, selectedIndex, onClose, onOpenNote, onCreateNote]);

  if (!isOpen) return null;

  return (
    <div
      className="quick-switcher-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="quick-switcher-modal" role="dialog" aria-modal="true">
        {/* Top Search Input */}
        <div className="quick-switcher-header">
          <span className="quick-switcher-icon">
            <SearchIcon style={{ width: 16, height: 16, color: 'var(--tx3)' }} />
          </span>
          <input
            ref={inputRef}
            className="quick-switcher-in"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type note title to open..."
            spellCheck={false}
          />
          <span className="quick-switcher-hint">
            Ctrl+↵ to open in new tab
          </span>
        </div>

        {/* Candidate Results List */}
        <div ref={listRef} className="quick-switcher-list">
          {matches.length === 0 ? (
            <div className="quick-switcher-empty">Nothing matches that</div>
          ) : (
            matches.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              if (item.type === 'create') {
                return (
                  <div
                    key={`create-${item.title}`}
                    className={`quick-switcher-item quick-switcher-create-item ${isSelected ? 'sel' : ''}`}
                    onClick={(e) => {
                      onClose();
                      const isNewTab = e.ctrlKey || e.metaKey;
                      onCreateNote(item.title, isNewTab);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="quick-switcher-item-icon" style={{ color: 'var(--accent)' }}>
                      +
                    </span>
                    <span className="quick-switcher-title" style={{ color: 'var(--accent)' }}>
                      Create "{item.title}"
                    </span>
                    <span className="quick-switcher-path-badge">↵ to create</span>
                  </div>
                );
              }

              return (
                <div
                  key={item.path}
                  className={`quick-switcher-item ${isSelected ? 'sel' : ''}`}
                  onClick={(e) => {
                    onClose();
                    const isNewTab = e.ctrlKey || e.metaKey;
                    onOpenNote(item.path, isNewTab);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="quick-switcher-item-icon">
                    <FileIcon style={{ width: 14, height: 14, color: 'var(--tx3)' }} />
                  </span>
                  <span className="quick-switcher-title">{item.title}</span>
                  {item.folder && (
                    <span className="quick-switcher-path-badge">{item.folder}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
