import React, { useState } from 'react';
import type { NoteListItem } from '../../shared/ipc/contracts';
import { PinIcon } from './icons';

export interface NoteRowProps {
  note: NoteListItem;
  isSelected: boolean;
  showDates: boolean;
  showPreviews: boolean;
  showImages: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, note: NoteListItem) => void;
  onReorder?: ((draggedPath: string, targetPath: string, position: 'before' | 'after') => void) | undefined;
}

function resolveThumbnailSrc(src: string): string {
  if (
    src.startsWith('data:') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('wrriter-vault://') ||
    src.startsWith('file://')
  ) {
    return src;
  }
  const clean = src.replace(/\\/g, '/').replace(/^\/+/, '');
  return `wrriter-vault://${clean}`;
}

export const NoteRow: React.FC<NoteRowProps> = ({
  note,
  isSelected,
  showDates,
  showPreviews,
  showImages,
  onSelect,
  onContextMenu,
  onReorder
}) => {
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | null>(null);

  const dateStr = note.modified
    ? new Date(note.modified).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })
    : '';

  const hasImageThumbnail = showImages && Boolean(note.hasImage);

  return (
    <div
      className={`row ${isSelected ? 'sel' : ''}`}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/x-wrriter-note',
          JSON.stringify({ path: note.path, title: note.title })
        );
        e.dataTransfer.setData('text/plain', note.title);
        if ((window as any).wrriter?.note?.startDrag) {
          void (window as any).wrriter.note.startDrag({ path: note.path });
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-wrriter-note')) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const isTop = e.clientY - rect.top < rect.height / 2;
          setDropIndicator(isTop ? 'top' : 'bottom');
        }
      }}
      onDragLeave={() => {
        setDropIndicator(null);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('application/x-wrriter-note')) {
          e.preventDefault();
          e.stopPropagation();
          const pos = dropIndicator ?? 'before';
          setDropIndicator(null);
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/x-wrriter-note'));
            if (data.path && data.path !== note.path && onReorder) {
              onReorder(data.path, note.path, pos === 'top' ? 'before' : 'after');
            }
          } catch {
            // Ignore invalid drag payload
          }
        }
      }}
      onClick={(e) => onSelect(e)}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onSelect(e);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, note)}
      style={{
        height: 80,
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        borderTop: dropIndicator === 'top' ? '2px solid var(--acc)' : undefined,
        borderBottom: dropIndicator === 'bottom' ? '2px solid var(--acc)' : undefined
      }}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
    >
      <div className="rtx">
        {/* Title line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {note.pinned && (
            <PinIcon
              style={{
                width: 14,
                height: 14,
                flex: 'none',
                color: isSelected ? 'var(--pick-1)' : 'var(--tx3)'
              }}
            />
          )}
          <span className="t1" style={{ flex: 1 }}>
            {note.title || 'Untitled Note'}
          </span>
        </div>

        {/* Date line */}
        {showDates && (
          <span className="dt">
            {dateStr}
          </span>
        )}

        {/* Preview line */}
        {showPreviews && (
          <span className="pv">
            {note.preview || 'No preview text'}
          </span>
        )}
      </div>

      {/* 48px square thumbnail on right if image present */}
      {hasImageThumbnail && (
        <div className="thumb">
          {note.imageSrc ? (
            <img
              src={resolveThumbnailSrc(note.imageSrc)}
              alt=""
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 'inherit',
                display: 'block'
              }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(180deg, var(--sk1), var(--sk2))',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--tx3)' }}>IMG</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
