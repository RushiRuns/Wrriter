import React, { useState, useEffect, useRef } from 'react';
import { ChevronRightIcon } from '../icons';

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly shortcut?: string;
  readonly isDanger?: boolean;
  readonly isDisabled?: boolean;
  readonly isDivider?: boolean;
  readonly onClick?: () => void;
  readonly children?: readonly ContextMenuItem[];
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  onClose: () => void;
  menuId?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  items,
  onClose,
  menuId = 'context-menu'
}) => {
  const menuRef = useRef<HTMLUListElement | null>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [submenuPlacement, setSubmenuPlacement] = useState<{ id: string; openLeft: boolean; openUp: boolean } | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenuId(null);
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

    // Close any other open menu
    window.dispatchEvent(new CustomEvent('wrriter:close-all-menus', { detail: { except: menuId } }));

    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('contextmenu', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('contextmenu', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, menuId]);

  if (!isOpen) return null;

  // Clamp within viewport
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const estimatedHeight = items.reduce((acc, item) => acc + (item.isDivider ? 9 : 36), 16);
  const left = Math.max(8, Math.min(x, winWidth - 220));
  const top = Math.max(8, Math.min(y, winHeight - estimatedHeight - 8));

  const handleItemMouseEnter = (item: ContextMenuItem, e: React.MouseEvent<HTMLLIElement>) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (item.children && item.children.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const openLeft = rect.right + 210 > winWidth;
      const subEstHeight = item.children.length * 36 + 16;
      const openUp = rect.top + subEstHeight > winHeight;
      setSubmenuPlacement({ id: item.id, openLeft, openUp });
      setActiveSubmenuId(item.id);
    } else {
      setActiveSubmenuId(null);
    }
  };

  const handleItemMouseLeave = (item: ContextMenuItem) => {
    if (item.children && item.children.length > 0) {
      closeTimeoutRef.current = setTimeout(() => {
        setActiveSubmenuId(null);
      }, 150);
    }
  };

  const handleItemClickWithSubmenu = (item: ContextMenuItem, e: React.MouseEvent<HTMLLIElement>) => {
    if (activeSubmenuId === item.id) {
      setActiveSubmenuId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const openLeft = rect.right + 210 > winWidth;
      const subEstHeight = (item.children?.length ?? 0) * 36 + 16;
      const openUp = rect.top + subEstHeight > winHeight;
      setSubmenuPlacement({ id: item.id, openLeft, openUp });
      setActiveSubmenuId(item.id);
    }
  };

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
      onContextMenu={(e) => e.stopPropagation()}
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
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isSubmenuOpen = activeSubmenuId === item.id;

        return (
          <li
            key={item.id}
            className={`vi ${isDisabled ? 'disabled' : ''}`}
            role="menuitem"
            aria-disabled={isDisabled}
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-expanded={hasChildren ? isSubmenuOpen : undefined}
            style={{
              position: 'relative',
              cursor: isDisabled ? 'default' : 'pointer',
              height: 'var(--ctl)',
              padding: '0 var(--s-2)',
              borderRadius: 'var(--r-s)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              color: isDanger ? 'var(--dgr)' : isDisabled ? 'var(--tx3)' : 'var(--tx)',
              opacity: isDisabled ? 0.5 : 1,
              backgroundColor: isSubmenuOpen ? 'var(--line)' : undefined
            }}
            onMouseEnter={(e) => handleItemMouseEnter(item, e)}
            onMouseLeave={() => handleItemMouseLeave(item)}
            onClick={(e) => {
              if (isDisabled) return;
              if (hasChildren) {
                e.stopPropagation();
                handleItemClickWithSubmenu(item, e);
              } else {
                onClose();
                if (item.onClick) item.onClick();
              }
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
            {hasChildren && (
              <ChevronRightIcon
                style={{
                  marginLeft: 'auto',
                  width: 12,
                  height: 12,
                  opacity: 0.6
                }}
              />
            )}

            {/* Sub-flyout Menu */}
            {hasChildren && isSubmenuOpen && (
              <ul
                className="lmenu ctx"
                role="menu"
                aria-label={item.label}
                style={{
                  position: 'absolute',
                  top: submenuPlacement?.openUp ? 'auto' : 0,
                  bottom: submenuPlacement?.openUp ? 0 : 'auto',
                  left: submenuPlacement?.openLeft ? 'auto' : 'calc(100% + 4px)',
                  right: submenuPlacement?.openLeft ? 'calc(100% + 4px)' : 'auto',
                  minWidth: 180,
                  maxWidth: 260,
                  maxHeight: 'min(360px, calc(100vh - 32px))',
                  overflowY: 'auto',
                  zIndex: 1001,
                  listStyle: 'none',
                  margin: 0,
                  padding: 'var(--s-2)',
                  borderRadius: 'var(--r-l)',
                  background: 'var(--pop)',
                  boxShadow: '0 0 0 1px var(--line), var(--shadow)'
                }}
                onMouseEnter={() => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                    closeTimeoutRef.current = null;
                  }
                }}
                onMouseLeave={() => {
                  closeTimeoutRef.current = setTimeout(() => {
                    setActiveSubmenuId(null);
                  }, 150);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {item.children!.map((child, cIdx) => {
                  if (child.isDivider) {
                    return (
                      <li
                        key={`sub-div-${cIdx}`}
                        className="vmd"
                        style={{ height: 1, margin: 'var(--s-2) 0', backgroundColor: 'var(--line)' }}
                      />
                    );
                  }

                  const childDisabled = child.isDisabled ?? false;
                  const childDanger = child.isDanger ?? false;

                  return (
                    <li
                      key={child.id}
                      className={`vi ${childDisabled ? 'disabled' : ''}`}
                      role="menuitem"
                      aria-disabled={childDisabled}
                      style={{
                        cursor: childDisabled ? 'default' : 'pointer',
                        height: 'var(--ctl)',
                        padding: '0 var(--s-2)',
                        borderRadius: 'var(--r-s)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--s-3)',
                        color: childDanger ? 'var(--dgr)' : childDisabled ? 'var(--tx3)' : 'var(--tx)',
                        opacity: childDisabled ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (childDisabled) return;
                        onClose();
                        if (child.onClick) child.onClick();
                      }}
                    >
                      {child.icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{child.icon}</span>}
                      <span
                        className="vn"
                        style={{
                          color: childDanger ? 'var(--dgr)' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {child.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};
