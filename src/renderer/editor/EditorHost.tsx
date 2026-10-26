import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { history, undo, redo } from '@tiptap/pm/history';
import { keymap } from '@tiptap/pm/keymap';
import {
  DocNode,
  ParagraphNode,
  TextNode,
  HeadingNode,
  CodeBlockNode,
  BlockquoteNode,
  BulletListNode,
  OrderedListNode,
  ListItemNode,
  TaskListNode,
  TaskItemNode,
  HorizontalRuleNode
} from './extensions/nodes';
import { BoldMark, ItalicMark, StrikeMark, CodeMark } from './extensions/marks';
import { MarkdownShortcutsExtension } from './extensions/markdown-shortcuts';
import { PasteHandlerExtension } from './extensions/paste-handler';
import { markdownToTipTapDoc, tipTapDocToMarkdown } from './markdown-converter';
import { planSave } from '../../shared/markdown/save';
import {
  extractTitleFromFirstLine,
  shouldRenameFileOnLeave,
  deriveFileNameFromTitle
} from '../../shared/domain/titles';

export interface TabSession {
  readonly path: string;
  title: string;
  editorState: EditorState | null;
  scrollTop: number;
  isDirty: boolean;
  originalBytes: Uint8Array;
  initialFileName: string;
  initialTitle: string;
  isManualRenamed?: boolean;
}

export interface EditorHostProps {
  activeNotePath: string | null;
  noteMargin?: number;
  onTitleChange?: (newTitle: string) => void;
  onNotice?: (message: string) => void;
  onPathChange?: (oldPath: string, newPath: string) => void;
  onSelectTab?: (path: string | null) => void;
  onTabsUpdate?: (tabs: readonly TabSession[], activePath: string | null) => void;
}

