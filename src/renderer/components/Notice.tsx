import React, { useEffect, useRef } from 'react';

export interface NoticeProps {
  message: string;
  type?: 'info' | 'error' | 'success';
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Notice component:
 * Appears in the bottom-right corner every time, overlaying content with no layout shift.
 * Uses design tokens and automatically dismisses after durationMs.
 */
export const Notice: React.FC<NoticeProps> = ({
  message,
  type = 'info',
  onDismiss,
  durationMs = 4000
}) => {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (durationMs <= 0) return;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message]);

  const typeBorderColor =
    type === 'error'
      ? 'var(--dgr)'
      : type === 'success'
      ? 'var(--ok)'
      : 'var(--accent)';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--tabs-h) + var(--s-4))',
        right: 'var(--s-4)',
        zIndex: 90,
        maxWidth: '360px',
        padding: 'var(--s-3) var(--s-4)',
        borderRadius: 'var(--r-s)',
        background: 'var(--pop)',
        color: 'var(--tx)',
        fontSize: 'var(--fs-small)',
        lineHeight: 'var(--lh-small)',
        boxShadow: '0 0 0 1px var(--line), var(--shadow)',
        borderLeft: `4px solid ${typeBorderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--s-3)',
        animation: 'vin var(--t-fast) var(--ease-arrive) both'
      }}
    >
      <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notice"
        style={{
          color: 'var(--tx3)',
          cursor: 'pointer',
          padding: '2px',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
