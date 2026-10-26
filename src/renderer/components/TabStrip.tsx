import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tooltip } from './Tooltip';

export interface TabItem {
  readonly path: string;
  readonly title: string;
}

export interface TabStripProps {
  tabs: readonly TabItem[];
  activeTabPath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onNewTab: () => void;
  onReorderTabs?: (sourceIndex: number, targetIndex: number) => void;
  onContextMenu?: (e: React.MouseEvent, tabPath: string) => void;
  savedState?: 'saved' | 'saving';
  wordCount?: number;
  charCount?: number;
}

/**
 * 32 px TabStrip along the bottom of the editor pane adhering to UI hand-off:
 * - 24 px tall tabs with 8 px corners and 13 px text.
 * - Active tab with 6% tint, normal text color, and close mark.
 * - Live note title updates.
 * - Middle-click and close button dismissal.
 * - Width preservation on mouse close until cursor leaves the strip.
 * - Horizontal scrolling for overflowing tabs.
 * - Drag and drop tab reordering.
 * - Right-aligned saved state and word count with character count tooltip.
 */
export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
  onContextMenu,
  savedState = 'saved',
  wordCount = 0,
  charCount = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Locked tab widths when closing via mouse
  const [lockedWidths, setLockedWidths] = useState<Map<string, number> | null>(null);

  // Drag and drop states
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Horizontal wheel scrolling
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && e.deltaY !== 0 && e.deltaX === 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Close tab with width lock
  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();

    // Lock widths if closed via mouse cursor
    if (e.clientX !== 0 || e.clientY !== 0) {
      const currentWidths = new Map<string, number>();
      for (const [p, el] of tabElementsRef.current.entries()) {
        if (p !== path && el) {
          currentWidths.set(p, el.getBoundingClientRect().width);
        }
      }
      setLockedWidths(currentWidths);
    }

    onCloseTab(path);
  };

  // Mouse leave strip resets locked widths
  const handleMouseLeave = () => {
    if (lockedWidths) {
      setLockedWidths(null);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragSourceIndex !== null && dragSourceIndex !== targetIndex && onReorderTabs) {
      onReorderTabs(dragSourceIndex, targetIndex);
    }
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="tstr"
      onMouseLeave={handleMouseLeave}
    >
      {/* Scrollable Tabs Container */}
      <div
        ref={scrollRef}
        className="tstr-scroll"
        onWheel={handleWheel}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.path === activeTabPath;
          const isDragging = dragSourceIndex === idx;
          const isTarget = dropTargetIndex === idx;
          const lockedWidth = lockedWidths?.get(tab.path);

          return (
            <div
              key={tab.path}
              ref={(el) => {
                if (el) tabElementsRef.current.set(tab.path, el);
                else tabElementsRef.current.delete(tab.path);
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`tstr-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${
                isTarget ? 'drop-target' : ''
              }`}
              onClick={() => onSelectTab(tab.path)}
              onAuxClick={(e) => {
                // Middle-click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  handleClose(e, tab.path);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu?.(e, tab.path);
              }}
              style={lockedWidth ? { width: lockedWidth, minWidth: lockedWidth, maxWidth: lockedWidth } : undefined}
              title={tab.path}
            >
              <span className="tstr-title">{tab.title || 'Untitled'}</span>
              <button
                type="button"
                className="tstr-close"
                onClick={(e) => handleClose(e, tab.path)}
                title="Close tab (Ctrl+W)"
                aria-label={`Close tab ${tab.title}`}
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Plus button to open new tab */}
        <button
          type="button"
          className="tstr-plus"
          onClick={onNewTab}
          title="New tab (Ctrl+N)"
          aria-label="New tab"
        >
          +
        </button>
      </div>

      {/* Right End: Saved status & word count with character count tooltip */}
      <div className="tstr-stats">
        <span className="tstr-saved">
          {savedState === 'saving' ? 'Saving...' : 'Saved'}
        </span>
        <Tooltip content={`${charCount.toLocaleString()} characters`} placement="top">
          <span className="tstr-words" tabIndex={0}>
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};
