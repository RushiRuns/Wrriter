import React, { useEffect, useRef } from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
}

/**
 * Universal Dialog component adhering to the palette motion:
 * 16 px corners, var(--pop) background, 1px var(--line) border,
 * soft shadow, and Fast 100 ms Arrive curve.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 440
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="wr-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="wr-dialog"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {title && <h2 className="wr-dialog-title">{title}</h2>}
        <div className="wr-dialog-content">{children}</div>
      </div>
    </div>
  );
};
