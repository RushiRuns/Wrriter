import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorHost } from '../../editor/EditorHost';
import { PinIcon, PopOutIcon, CloseIcon } from '../../components/icons';
import { Notice } from '../../components/Notice';
import { subscribeThemeSync } from '../../motion';

export const CaptureWindow: React.FC = () => {
  // Query parameters from window creation
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') as 'quick-capture' | 'pop-out') || 'quick-capture';
  const initialPath = params.get('path') || '';
  const initialPinned = params.get('alwaysOnTop') !== 'false';
  const initialTheme = (params.get('theme') as 'light' | 'dark') || 'dark';
  const initialAccent = params.get('accent') || 'yellow';

  const [notePath, setNotePath] = useState(initialPath);
  const [displayTitle, setDisplayTitle] = useState(() => {
    if (initialPath) {
      const base = initialPath.replace(/\\/g, '/').split('/').pop() || '';
      return base.replace(/\.md$/i, '');
    }
    return mode === 'quick-capture' ? 'Quick note' : 'Pop-out note';
  });
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Entrance and exit animation state
  const [animateEntrance, setAnimateEntrance] = useState(true);
  const [isEntered, setIsEntered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notePathRef = useRef(notePath);
  notePathRef.current = notePath;

  // Initialize theme / accent attributes and subscribe to cross-window changes
  useEffect(() => {
    const doc = document.documentElement;
    doc.dataset.theme = initialTheme;
    doc.dataset.accent = initialAccent;
    return subscribeThemeSync((msg) => {
      if (msg.type === 'theme') {
        doc.dataset.theme = msg.value;
      } else if (msg.type === 'accent') {
        doc.dataset.accent = msg.value;
      }
    });
  }, [initialTheme, initialAccent]);

  // Entrance animation: 120 ms fade and 6 px rise (skipped if reduced motion or late)
  useEffect(() => {
    const mountTime = performance.now();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || document.documentElement.dataset.reducedMotion === 'true') {
      setAnimateEntrance(false);
      setIsEntered(true);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const elapsed = performance.now() - mountTime;
      if (elapsed > 32) {
        // Late first frame: skip animation
        setAnimateEntrance(false);
        setIsEntered(true);
      } else {
        setAnimateEntrance(true);
        requestAnimationFrame(() => {
          setIsEntered(true);
        });
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Escape key exit: Fast (100 ms) fade-out before window close
  const handleClose = useCallback(() => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
    }
    fadeOutTimerRef.current = setTimeout(() => {
      void window.wrriter?.window?.close();
    }, 100);
  }, [isFadingOut]);

  // Global keydown: Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if there is an active dialog or floating menu open first
        const openOverlays = document.querySelectorAll(
          '.wr-dialog, .sm, .floating-toolbar, .lmenu'
        );
        if (openOverlays.length > 0) {
          // Let overlay close itself
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Hotkey re-entrance during fade-out: cancels fade-out and restores window
  useEffect(() => {
    const handleReEnter = () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
      setIsFadingOut(false);
      setIsEntered(true);
    };

    window.addEventListener('wrriter:capture-reenter', handleReEnter);
    window.addEventListener('focus', handleReEnter);
    return () => {
      window.removeEventListener('wrriter:capture-reenter', handleReEnter);
      window.removeEventListener('focus', handleReEnter);
    };
  }, []);

  // Pin toggle
  const handleTogglePin = async () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    if (window.wrriter?.capture?.setAlwaysOnTop) {
      await window.wrriter.capture.setAlwaysOnTop({ alwaysOnTop: nextPinned });
    }
  };

  // Open in main window
  const handleOpenInMainWindow = async () => {
    const targetPath = notePathRef.current;
    if (window.wrriter?.capture?.openInMainWindow) {
      await window.wrriter.capture.openInMainWindow({ path: targetPath });
    }
  };

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div
      className="capture-window-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg)',
        color: 'var(--tx)',
        borderRadius: 16,
        boxShadow: 'inset 0 0 0 1px var(--div)',
        opacity: isFadingOut ? 0 : isEntered ? 1 : 0,
        transform: isFadingOut ? 'none' : isEntered ? 'translateY(0)' : 'translateY(6px)',
        transition: isFadingOut
          ? 'opacity var(--t-fast, 100ms) var(--ease-leave, cubic-bezier(.4, 0, 1, 1))'
          : animateEntrance
          ? 'opacity 120ms var(--ease-arrive, cubic-bezier(.16, 1, .3, 1)), transform 120ms var(--ease-arrive, cubic-bezier(.16, 1, .3, 1))'
          : 'none'
      }}
    >
      {/* Top Strip (Pin toggle, Title, Open in main window, Close) */}
      <div
        className="capture-top-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 38,
          padding: '0 var(--s-3)',
          borderBottom: '1px solid var(--div)',
          userSelect: 'none',
          ...dragStyle
        }}
      >
        {/* Left: Pin Toggle Button */}
        <div style={{ display: 'flex', alignItems: 'center', ...noDragStyle }}>
          <button
            type="button"
            className={`ib ${isPinned ? 'pinned' : ''}`}
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin from top' : 'Pin to top'}
            aria-label={isPinned ? 'Unpin from top' : 'Pin to top'}
            style={{
              width: 28,
              height: 28,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: isPinned ? 'var(--accent)' : 'var(--tx3)'
            }}
          >
            <PinIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Center: Title and mode pill */}
        <div
          className="capture-title-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s-2)',
            fontSize: 'var(--fs-small, 12px)',
            fontWeight: 500,
            color: 'var(--tx2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 130px)'
          }}
        >
          {mode === 'quick-capture' && (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 'var(--r-s, 4px)',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                backgroundColor: 'var(--bg-card, rgba(128,128,128,0.1))',
                color: 'var(--tx3)'
              }}
            >
              Capture
            </span>
          )}
          <span>{displayTitle}</span>
        </div>

        {/* Right: Open in main window & Close buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)', ...noDragStyle }}>
          <button
            type="button"
            className="ib"
            onClick={handleOpenInMainWindow}
            title="Open in main window"
            aria-label="Open in main window"
            style={{
              width: 28,
              height: 28,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: 'var(--tx3)'
            }}
          >
            <PopOutIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            type="button"
            className="ib"
            onClick={handleClose}
            title="Close (Escape)"
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: 'var(--tx3)'
            }}
          >
            <CloseIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <EditorHost
          activeNotePath={notePath || null}
          isQuickCapture={mode === 'quick-capture'}
          hideTabStrip={true}
          onTitleChange={(newTitle) => setDisplayTitle(newTitle)}
          onPathChange={(_oldPath, newPath) => {
            setNotePath(newPath);
            notePathRef.current = newPath;
          }}
          onNotice={(msg) => setNoticeMessage(msg)}
        />
      </div>

      {/* Notice Banner */}
      {noticeMessage && (
        <Notice message={noticeMessage} onDismiss={() => setNoticeMessage(null)} />
      )}
    </div>
  );
};
