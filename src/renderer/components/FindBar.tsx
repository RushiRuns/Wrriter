import React, { useRef, useEffect } from 'react';

export interface FindBarProps {
  isOpen: boolean;
  isReplaceOpen: boolean;
  searchTerm: string;
  replaceText: string;
  matchCase: boolean;
  wholeWord: boolean;
  currentIndex: number;
  totalMatches: number;
  skippedMatches: number;
  onSearchChange: (term: string) => void;
  onReplaceChange: (replacement: string) => void;
  onToggleMatchCase: () => void;
  onToggleWholeWord: () => void;
  onToggleReplace: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export const FindBar: React.FC<FindBarProps> = ({
  isOpen,
  isReplaceOpen,
  searchTerm,
  replaceText,
  matchCase,
  wholeWord,
  currentIndex,
  totalMatches,
  skippedMatches,
  onSearchChange,
  onReplaceChange,
  onToggleMatchCase,
  onToggleWholeWord,
  onToggleReplace,
  onNext,
  onPrev,
  onReplaceCurrent,
  onReplaceAll,
  onClose
}) => {
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when opened
  useEffect(() => {
    if (isOpen) {
      if (isReplaceOpen && replaceInputRef.current && searchTerm) {
        replaceInputRef.current.focus();
        replaceInputRef.current.select();
      } else if (findInputRef.current) {
        findInputRef.current.focus();
        findInputRef.current.select();
      }
    }
  }, [isOpen, isReplaceOpen]);

  if (!isOpen) return null;

  const countLabel = (() => {
    if (!searchTerm) return '';
    if (totalMatches === 0) return '0 of 0';
    return `${currentIndex + 1} of ${totalMatches}`;
  })();

  return (
    <div
      role="search"
      aria-label="Find and replace in note"
      className="wr-find-bar"
      style={{
        position: 'absolute',
        top: 12,
        right: 24,
        zIndex: 50,
        backgroundColor: 'var(--pop)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow)',
        borderRadius: 'var(--r-m)',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 350,
        maxWidth: 480
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* 1. Find Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Toggle Replace disclosure arrow */}
        <button
          type="button"
          onClick={onToggleReplace}
          title={isReplaceOpen ? 'Hide replace' : 'Show replace (Ctrl+H)'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--tx2)',
            transform: isReplaceOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--t-fast) var(--ease-move)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Find Input */}
        <input
          ref={findInputRef}
          type="text"
          placeholder="Find"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) {
                onPrev();
              } else {
                onNext();
              }
            } else if (e.key === 'F3') {
              e.preventDefault();
              if (e.shiftKey) {
                onPrev();
              } else {
                onNext();
              }
            }
          }}
          style={{
            flex: 1,
            height: 26,
            padding: '0 8px',
            fontSize: 'var(--fs-ui)',
            backgroundColor: 'var(--ed)',
            border: '1px solid var(--div)',
            borderRadius: 6,
            color: 'var(--tx)',
            outline: 'none'
          }}
        />

        {/* Match Count */}
        {countLabel && (
          <span
            style={{
              fontSize: 'var(--fs-small)',
              color: 'var(--tx2)',
              whiteSpace: 'nowrap',
              userSelect: 'none'
            }}
          >
            {countLabel}
            {skippedMatches > 0 ? ` (${skippedMatches} skipped)` : ''}
          </span>
        )}

        {/* Previous Match Button */}
        <button
          type="button"
          onClick={onPrev}
          title="Previous match (Shift+Enter, Shift+F3)"
          disabled={totalMatches === 0}
          style={{
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 4,
            cursor: totalMatches > 0 ? 'pointer' : 'default',
            opacity: totalMatches > 0 ? 1 : 0.4,
            color: 'var(--tx2)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Next Match Button */}
        <button
          type="button"
          onClick={onNext}
          title="Next match (Enter, F3)"
          disabled={totalMatches === 0}
          style={{
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 4,
            cursor: totalMatches > 0 ? 'pointer' : 'default',
            opacity: totalMatches > 0 ? 1 : 0.4,
            color: 'var(--tx2)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Match Case Toggle (Aa) */}
        <button
          type="button"
          onClick={onToggleMatchCase}
          title="Match case"
          style={{
            height: 24,
            padding: '0 6px',
            fontSize: 'var(--fs-small)',
            fontWeight: 600,
            borderRadius: 4,
            cursor: 'pointer',
            border: matchCase ? '1px solid var(--accent)' : '1px solid transparent',
            backgroundColor: matchCase
              ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
              : 'transparent',
            color: matchCase ? 'var(--accent)' : 'var(--tx2)'
          }}
        >
          Aa
        </button>

        {/* Whole Word Toggle (\b) */}
        <button
          type="button"
          onClick={onToggleWholeWord}
          title="Whole word"
          style={{
            height: 24,
            padding: '0 6px',
            fontSize: 'var(--fs-small)',
            fontWeight: 600,
            borderRadius: 4,
            cursor: 'pointer',
            border: wholeWord ? '1px solid var(--accent)' : '1px solid transparent',
            backgroundColor: wholeWord
              ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
              : 'transparent',
            color: wholeWord ? 'var(--accent)' : 'var(--tx2)'
          }}
        >
          \b
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          title="Close (Escape)"
          style={{
            width: 24,
            height: 24,
            display: 'grid',
            placeItems: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--tx2)',
            fontSize: 16
          }}
        >
          ×
        </button>
      </div>

      {/* 2. Replace Row */}
      {isReplaceOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 18 }}>
          <input
            ref={replaceInputRef}
            type="text"
            placeholder="Replace"
            value={replaceText}
            onChange={(e) => onReplaceChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onReplaceCurrent();
              }
            }}
            style={{
              flex: 1,
              height: 26,
              padding: '0 8px',
              fontSize: 'var(--fs-ui)',
              backgroundColor: 'var(--ed)',
              border: '1px solid var(--div)',
              borderRadius: 6,
              color: 'var(--tx)',
              outline: 'none'
            }}
          />

          <button
            type="button"
            onClick={onReplaceCurrent}
            disabled={totalMatches === 0}
            title="Replace current match"
            style={{
              height: 24,
              padding: '0 8px',
              fontSize: 'var(--fs-small)',
              borderRadius: 4,
              border: '1px solid var(--div)',
              backgroundColor: 'var(--ed)',
              color: 'var(--tx)',
              cursor: totalMatches > 0 ? 'pointer' : 'default',
              opacity: totalMatches > 0 ? 1 : 0.5
            }}
          >
            Replace
          </button>

          <button
            type="button"
            onClick={onReplaceAll}
            disabled={totalMatches === 0}
            title="Replace all in one undo step"
            style={{
              height: 24,
              padding: '0 8px',
              fontSize: 'var(--fs-small)',
              fontWeight: 500,
              borderRadius: 4,
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'var(--onacc)',
              cursor: totalMatches > 0 ? 'pointer' : 'default',
              opacity: totalMatches > 0 ? 1 : 0.5
            }}
          >
            Replace all
          </button>
        </div>
      )}
    </div>
  );
};