export const EditorHost: React.FC<EditorHostProps> = ({
  activeNotePath,
  noteMargin = 24,
  onTitleChange,
  onNotice,
  onPathChange,
  onSelectTab,
  onTabsUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  // Tab sessions kept in memory (active & hidden tabs)
  const tabsRef = useRef<Map<string, TabSession>>(new Map());
  const activePathRef = useRef<string | null>(activeNotePath);
  activePathRef.current = activeNotePath;

  const [activeTabPath, setActiveTabPath] = useState<string | null>(activeNotePath);
  const [tabsList, setTabsList] = useState<readonly TabSession[]>([]);

  // Autosave timer
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to notify parent about tabs state
  const notifyTabs = useCallback(() => {
    const list = Array.from(tabsRef.current.values());
    setTabsList(list);
    onTabsUpdate?.(list, activePathRef.current);
  }, [onTabsUpdate]);

  // Saves a tab session using planSave and SafeWriter
  const saveTabSession = useCallback(
    async (tab: TabSession, retryCount = 0): Promise<boolean> => {
      if (!tab.editorState) return true;

      const docJson = tab.editorState.doc.toJSON();
      const currentMarkdown = tipTapDocToMarkdown(docJson as any);

      const plan = planSave(tab.originalBytes, currentMarkdown);

      if (plan.unchanged) {
        tab.isDirty = false;
        return true;
      }

      if (window.wrriter?.note?.save) {
        const res = await window.wrriter.note.save({
          path: tab.path,
          text: plan.text
        });

        if (res.ok) {
          tab.originalBytes = plan.bytes;
          tab.isDirty = false;
          return true;
        } else {
          // Keep text in tab, show notice and retry if locked
          onNotice?.('Save paused: another program is holding this file. Retrying...');
          if (retryCount < 3) {
            setTimeout(() => {
              void saveTabSession(tab, retryCount + 1);
            }, 1000 * Math.pow(2, retryCount));
          }
          return false;
        }
      }

      return true;
    },
    [onNotice]
  );

  // Checks and executes title-based file rename on leaving note
  const checkRenameOnLeave = useCallback(
    async (tab: TabSession): Promise<void> => {
      if (!tab.editorState) return;

      const firstLine = tab.editorState.doc.firstChild?.textContent ?? '';
      const newTitle = extractTitleFromFirstLine(firstLine);

      if (
        shouldRenameFileOnLeave({
          initialFileName: tab.initialFileName,
          initialTitle: tab.initialTitle,
          currentTitle: newTitle,
          isManualRenamed: tab.isManualRenamed
        })
      ) {
        const folder = tab.path.includes('/') ? tab.path.slice(0, tab.path.lastIndexOf('/')) : '';
        const newFileName = deriveFileNameFromTitle(newTitle);
        const newPath = folder ? `${folder}/${newFileName}` : newFileName;

        if (window.wrriter?.folder?.rename) {
          const res = await window.wrriter.folder.rename({
            oldPath: tab.path,
            newPath
          });

          if (res.ok) {
            const oldPath = tab.path;
            tabsRef.current.delete(oldPath);
            const updatedTab: TabSession = {
              ...tab,
              path: newPath,
              title: newTitle,
              initialFileName: newFileName,
              initialTitle: newTitle
            };
            tabsRef.current.set(newPath, updatedTab);
            onPathChange?.(oldPath, newPath);
            onTitleChange?.(newTitle);
            notifyTabs();
          }
        }
      }
    },
    [onPathChange, onTitleChange, notifyTabs]
  );

  // Initialize the single live TipTap editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new Editor({
      element: containerRef.current,
      extensions: [
        DocNode,
        ParagraphNode,
        TextNode,
        HeadingNode,
        CodeBlockNode,
        BlockquoteNode,
        BulletListNode,
        OrderedListNode,
        ListItemNode,
        TaskListNode,
        TaskItemNode,
        HorizontalRuleNode,
        BoldMark,
        ItalicMark,
        StrikeMark,
        CodeMark,
        MarkdownShortcutsExtension,
        PasteHandlerExtension
      ],
      editorProps: {
        attributes: {
          class: 'wrriter-prosemirror',
          spellcheck: 'true',
          lang: 'en'
        }
      },
      onUpdate({ editor: currentEditor }) {
        const currentPath = activePathRef.current;
        if (!currentPath) return;

        const tab = tabsRef.current.get(currentPath);
        if (tab) {
          tab.editorState = currentEditor.state;
          tab.isDirty = true;

          // Live title update
          const firstLine = currentEditor.state.doc.firstChild?.textContent ?? '';
          const currentTitle = extractTitleFromFirstLine(firstLine) || tab.title;
          if (currentTitle !== tab.title) {
            tab.title = currentTitle;
            onTitleChange?.(currentTitle);
            notifyTabs();
          }

          // Debounced typing autosave (1 second pause)
          if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
          }
          autosaveTimeoutRef.current = setTimeout(() => {
            void saveTabSession(tab);
          }, 1000);
        }
      }
    });

    editorRef.current = editor;

    // Flush saves on window unload / quit
    const handleBeforeUnload = () => {
      for (const tab of tabsRef.current.values()) {
        if (tab.isDirty) {
          void saveTabSession(tab);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      editor.destroy();
      editorRef.current = null;
    };
  }, [saveTabSession, onTitleChange, notifyTabs]);

  // Handle activeNotePath changes (load, switch tabs, save previous)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeNotePath) return;

    const switchNote = async () => {
      const prevPath = activeTabPath;

      // 1. Save and remember previous tab state
      if (prevPath && prevPath !== activeNotePath) {
        const prevTab = tabsRef.current.get(prevPath);
        if (prevTab) {
          prevTab.editorState = editor.state;
          if (scrollRef.current) {
            prevTab.scrollTop = scrollRef.current.scrollTop;
          }
          if (prevTab.isDirty) {
            await saveTabSession(prevTab);
          }
          await checkRenameOnLeave(prevTab);
        }
      }

      // 2. Check if destination tab already exists in memory
      let targetTab = tabsRef.current.get(activeNotePath);

      if (!targetTab) {
        let rawText = '';
        let originalBytes = new Uint8Array(0);
        const fileName = activeNotePath.split('/').pop() ?? activeNotePath;
        const initialBase = fileName.replace(/\.md$/i, '');
        let title = initialBase;

        if (window.wrriter?.note?.read) {
          const res = await window.wrriter.note.read({ path: activeNotePath });
          if (res.ok) {
            rawText = res.value.text;
            originalBytes = new Uint8Array(res.value.bytes);
            const firstLine = rawText.split(/\r?\n/)[0];
            title = extractTitleFromFirstLine(firstLine) || initialBase;
          }
        }

        const docJson = markdownToTipTapDoc(rawText);
        targetTab = {
          path: activeNotePath,
          title,
          editorState: null,
          scrollTop: 0,
          isDirty: false,
          originalBytes,
          initialFileName: fileName,
          initialTitle: title
        };
        tabsRef.current.set(activeNotePath, targetTab);

        // Set content in live editor
        editor.commands.setContent(docJson as any, { emitUpdate: false });
        targetTab.editorState = editor.state;
        onTitleChange?.(title);
      } else if (targetTab.editorState) {
        // Swap EditorState in O(1) time without re-mounting editor DOM
        editor.view.updateState(targetTab.editorState);
        onTitleChange?.(targetTab.title);
      }

      // Restore scroll position
      if (scrollRef.current && targetTab) {
        scrollRef.current.scrollTop = targetTab.scrollTop;
      }

      setActiveTabPath(activeNotePath);
      notifyTabs();
    };

    void switchNote();
  }, [activeNotePath, activeTabPath, saveTabSession, checkRenameOnLeave, onTitleChange, notifyTabs]);

  // Outside changes handler (quiet reload if clean; save (External).md if dirty; notify if deleted)
  const checkExternalChanges = useCallback(async () => {
    for (const tab of tabsRef.current.values()) {
      if (!window.wrriter?.note?.read) continue;
      const res = await window.wrriter.note.read({ path: tab.path });
      if (!res.ok) {
        if (tab.originalBytes.length > 0 && !(tab as any)._deletedNotified) {
          (tab as any)._deletedNotified = true;
          onNotice?.(`"${tab.title}" was moved or deleted outside Wrriter. Your text is kept in the tab.`);
        }
        continue;
      }

      const diskBytes = new Uint8Array(res.value.bytes);
      const isDifferent =
        diskBytes.length !== tab.originalBytes.length ||
        diskBytes.some((byte, idx) => byte !== tab.originalBytes[idx]);

      if (isDifferent) {
        if (!tab.isDirty) {
          tab.originalBytes = diskBytes;
          const newText = res.value.text;
          const docJson = markdownToTipTapDoc(newText);
          if (editorRef.current && tab.path === activePathRef.current) {
            const currentSelection = editorRef.current.state.selection;
            editorRef.current.commands.setContent(docJson as any, { emitUpdate: false });
            try {
              const maxPos = editorRef.current.state.doc.content.size;
              const from = Math.min(currentSelection.from, maxPos);
              const to = Math.min(currentSelection.to, maxPos);
              editorRef.current.commands.setTextSelection({ from, to });
            } catch {}
          } else {
            tab.editorState = null;
          }
        } else {
          const dir = tab.path.includes('/') ? tab.path.slice(0, tab.path.lastIndexOf('/')) : '';
          const baseName = tab.initialFileName.replace(/\.md$/i, '');
          const externalName = `${baseName} (External).md`;
          const externalPath = dir ? `${dir}/${externalName}` : externalName;

          if (window.wrriter?.note?.save) {
            await window.wrriter.note.save({
              path: externalPath,
              text: res.value.text
            });
            onNotice?.(`"${tab.title}" was edited outside Wrriter. External version saved as ${externalName}.`);
          }
          tab.originalBytes = diskBytes;
        }
      }
    }
  }, [onNotice]);

  useEffect(() => {
    const handleFocus = () => {
      void checkExternalChanges();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      void checkExternalChanges();
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkExternalChanges]);

  // Tab switching handler
  const handleSelectTab = (path: string) => {
    setActiveTabPath(path);
    activePathRef.current = path;
    onSelectTab?.(path);
  };

  // Close tab handler
  const handleCloseTab = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const tab = tabsRef.current.get(path);
    if (tab) {
      if (tab.isDirty) {
        await saveTabSession(tab);
      }
      await checkRenameOnLeave(tab);
      tabsRef.current.delete(path);

      if (activeTabPath === path) {
        const remaining = Array.from(tabsRef.current.keys());
        const next = remaining[remaining.length - 1] ?? null;
        setActiveTabPath(next);
        activePathRef.current = next;
        onSelectTab?.(next);
      }
      notifyTabs();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative'
      }}
    >
      {/* Scrollable Note Content Column */}
      <div
        ref={scrollRef}
        className="edscroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          paddingBottom: 48
        }}
      >
        <div
          className="col"
          style={{
            paddingLeft: noteMargin,
            paddingRight: noteMargin,
            minWidth: 360,
            paddingTop: 40
          }}
        >
          {/* TipTap Live Editor DOM Container */}
          <div ref={containerRef} className="editor-container" />
        </div>
      </div>

      {/* 32px TabStrip along the bottom of the editor pane */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 'var(--tab-h, 32px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderTop: '1px solid var(--div)',
          backgroundColor: 'var(--ed)',
          gap: 6,
          overflowX: 'auto',
          zIndex: 10
        }}
      >
        {tabsList.map((tab) => {
          const isActive = tab.path === activeTabPath;
          return (
            <div
              key={tab.path}
              className={`tab ${isActive ? 'on' : ''}`}
              onClick={() => handleSelectTab(tab.path)}
              style={{
                height: 24,
                padding: '0 8px 0 10px',
                borderRadius: 6,
                fontSize: 'var(--fs-small)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: isActive ? 'var(--tx)' : 'var(--tx2)',
                backgroundColor: isActive
                  ? 'color-mix(in srgb, var(--tx) 8%, transparent)'
                  : 'transparent',
                border: '1px solid transparent',
                userSelect: 'none',
                maxWidth: 180,
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
              <button
                type="button"
                onClick={(e) => void handleCloseTab(e, tab.path)}
                title="Close tab (Ctrl+W)"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 12
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
