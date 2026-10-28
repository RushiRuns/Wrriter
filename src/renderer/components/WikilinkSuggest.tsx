import React, { useEffect, useRef, useMemo } from 'react';
import type { Editor } from '@tiptap/core';
import {
  type WikilinkSuggestState,
  wikilinkSuggestPluginKey,
  insertWikilink
} from '../editor/extensions/wikilink-suggest';

export interface NoteItemSuggest {
  readonly path: string;
  readonly title: string;
  readonly modified?: number | undefined;
}

export interface WikilinkSuggestProps {
  editor: Editor | null;
  suggestState: WikilinkSuggestState | null;
  availableNotes: readonly NoteItemSuggest[];
  onClose: () => void;
}

function getFolder(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}

function getBaseName(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const name = norm.slice(norm.lastIndexOf('/') + 1);
  return name.replace(/\.md$/i, '');
}

export const WikilinkSuggest: React.FC<WikilinkSuggestProps> = ({
  editor,
  suggestState,
  availableNotes,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Filter and rank available notes based on query
  const query = suggestState?.query?.trim().toLowerCase() ?? '';
  const filteredNotes = useMemo(() => {
    if (!availableNotes || availableNotes.length === 0) return [];

    let matched = availableNotes;
    if (query) {
      matched = availableNotes.filter((n) => {
        const titleMatch = n.title.toLowerCase().includes(query);
        const pathMatch = n.path.toLowerCase().includes(query);
        return titleMatch || pathMatch;
      });
    }

    // Rank: exact match first, prefix match next, then modified descending
    return matched.slice().sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      if (query) {
        const aExact = aTitle === query;
        const bExact = bTitle === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aTitle.startsWith(query);
        const bStarts = bTitle.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }
      return (b.modified ?? 0) - (a.modified ?? 0);
    }).slice(0, 8); // Top 8 suggestions
  }, [availableNotes, query]);

  // Identify duplicate note names to disambiguate [[Folder/Note]]
  const hasDuplicateTitle = useMemo(() => {
    const titleCounts = new Map<string, number>();
    for (const n of availableNotes) {
      const key = (n.title || getBaseName(n.path)).toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }
    return (note: NoteItemSuggest) => {
      const key = (note.title || getBaseName(note.path)).toLowerCase();
      return (titleCounts.get(key) ?? 0) > 1;
    };
  }, [availableNotes]);

  const activeIndex = useMemo(() => {
    if (filteredNotes.length === 0) return 0;
    const rawIdx = suggestState?.selectedIndex ?? 0;
    return rawIdx % filteredNotes.length;
  }, [suggestState?.selectedIndex, filteredNotes.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.wls-item');
    const activeEl = items[activeIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = (note: NoteItemSuggest) => {
    if (!editor || !suggestState) return;

    const folder = getFolder(note.path);
    const title = note.title || getBaseName(note.path);
    // If two notes share a name, disambiguate as [[Folder/Note]]
    const isDuplicate = hasDuplicateTitle(note);
    const target = isDuplicate && folder ? `${folder}/${title}` : title;

    insertWikilink(editor.view, suggestState.fromPos, suggestState.toPos, target);
    onClose();
  };

  if (!suggestState || !suggestState.isOpen || !editor) {
    return null;
  }

  const { coords } = suggestState;
  const flipAbove = coords?.flipAbove ?? false;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(coords?.left ?? 100, window.innerWidth - 300)),
    ...(flipAbove
      ? { bottom: window.innerHeight - (coords?.top ?? 0) + 8 }
      : { top: (coords?.bottom ?? 0) + 8 }),
    zIndex: 999
  };

  return (
    <div ref={containerRef} className="wls-popover" style={style}>
      <div className="wls-header">Link to note</div>
      <div ref={listRef} className="wls-list">
        {filteredNotes.length === 0 ? (
          <div className="wls-empty">No matching notes</div>
        ) : (
          filteredNotes.map((note, idx) => {
            const isSelected = idx === activeIndex;
            const folder = getFolder(note.path);
            const isDuplicate = hasDuplicateTitle(note);

            return (
              <button
                key={note.path}
                type="button"
                className={`wls-item ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelect(note)}
                onMouseEnter={() => {
                  if (editor && editor.view) {
                    editor.view.dispatch(
                      editor.view.state.tr.setMeta(wikilinkSuggestPluginKey, { selectedIndex: idx })
                    );
                  }
                }}
              >
                <div className="wls-item-title">{note.title || getBaseName(note.path)}</div>
                {folder && (
                  <div className={`wls-item-folder ${isDuplicate ? 'disambiguate' : ''}`}>
                    {folder}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
