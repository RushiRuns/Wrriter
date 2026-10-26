import React, { useState, useEffect, useRef, useMemo } from 'react';
import { commandRegistry, type CommandMatch } from '../palette/command-registry';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Command Palette overlay (Ctrl+Shift+P) providing instant command search
 * with loose matching, keyboard navigation, and palette motion.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Loose search results
  const matches: readonly CommandMatch[] = useMemo(() => {
    if (!isOpen) return [];
    return commandRegistry.search(query);
  }, [isOpen, query]);

  // Reset query and focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.dispatchEvent(new CustomEvent('wrriter:close-all-menus'));
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

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
    const items = listRef.current.querySelectorAll('.cmd-pal-item');
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
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (matches.length > 0 ? (prev + 1) % matches.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (matches.length > 0 ? (prev - 1 + matches.length) % matches.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = matches[selectedIndex];
        if (selected) {
          onClose();
          void selected.command.run();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, matches, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cmd-pal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cmd-palette" role="dialog" aria-modal="true">
        {/* Search Input Box */}
        <div className="cmd-pal-header">
          <input
            ref={inputRef}
            className="cmd-pal-in"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            spellCheck={false}
          />
        </div>

        {/* Results List */}
        <div ref={listRef} className="cmd-pal-list">
          {matches.length === 0 ? (
            <div className="cmd-pal-empty">Nothing matches that</div>
          ) : (
            matches.map((match, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={match.command.id}
                  className={`cmd-pal-item ${isSelected ? 'sel' : ''}`}
                  onClick={() => {
                    onClose();
                    void match.command.run();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cmd-pal-cat">{match.command.category}</span>
                  <span className="cmd-pal-title">{match.command.title}</span>
                  {match.command.shortcut && (
                    <span className="cmd-pal-shortcut">{match.command.shortcut}</span>
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
