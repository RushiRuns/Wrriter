import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { IndexSearchResultItem } from '../../shared/ipc/contracts';
import { VirtualList } from './VirtualList';
import { SearchIcon, CloseIcon } from './icons';

export interface SearchViewProps {
  selectedNotePath: string | null;
  onSelectNote: (relPath: string, openInNewTab?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, path: string, title: string) => void;
}

/**
 * Safely escapes HTML characters while keeping only <mark> and <b> highlight tags.
 */
function sanitizeSnippetHtml(raw: string): string {
  if (!raw) return '';
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/&lt;mark&gt;/g, '<mark class="sr-mark">')
    .replace(/&lt;\/mark&gt;/g, '</mark>')
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>');
}

export const SearchView: React.FC<SearchViewProps> = ({
  selectedNotePath,
  onSelectNote,
  onContextMenu
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly IndexSearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus search input on mount and on wrriter:focus-search event
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener('wrriter:focus-search', handleFocusSearch);
    return () => {
      window.removeEventListener('wrriter:focus-search', handleFocusSearch);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      if (window.wrriter?.index?.search) {
        const res = await window.wrriter.index.search({ query: searchQuery, limit: 100 });
        if (res.ok) {
          setResults(res.value);
        } else {
          setResults([]);
        }
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce live search typing by 40ms for fast, buttery smooth responsiveness
    searchTimeoutRef.current = setTimeout(() => {
      void executeSearch(val);
    }, 40);
  };

  const handleAppendFilter = (filterPrefix: string) => {
    const updated = query ? `${query.trim()} ${filterPrefix}` : filterPrefix;
    setQuery(updated);
    inputRef.current?.focus();
    void executeSearch(updated);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="search-view" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Top Search Input Bar */}
      <div className="search-bar-wrap">
        <div className="search-input-box">
          <span className="search-input-icon">
            <SearchIcon style={{ width: 14, height: 14, color: 'var(--tx3)' }} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (query) {
                  e.preventDefault();
                  handleClear();
                }
              }
            }}
            placeholder="Search notes, tag:, status:, folder:..."
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              title="Clear search"
              aria-label="Clear search"
            >
              <CloseIcon style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>

        {/* Filter Suggestion Badges */}
        <div className="search-filters-row">
          <span className="search-filters-label">Filters:</span>
          <button
            type="button"
            className="search-filter-pill"
            onClick={() => handleAppendFilter('tag:')}
            title="Add tag filter"
          >
            tag:
          </button>
          <button
            type="button"
            className="search-filter-pill"
            onClick={() => handleAppendFilter('status:')}
            title="Add status filter"
          >
            status:
          </button>
          <button
            type="button"
            className="search-filter-pill"
            onClick={() => handleAppendFilter('folder:')}
            title="Add folder filter"
          >
            folder:
          </button>
        </div>
      </div>

      {/* Results Header / Count */}
      <div className="search-status-bar">
        {query.trim() ? (
          <span>
            {isSearching ? 'Searching...' : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </span>
        ) : (
          <span>Type to search across the vault</span>
        )}
      </div>

      {/* Results List */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {query.trim() && results.length === 0 && !isSearching ? (
          <div className="search-empty">
            No notes match "{query}" in this vault.
          </div>
        ) : (
          <div className="notes-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <VirtualList
              items={results}
              getKey={(item) => item.path}
              renderItem={(item) => {
                const isSelected = selectedNotePath === item.path;
                const dateStr = item.mtime_ms
                  ? new Date(item.mtime_ms).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    })
                  : '';

                const snippetText = item.snippet || item.preview;

                return (
                  <div
                    key={item.path}
                    className={`row search-result-row ${isSelected ? 'sel' : ''}`}
                    onClick={(e) => {
                      const isNewTab = e.ctrlKey || e.metaKey || e.button === 1;
                      onSelectNote(item.path, isNewTab);
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        onSelectNote(item.path, true);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onContextMenu?.(e, item.path, item.title);
                    }}
                    style={{
                      height: 80,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    tabIndex={0}
                    role="button"
                    aria-selected={isSelected}
                  >
                    <div className="rtx" style={{ flex: 1, minWidth: 0 }}>
                      {/* Title and Folder path */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="t1" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title || 'Untitled Note'}
                        </span>
                        {item.folder && (
                          <span className="sr-folder-badge">
                            {item.folder}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      {dateStr && <span className="dt">{dateStr}</span>}

                      {/* Snippet / Preview */}
                      {snippetText && (
                        <span
                          className="pv sr-snippet"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeSnippetHtml(snippetText)
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
