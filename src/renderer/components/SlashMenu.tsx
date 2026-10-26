import React, { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import type { SlashMenuState } from '../editor/extensions/slash-menu';
import type { SlashMenuItem } from '../editor/extensions/slash-menu-items';
import {
  SlashHeadingIcon,
  SlashSubheadingIcon,
  SlashQuoteIcon,
  BulletListIcon,
  SlashNumberedListIcon,
  SlashTaskListIcon,
  SlashTableIcon,
  SlashCodeIcon,
  SlashCalloutIcon,
  CalloutWarnIcon,
  SlashDividerIcon,
  SlashImageIcon
} from './icons';

export interface SlashMenuProps {
  editor: Editor | null;
  menuState: SlashMenuState | null;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  editor,
  menuState,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  if (!menuState || !menuState.isOpen || !editor) {
    return null;
  }

  const { filterResult, selectedIndex, coords } = menuState;
  const { items, activeGroups, hasMatches } = filterResult;

  const handleSelectItem = (item: SlashMenuItem) => {
    // Delete slash and query text
    const { state } = editor.view;
    const $from = state.selection.$from;
    const start = $from.start();
    const end = $from.end();
    editor.view.dispatch(state.tr.delete(start, end));

    // Execute insertion
    item.action(editor);
    onClose();
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'SlashHeadingIcon':
        return <SlashHeadingIcon />;
      case 'SlashSubheadingIcon':
        return <SlashSubheadingIcon />;
      case 'SlashQuoteIcon':
        return <SlashQuoteIcon />;
      case 'BulletListIcon':
        return <BulletListIcon />;
      case 'SlashNumberedListIcon':
        return <SlashNumberedListIcon />;
      case 'SlashTaskListIcon':
        return <SlashTaskListIcon />;
      case 'SlashTableIcon':
        return <SlashTableIcon />;
      case 'SlashCodeIcon':
        return <SlashCodeIcon />;
      case 'SlashCalloutIcon':
        return <SlashCalloutIcon />;
      case 'CalloutWarnIcon':
        return <CalloutWarnIcon />;
      case 'SlashDividerIcon':
        return <SlashDividerIcon />;
      case 'SlashImageIcon':
        return <SlashImageIcon />;
      default:
        return <SlashHeadingIcon />;
    }
  };

  const flipAbove = coords?.flipAbove ?? false;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(coords?.left ?? 100, window.innerWidth - 360)),
    ...(flipAbove
      ? { bottom: window.innerHeight - (coords?.top ?? 0) + 8 }
      : { top: (coords?.bottom ?? 0) + 8 }),
    zIndex: 1000
  };

  return (
    <div
      ref={containerRef}
      className={`sm ${flipAbove ? 'flip-above' : ''}`}
      style={style}
      role="menu"
      aria-label="Insert blocks"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sml">
        {!hasMatches ? (
          <div className="smo">Nothing matches that</div>
        ) : (
          activeGroups.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group} className="sm-group">
                <div className="smg">{group}</div>
                {groupItems.map((item) => {
                  const globalIdx = items.indexOf(item);
                  const isSelected = globalIdx === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`smi ${isSelected ? 'sel' : ''}`}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => {
                        // hover updates selection
                      }}
                      role="menuitem"
                      aria-selected={isSelected}
                    >
                      <div className="smt">{renderIcon(item.iconName)}</div>
                      <div className="smx">
                        <span className="smn">{item.title}</span>
                        <span className="smd">{item.description}</span>
                      </div>
                      {item.shortcut && <span className="smk">{item.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="smf">
        <span>↑↓ to navigate</span>
        <span>↵ to insert</span>
        <span>Esc to close</span>
      </div>
    </div>
  );
};
