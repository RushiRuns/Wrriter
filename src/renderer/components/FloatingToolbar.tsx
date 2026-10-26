import React, { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import type { FloatingToolbarState } from '../editor/extensions/floating-toolbar';
import {
  ChevronDownIcon,
  BulletListIcon,
  LinkIcon,
  MoreFloatingIcon
} from './icons';

export interface FloatingToolbarProps {
  editor: Editor | null;
  toolbarState: FloatingToolbarState | null;
  onClose: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editor,
  toolbarState,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'block' | 'list' | 'more' | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!toolbarState || !toolbarState.isVisible || !toolbarState.coords || !editor) {
    return null;
  }

  const { coords, isBold, isItalic, isStrike, isCode, isLink, currentBlockType, currentListType } = toolbarState;

  const getBlockTypeLabel = () => {
    switch (currentBlockType) {
      case 'h1':
        return 'Heading 1';
      case 'h2':
        return 'Heading 2';
      case 'h3':
        return 'Heading 3';
      case 'blockquote':
        return 'Quote';
      case 'codeBlock':
        return 'Code';
      default:
        return 'Text';
    }
  };

  const handleSetBlockType = (type: string) => {
    setActiveDropdown(null);
    if (!editor) return;

    const chain = editor.chain().focus() as any;
    if (type === 'paragraph') {
      chain.setParagraph().run();
    } else if (type === 'h1') {
      chain.setHeading({ level: 1 }).run();
    } else if (type === 'h2') {
      chain.setHeading({ level: 2 }).run();
    } else if (type === 'h3') {
      chain.setHeading({ level: 3 }).run();
    } else if (type === 'blockquote') {
      chain.toggleBlockquote().run();
    } else if (type === 'codeBlock') {
      chain.toggleCodeBlock().run();
    }
  };

  const handleSetListType = (type: string) => {
    setActiveDropdown(null);
    if (!editor) return;

    const chain = editor.chain().focus() as any;
    if (type === 'bulletList') {
      chain.toggleBulletList().run();
    } else if (type === 'orderedList') {
      chain.toggleOrderedList().run();
    } else if (type === 'taskList') {
      chain.toggleTaskList().run();
    } else if (type === 'none') {
      if (currentListType === 'bulletList') chain.toggleBulletList().run();
      else if (currentListType === 'orderedList') chain.toggleOrderedList().run();
      else if (currentListType === 'taskList') chain.toggleTaskList().run();
    }
  };

  const handleToggleBold = () => {
    (editor.chain().focus() as any).toggleBold().run();
  };

  const handleToggleItalic = () => {
    (editor.chain().focus() as any).toggleItalic().run();
  };

  const handleToggleStrike = () => {
    (editor.chain().focus() as any).toggleStrike().run();
  };

  const handleToggleLink = () => {
    if (isLink) {
      (editor.chain().focus() as any).unsetLink().run();
    } else {
      const url = window.prompt('Enter link URL:');
      if (url) {
        (editor.chain().focus() as any).setLink({ href: url }).run();
      }
    }
  };

  const handleToggleCode = () => {
    setActiveDropdown(null);
    (editor.chain().focus() as any).toggleCode().run();
  };

  const handleClearFormatting = () => {
    setActiveDropdown(null);
    (editor.chain().focus() as any).unsetAllMarks().clearNodes().run();
  };

  return (
    <div
      ref={containerRef}
      className="ftb"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 1000
      }}
      role="toolbar"
      aria-label="Format selection"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Block type dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="ftb-btn"
          onClick={() => setActiveDropdown(activeDropdown === 'block' ? null : 'block')}
          title="Block type"
        >
          <span>{getBlockTypeLabel()}</span>
          <ChevronDownIcon />
        </button>

        {activeDropdown === 'block' && (
          <div className="ftb-dropdown" style={{ minWidth: 130 }}>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'paragraph' ? 'active' : ''}`} onClick={() => handleSetBlockType('paragraph')}>
              Text
            </button>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'h1' ? 'active' : ''}`} onClick={() => handleSetBlockType('h1')}>
              Heading 1
            </button>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'h2' ? 'active' : ''}`} onClick={() => handleSetBlockType('h2')}>
              Heading 2
            </button>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'h3' ? 'active' : ''}`} onClick={() => handleSetBlockType('h3')}>
              Heading 3
            </button>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'blockquote' ? 'active' : ''}`} onClick={() => handleSetBlockType('blockquote')}>
              Quote
            </button>
            <button type="button" className={`ftb-dd-item ${currentBlockType === 'codeBlock' ? 'active' : ''}`} onClick={() => handleSetBlockType('codeBlock')}>
              Code
            </button>
          </div>
        )}
      </div>

      {/* 2. List type dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`ftb-btn ${currentListType !== 'none' ? 'active' : ''}`}
          onClick={() => setActiveDropdown(activeDropdown === 'list' ? null : 'list')}
          title="List format"
        >
          <BulletListIcon />
          <ChevronDownIcon />
        </button>

        {activeDropdown === 'list' && (
          <div className="ftb-dropdown" style={{ minWidth: 140 }}>
            <button type="button" className={`ftb-dd-item ${currentListType === 'none' ? 'active' : ''}`} onClick={() => handleSetListType('none')}>
              None
            </button>
            <button type="button" className={`ftb-dd-item ${currentListType === 'bulletList' ? 'active' : ''}`} onClick={() => handleSetListType('bulletList')}>
              Bullet list
            </button>
            <button type="button" className={`ftb-dd-item ${currentListType === 'orderedList' ? 'active' : ''}`} onClick={() => handleSetListType('orderedList')}>
              Numbered list
            </button>
            <button type="button" className={`ftb-dd-item ${currentListType === 'taskList' ? 'active' : ''}`} onClick={() => handleSetListType('taskList')}>
              Task list
            </button>
          </div>
        )}
      </div>

      <div className="ftb-div" />

      {/* 4. Bold */}
      <button
        type="button"
        className={`ftb-btn ${isBold ? 'active' : ''}`}
        onClick={handleToggleBold}
        title="Bold (Ctrl+B)"
        style={{ fontWeight: 'var(--fw-bold)' }}
      >
        B
      </button>

      {/* 5. Italic */}
      <button
        type="button"
        className={`ftb-btn ${isItalic ? 'active' : ''}`}
        onClick={handleToggleItalic}
        title="Italic (Ctrl+I)"
        style={{ fontStyle: 'italic' }}
      >
        I
      </button>

      {/* 6. Strikethrough */}
      <button
        type="button"
        className={`ftb-btn ${isStrike ? 'active' : ''}`}
        onClick={handleToggleStrike}
        title="Strikethrough (Ctrl+Shift+X)"
        style={{ textDecoration: 'line-through' }}
      >
        S
      </button>

      {/* 7. Link */}
      <button
        type="button"
        className={`ftb-btn ${isLink ? 'active' : ''}`}
        onClick={handleToggleLink}
        title="Link (Ctrl+K)"
      >
        <LinkIcon />
      </button>

      <div className="ftb-div" />

      {/* 9. More */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="ftb-btn"
          onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
          title="More options"
        >
          <MoreFloatingIcon />
        </button>

        {activeDropdown === 'more' && (
          <div className="ftb-dropdown" style={{ minWidth: 140, right: 0, left: 'auto' }}>
            <button type="button" className={`ftb-dd-item ${isCode ? 'active' : ''}`} onClick={handleToggleCode}>
              Inline code
            </button>
            <button type="button" className="ftb-dd-item" onClick={handleClearFormatting}>
              Clear formatting
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
