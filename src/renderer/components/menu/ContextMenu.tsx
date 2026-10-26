import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly shortcut?: string;
  readonly isDanger?: boolean;
  readonly isDisabled?: boolean;
  readonly isDivider?: boolean;
  readonly onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  items,
  onClose
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
    window.dispatchEvent(new CustomEvent('wrriter:close-all-menus', { detail: { except: 'context-menu' } }));

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

  // Clamp within viewport
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - (items.length * 36 + 20));

  return (
    <ul
      ref={menuRef}
      className="lmenu ctx"
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: Math.max(8, top),
        minWidth: 200,
        zIndex: 1000,
        listStyle: 'none',
        margin: 0,
        padding: 'var(--s-2)',
        borderRadius: 'var(--r-l)',
        background: 'var(--pop)',
        boxShadow: '0 0 0 1px var(--line), var(--shadow)'
      }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => {
        if (item.isDivider) {
          return (
            <li
              key={`div-${idx}`}
              className="vmd"
              style={{ height: 1, margin: 'var(--s-2) 0', backgroundColor: 'var(--line)' }}
            />
          );
        }

        const isDanger = item.isDanger ?? false;
        const isDisabled = item.isDisabled ?? false;

        return (
          <li
            key={item.id}
            className={`vi ${isDisabled ? 'disabled' : ''}`}
            role="menuitem"
            aria-disabled={isDisabled}
            style={{
              cursor: isDisabled ? 'default' : 'pointer',
              height: 'var(--ctl)',
              padding: '0 var(--s-2)',
              borderRadius: 'var(--r-s)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              color: isDanger ? 'var(--dgr)' : isDisabled ? 'var(--tx3)' : 'var(--tx)',
              opacity: isDisabled ? 0.5 : 1
            }}
            onClick={() => {
              if (isDisabled) return;
              onClose();
              if (item.onClick) item.onClick();
            }}
          >
            {item.icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>}
            <span className="vn" style={{ color: isDanger ? 'var(--dgr)' : undefined }}>
              {item.label}
            </span>
            {item.shortcut && (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>
                {item.shortcut}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
