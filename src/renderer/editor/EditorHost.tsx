import React, { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Extension } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import { EditorState, Plugin as ProseMirrorPlugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
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
import { CalloutNode } from './extensions/callout';
import { TableNode, TableRowNode, TableHeaderNode, TableCellNode } from './extensions/table';
import { ImageNode } from './extensions/image';
import { FileChipNode } from './extensions/file-chip';
import { WikilinkMark, WebLinkMark } from './extensions/links';
import { MarkdownShortcutsExtension } from './extensions/markdown-shortcuts';
import { PasteHandlerExtension } from './extensions/paste-handler';
import { FindReplaceExtension, findReplacePluginKey } from './extensions/find-replace-extension';
import { HeadingFoldingExtension, headingFoldingPluginKey } from './extensions/heading-folding';
import { KeyboardMoveExtension } from './extensions/keyboard-move';
import { BlockHandlesExtension } from './extensions/block-handles';
import { BlockDragExtension } from './extensions/block-drag';
import { SlashMenuExtension, type SlashMenuState } from './extensions/slash-menu';
import { SLASH_MENU_ITEMS } from './extensions/slash-menu-items';
import { FloatingToolbarExtension, type FloatingToolbarState } from './extensions/floating-toolbar';
import { TypingTouchesExtension } from './extensions/typing-touches';
import { FindBar } from '../components/FindBar';
import { SlashMenu } from '../components/SlashMenu';
import { WikilinkSuggest } from '../components/WikilinkSuggest';
import { FloatingToolbar } from '../components/FloatingToolbar';
import { ContextMenu } from '../components/menu/ContextMenu';
import { TabStrip } from '../components/TabStrip';
import { markdownToTipTapDoc, tipTapDocToMarkdown } from './markdown-converter';
import { planSave, encodeUtf8 } from '../../shared/markdown/save';
import { parseFrontmatter, updateFrontmatter, formatCreatedDate } from '../../shared/domain/frontmatter';
import { parseTagsInput } from '../../shared/domain/tags';
import { resolveLink } from '../../shared/domain/links';
import { WikilinkSuggestExtension, type WikilinkSuggestState } from './extensions/wikilink-suggest';
import { PropertiesLineExtension, propertiesLinePluginKey } from './extensions/properties-line';
import { Dialog } from '../components/Dialog';
import type { BacklinkRecord } from '../../shared/ipc/contracts';
import {
  extractTitleFromFirstLine,
  shouldRenameFileOnLeave,
  deriveFileNameFromTitle,
  extractNotePreviewAndImage
} from '../../shared/domain/titles';

export function formatNoteDate(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hours}:${minutes}`;
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface FindBarState {
  isOpen: boolean;
  isReplaceOpen: boolean;
  searchTerm: string;
  replaceText: string;
  matchCase: boolean;
  wholeWord: boolean;
  activeIndex: number;
}

// Session memory persists last search term and toggles until Wrriter closes
const sessionFindMemory = {
  searchTerm: '',
  replaceText: '',
  matchCase: false,
  wholeWord: false
};

export interface TabSession {
  readonly path: string;
  title: string;
  editorState: EditorState | null;
  scrollTop: number;
  isDirty: boolean;
  originalBytes: Uint8Array;
  lastSavedText?: string;
  initialFileName: string;
  initialTitle: string;
  isManualRenamed?: boolean;
  findBarState?: FindBarState;
  dateLine?: string;
  tags?: readonly string[];
  status?: string | null;
  created?: string | null;
  frontmatterRaw?: string;
  isBrokenFrontmatter?: boolean;
  savedSelection?: { from: number; to: number };
}

export interface EditorHostProps {
  activeNotePath: string | null;
  noteMargin?: number;
  availableNotes?: readonly { path: string; title: string; modified: number }[];
  onTitleChange?: (newTitle: string) => void;
  onNotice?: (message: string) => void;
  onPathChange?: (oldPath: string, newPath: string) => void;
  onSelectTab?: (path: string | null) => void;
  onTabsUpdate?: (tabs: readonly TabSession[], activePath: string | null) => void;
  onNoteSummaryChange?: (summary: { path: string; title: string; preview: string; hasImage: boolean; imageSrc?: string | undefined }) => void;
  onFollowLink?: (target: string, isNewTab: boolean) => void;
}

export const EditorHost: React.FC<EditorHostProps> = ({
  activeNotePath,
  noteMargin = 24,
  availableNotes,
  onTitleChange,
  onNotice,
  onPathChange,
  onSelectTab,
  onTabsUpdate,
  onNoteSummaryChange,
  onFollowLink
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  // Stable callback refs to isolate effect/useCallback dependencies from parent re-renders
  const availableNotesRef = useRef(availableNotes ?? []);
  availableNotesRef.current = availableNotes ?? [];
  const onFollowLinkRef = useRef(onFollowLink);
  onFollowLinkRef.current = onFollowLink;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;
  const onNoteSummaryChangeRef = useRef(onNoteSummaryChange);
  onNoteSummaryChangeRef.current = onNoteSummaryChange;
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;
  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;
  const onSelectTabRef = useRef(onSelectTab);
  onSelectTabRef.current = onSelectTab;
  const onTabsUpdateRef = useRef(onTabsUpdate);
  onTabsUpdateRef.current = onTabsUpdate;

  // Tab sessions kept in memory (active & hidden tabs)
  const tabsRef = useRef<Map<string, TabSession>>(new Map());
  const activePathRef = useRef<string | null>(activeNotePath);
  activePathRef.current = activeNotePath;

  const [activeTabPath, setActiveTabPath] = useState<string | null>(activeNotePath);
  const [tabsList, setTabsList] = useState<readonly TabSession[]>([]);

  // Find & Replace state for the currently active tab
  const [findBarState, setFindBarState] = useState<FindBarState>({
    isOpen: false,
    isReplaceOpen: false,
    searchTerm: sessionFindMemory.searchTerm,
    replaceText: sessionFindMemory.replaceText,
    matchCase: sessionFindMemory.matchCase,
    wholeWord: sessionFindMemory.wholeWord,
    activeIndex: 0
  });
  const findBarStateRef = useRef<FindBarState>(findBarState);
  findBarStateRef.current = findBarState;

  const [totalMatches, setTotalMatches] = useState(0);
  const [skippedMatches, setSkippedMatches] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Active note date line, tags, and status
  const [activeDateLine, setActiveDateLine] = useState<string>('');
  const [activeTags, setActiveTags] = useState<readonly string[]>([]);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  // Properties dialog states (Add tag and Set status)
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSetStatusOpen, setIsSetStatusOpen] = useState(false);
  const [newStatusInput, setNewStatusInput] = useState('');
  const [suggestedStatuses, setSuggestedStatuses] = useState<readonly string[]>([]);

  // UI Slice 4: Slash menu and Floating toolbar state
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuState | null>(null);
  const [floatingToolbarState, setFloatingToolbarState] = useState<FloatingToolbarState | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabPath: string } | null>(null);
  const [wikilinkSuggestState, setWikilinkSuggestState] = useState<WikilinkSuggestState | null>(null);

  // Backlinks State
  const [backlinks, setBacklinks] = useState<readonly BacklinkRecord[]>([]);
  const [backlinksExpanded, setBacklinksExpanded] = useState(true);

  // Stats and saving state for TabStrip
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // "Drag to move" tooltip setting
  const [dragHintShown, setDragHintShown] = useState(false);
  const dragHintShownRef = useRef(false);

  useEffect(() => {
    if (window.wrriter?.app?.getSettings) {
      void window.wrriter.app.getSettings().then((res: any) => {
        if (res && res.ok && res.value) {
          setDragHintShown(Boolean(res.value.dragHintShown));
          dragHintShownRef.current = Boolean(res.value.dragHintShown);
        }
      });
    }
  }, []);

  // Fetch backlinks for current active note
  useEffect(() => {
    if (!activeTabPath || !window.wrriter?.index?.getBacklinks) {
      setBacklinks([]);
      return;
    }

    const session = tabsRef.current.get(activeTabPath);
    const title = session?.title || deriveFileNameFromTitle(activeTabPath).replace(/\.md$/i, '');
    const normPath = activeTabPath.replace(/\.md$/i, '');

    void window.wrriter.index.getBacklinks({ target: title, altTarget: normPath }).then((res: any) => {
      if (res && res.ok && res.value) {
        setBacklinks(res.value);
      }
    });
  }, [activeTabPath, tabsList]);

  const handleSetDragHintShown = useCallback(() => {
    setDragHintShown(true);
    dragHintShownRef.current = true;
    if (window.wrriter?.app?.saveSettings) {
      void window.wrriter.app.saveSettings({ dragHintShown: true });
    }
  }, []);

  // Autosave timer
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to notify parent about tabs state
  const notifyTabs = useCallback(() => {
    const list = Array.from(tabsRef.current.values());
    setTabsList(list);
    onTabsUpdateRef.current?.(list, activePathRef.current);
  }, []);

  // Saves a tab session using planSave and SafeWriter
  const saveTabSession = useCallback(
    async (tab: TabSession, retryCount = 0): Promise<boolean> => {
      if (!tab.editorState) return true;

      // Broken frontmatter: SCHEMA.md mandates file is left untouched
      if (tab.isBrokenFrontmatter) {
        return true;
      }

      // Add created timestamp to notes without it the next time note is saved for another reason (M3 Properties, Open Item 14)
      if (!tab.created) {
        tab.created = formatCreatedDate();
      }

      const docJson = tab.editorState.doc.toJSON();
      const currentMarkdown = tipTapDocToMarkdown(docJson as any);

      let fullMarkdown = currentMarkdown;
      const hasProperties =
        (tab.tags && tab.tags.length > 0) ||
        Boolean(tab.status) ||
        Boolean(tab.created);

      if (hasProperties || tab.frontmatterRaw) {
        const baseFm = tab.frontmatterRaw || '';
        const updatedFm = updateFrontmatter(baseFm, {
          tags: tab.tags,
          status: tab.status,
          created: tab.created
        });
        const isCrlf = (tab.lastSavedText || '').includes('\r\n');
        const eol = isCrlf ? '\r\n' : '\n';
        fullMarkdown = updatedFm.trimEnd() + eol + (currentMarkdown ? currentMarkdown : '');
      }

      setIsSaving(true);
      const plan = planSave(tab.originalBytes, fullMarkdown);

      if (plan.unchanged) {
        tab.isDirty = false;
        setIsSaving(false);
        return true;
      }

      if (window.wrriter?.note?.save) {
        const res = await window.wrriter.note.save({
          path: tab.path,
          text: plan.text
        });

        setIsSaving(false);

        if (res.ok) {
          tab.originalBytes = plan.bytes;
          tab.lastSavedText = plan.text;
          tab.isDirty = false;
          if (res.value.modified) {
            tab.dateLine = formatNoteDate(res.value.modified);
            setActiveDateLine(tab.dateLine);
          }
          const summary = extractNotePreviewAndImage(plan.text);
          onNoteSummaryChangeRef.current?.({
            path: tab.path,
            title: tab.title,
            preview: summary.preview,
            hasImage: summary.hasImage,
            imageSrc: summary.imageSrc
          });
          return true;
        } else {
          // Keep text in tab, show notice and retry if locked
          onNoticeRef.current?.('Save paused: another program is holding this file. Retrying...');
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
    []
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

        if (window.wrriter?.note?.rename) {
          const res = await window.wrriter.note.rename({
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
            onPathChangeRef.current?.(oldPath, newPath);
            onTitleChangeRef.current?.(newTitle);
            notifyTabs();
            void checkExternalChanges();
          }
        }
      }
    },
    [notifyTabs]
  );

  // Properties Line actions (Add tag, Set status)
  const handleOpenAddTag = useCallback(() => {
    setNewTagInput('');
    setIsAddTagOpen(true);
  }, []);

  const handleOpenSetStatus = useCallback(async () => {
    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    setNewStatusInput(activeTab?.status || '');
    if (window.wrriter?.index?.getStatuses) {
      const res = await window.wrriter.index.getStatuses();
      if (res.ok) {
        setSuggestedStatuses(res.value);
      }
    }
    setIsSetStatusOpen(true);
  }, []);

  const handleConfirmAddTag = useCallback(() => {
    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (!activeTab || activeTab.isBrokenFrontmatter) {
      setIsAddTagOpen(false);
      return;
    }

    const raw = newTagInput.trim();
    if (!raw) {
      setIsAddTagOpen(false);
      return;
    }

    // A space while adding a tag starts the next one (M3 Tags specification)
    const parts = parseTagsInput(raw);

    const currentTags = [...(activeTab.tags || [])];
    let changed = false;

    for (const tag of parts) {
      // Tags are case-insensitive with the first spelling shown (M3 Tags specification)
      if (!currentTags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        currentTags.push(tag);
        changed = true;
      }
    }

    if (changed) {
      activeTab.tags = currentTags;
      setActiveTags(currentTags);
      if (!activeTab.created) {
        activeTab.created = formatCreatedDate();
      }
      activeTab.isDirty = true;
      if (editorRef.current) {
        editorRef.current.view.dispatch(
          editorRef.current.state.tr.setMeta(propertiesLinePluginKey, {
            tags: currentTags,
            status: activeTab.status || null
          })
        );
      }
      void saveTabSession(activeTab);
    }

    setIsAddTagOpen(false);
  }, [newTagInput, saveTabSession]);

  const handleConfirmSetStatus = useCallback(
    (chosenStatus?: string) => {
      const activeTab = tabsRef.current.get(activePathRef.current ?? '');
      if (!activeTab || activeTab.isBrokenFrontmatter) {
        setIsSetStatusOpen(false);
        return;
      }

      const statusVal = (chosenStatus !== undefined ? chosenStatus : newStatusInput).trim() || null;
      activeTab.status = statusVal;
      setActiveStatus(statusVal);
      if (!activeTab.created) {
        activeTab.created = formatCreatedDate();
      }
      activeTab.isDirty = true;

      if (editorRef.current) {
        editorRef.current.view.dispatch(
          editorRef.current.state.tr.setMeta(propertiesLinePluginKey, {
            tags: activeTab.tags || [],
            status: statusVal
          })
        );
      }
      void saveTabSession(activeTab);
      setIsSetStatusOpen(false);
    },
    [newStatusInput, saveTabSession]
  );

  useEffect(() => {
    const onOpenAddTag = () => handleOpenAddTag();
    const onOpenSetStatus = () => {
      void handleOpenSetStatus();
    };

    window.addEventListener('wrriter:open-add-tag', onOpenAddTag);
    window.addEventListener('wrriter:add-tag', onOpenAddTag);
    window.addEventListener('wrriter:open-set-status', onOpenSetStatus);
    window.addEventListener('wrriter:set-status', onOpenSetStatus);

    return () => {
      window.removeEventListener('wrriter:open-add-tag', onOpenAddTag);
      window.removeEventListener('wrriter:add-tag', onOpenAddTag);
      window.removeEventListener('wrriter:open-set-status', onOpenSetStatus);
      window.removeEventListener('wrriter:set-status', onOpenSetStatus);
    };
  }, [handleOpenAddTag, handleOpenSetStatus]);

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
        CalloutNode,
        TableNode,
        TableRowNode,
        TableHeaderNode,
        TableCellNode,
        BulletListNode,
        OrderedListNode,
        ListItemNode,
        TaskListNode,
        TaskItemNode,
        HorizontalRuleNode,
        ImageNode,
        FileChipNode,
        BoldMark,
        ItalicMark,
        StrikeMark,
        CodeMark,
        WikilinkMark,
        WebLinkMark,
        MarkdownShortcutsExtension,
        PasteHandlerExtension,
        FindReplaceExtension,
        HeadingFoldingExtension,
        KeyboardMoveExtension,
        BlockHandlesExtension.configure({
          getDragHintShown: () => dragHintShownRef.current,
          onSetDragHintShown: handleSetDragHintShown
        }),
        BlockDragExtension.configure({
          getDragHintShown: () => dragHintShownRef.current,
          onSetDragHintShown: handleSetDragHintShown
        }),
        SlashMenuExtension.configure({
          onStateChange: (state) => setSlashMenuState(state)
        }),
        FloatingToolbarExtension.configure({
          onStateChange: (state) => setFloatingToolbarState(state)
        }),
        TypingTouchesExtension,
        WikilinkSuggestExtension.configure({
          onStateChange: (state) => setWikilinkSuggestState(state)
        }),
        Extension.create({
          name: 'wikilinkDecorations',
          addProseMirrorPlugins() {
            return [
              new ProseMirrorPlugin({
                props: {
                  decorations: (state) => {
                    const available = availableNotesRef.current;
                    if (!available || available.length === 0) return DecorationSet.empty;
                    const decos: Decoration[] = [];
                    const activePath = activePathRef.current ?? '';
                    state.doc.descendants((node, pos) => {
                      if (node.isText && node.marks) {
                        for (const mark of node.marks) {
                          if (mark.type.name === 'wikilink') {
                            const target = (mark.attrs['target'] as string) || node.text || '';
                            const res = resolveLink(target, activePath, available);
                            if (res.isMissing) {
                              decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'missing' }));
                            }
                          }
                        }
                      }
                    });
                    return DecorationSet.create(state.doc, decos);
                  }
                }
              })
            ];
          }
        }),
        PropertiesLineExtension.configure({
          onStatusClick: () => void handleOpenSetStatus(),
          onAddTagClick: () => handleOpenAddTag()
        })
      ],
      editorProps: {
        attributes: {
          class: 'wrriter-prosemirror',
          spellcheck: 'true',
          lang: 'en'
        },
        handleClick(view, pos, event) {
          const target = event.target as HTMLElement;

          // 1. Task Item Checkbox Toggle
          const chkBtn = target.closest('.chk') || target.closest('[data-task-toggle]');
          if (chkBtn) {
            event.preventDefault();
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'taskItem') {
                const nodePos = $pos.before(d);
                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  checked: !node.attrs['checked']
                });
                view.dispatch(tr);
                return true;
              }
            }
          }

          // 2. Callout Fold Toggle
          const foldBtn = target.closest('.fold') || target.closest('[data-callout-fold]');
          if (foldBtn) {
            event.preventDefault();
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'callout') {
                const nodePos = $pos.before(d);
                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  folded: !node.attrs['folded']
                });
                view.dispatch(tr);
                return true;
              }
            }
          }

          // 3a. Wikilink click (.wl:not(.web))
          const wlEl = target.closest('.wl:not(.web)') as HTMLElement | null;
          if (wlEl) {
            event.preventDefault();
            const targetNote = wlEl.getAttribute('data-target') || wlEl.textContent || '';
            const isNewTab = Boolean(event.ctrlKey || event.metaKey || event.button === 1);
            if (targetNote && onFollowLinkRef.current) {
              onFollowLinkRef.current(targetNote, isNewTab);
            }
            return true;
          }

          // 3b. Web link or vault markdown link click
          const linkEl = target.closest('a.wl.web, a.wl.md-link') as HTMLAnchorElement | null;
          if (linkEl && linkEl.href) {
            event.preventDefault();
            const rawHref = linkEl.getAttribute('href') || linkEl.href;
            const isNewTab = Boolean(event.ctrlKey || event.metaKey || event.button === 1);
            try {
              const parsed = new URL(linkEl.href);
              if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                window.open(linkEl.href, '_blank', 'noopener,noreferrer');
                return true;
              }
            } catch {
              // Ignore invalid address
            }

            if (onFollowLinkRef.current) {
              onFollowLinkRef.current(rawHref, isNewTab);
            }
            return true;
          }

          // 4. Image Toolbar Actions (Align left, center, right, or remove)
          const alignBtn = target.closest('.phbar .fb[data-align]') as HTMLElement | null;
          if (alignBtn) {
            event.preventDefault();
            const align = alignBtn.getAttribute('data-align') as 'left' | 'center' | 'right';
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'image') {
                const nodePos = $pos.before(d);
                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  alignment: align
                });
                view.dispatch(tr);
                return true;
              }
            }
          }

          const removeBtn = target.closest('.phbar .fb[data-action="remove"]') as HTMLElement | null;
          if (removeBtn) {
            event.preventDefault();
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'image') {
                const nodePos = $pos.before(d);
                const tr = view.state.tr.delete(nodePos, nodePos + node.nodeSize);
                view.dispatch(tr);
                return true;
              }
            }
          }

          return false;
        },
        handleDoubleClick(view, pos, event) {
          const target = event.target as HTMLElement;
          // Image double-click resets back to natural size
          if (target.tagName === 'IMG' || target.closest('.phw')) {
            event.preventDefault();
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === 'image') {
                const nodePos = $pos.before(d);
                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  width: null
                });
                view.dispatch(tr);
                return true;
              }
            }
          }
          return false;
        }
      },
      onTransaction({ editor: currentEditor }) {
        const frState = findReplacePluginKey.getState(currentEditor.state);
        if (frState) {
          setTotalMatches(frState.matches.length);
          setSkippedMatches(frState.skippedMatches);
          setCurrentMatchIndex(frState.activeIndex);
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
            flushSync(() => {
              onTitleChangeRef.current?.(currentTitle);
              setTabsList(Array.from(tabsRef.current.values()));
            });
          }

          // Live word and character count
          const docText = currentEditor.state.doc.textBetween(0, currentEditor.state.doc.content.size, ' ');
          const words = docText.trim() ? docText.trim().split(/\s+/).length : 0;
          setWordCount(words);
          setCharCount(docText.length);
          setIsSaving(true);

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
  }, [saveTabSession, notifyTabs]);

  // Handle activeNotePath changes (load, switch tabs, save previous)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeNotePath) return;

    const switchNote = async () => {
      const prevPath = activeTabPath;

      // If the target tab is already loaded and active, avoid redundant re-renders or resets
      if (prevPath === activeNotePath && tabsRef.current.has(activeNotePath)) {
        return;
      }

      // 1. Save and remember previous tab state
      if (prevPath && prevPath !== activeNotePath) {
        const prevTab = tabsRef.current.get(prevPath);
        if (prevTab) {
          prevTab.editorState = editor.state;
          prevTab.savedSelection = {
            from: editor.state.selection.from,
            to: editor.state.selection.to
          };
          prevTab.findBarState = { ...findBarStateRef.current };
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
        let originalBytes: Uint8Array = new Uint8Array(0);
        const fileName = activeNotePath.split('/').pop() ?? activeNotePath;
        const initialBase = fileName.replace(/\.md$/i, '');
        let title = initialBase;
        let tags: readonly string[] = [];
        let status: string | null = null;
        let created: string | null = null;
        let isBrokenFrontmatter = false;
        let frontmatterRaw = '';
        let dateLine = formatNoteDate(Date.now());

        if (window.wrriter?.note?.read) {
          const res = await window.wrriter.note.read({ path: activeNotePath });
          if (res.ok) {
            rawText = res.value.text;
            originalBytes = encodeUtf8(rawText);
            const firstLine = rawText.split(/\r?\n/)[0];
            title = extractTitleFromFirstLine(firstLine) || initialBase;

            const mtime = res.value.modified || Date.now();
            dateLine = formatNoteDate(mtime);

            const fm = parseFrontmatter(rawText);
            if (fm.isBroken) {
              isBrokenFrontmatter = true;
              onNoticeRef.current?.('Broken frontmatter; file left untouched');
              tags = [];
              status = null;
              created = null;
            } else {
              tags = fm.tags;
              status = fm.status;
              created = fm.created;
              frontmatterRaw = fm.hasFrontmatter ? fm.raw : '';
            }
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
          lastSavedText: rawText,
          initialFileName: fileName,
          initialTitle: title,
          tags,
          status,
          created,
          isBrokenFrontmatter,
          frontmatterRaw,
          dateLine,
          findBarState: {
            isOpen: false,
            isReplaceOpen: false,
            searchTerm: sessionFindMemory.searchTerm,
            replaceText: sessionFindMemory.replaceText,
            matchCase: sessionFindMemory.matchCase,
            wholeWord: sessionFindMemory.wholeWord,
            activeIndex: 0
          }
        };
        tabsRef.current.set(activeNotePath, targetTab);

        // Set content in live editor
        editor.commands.setContent(docJson as any, { emitUpdate: false });
        editor.view.dispatch(
          editor.state.tr.setMeta(propertiesLinePluginKey, { tags, status })
        );
        targetTab.editorState = editor.state;
        onTitleChangeRef.current?.(title);
        setActiveTags(tags);
        setActiveStatus(status);
        setActiveDateLine(dateLine);
      } else if (targetTab.editorState) {
        // Swap EditorState in O(1) time without re-mounting editor DOM
        editor.view.updateState(targetTab.editorState);
        if (targetTab.savedSelection) {
          try {
            const maxPos = editor.state.doc.content.size;
            const from = Math.min(targetTab.savedSelection.from, maxPos);
            const to = Math.min(targetTab.savedSelection.to, maxPos);
            editor.commands.setTextSelection({ from, to });
          } catch {}
        }
        editor.view.dispatch(
          editor.state.tr.setMeta(propertiesLinePluginKey, {
            tags: targetTab.tags || [],
            status: targetTab.status || null
          })
        );
        onTitleChangeRef.current?.(targetTab.title);
        setActiveTags(targetTab.tags || []);
        setActiveStatus(targetTab.status || null);
        setActiveDateLine(targetTab.dateLine || '');
      } else {
        // Target tab in memory but editorState cleared (e.g. quietly reloaded in place while in background)
        const rawText = targetTab.lastSavedText ?? (targetTab.originalBytes.length > 0 ? new TextDecoder().decode(targetTab.originalBytes) : '');
        const docJson = markdownToTipTapDoc(rawText);
        editor.commands.setContent(docJson as any, { emitUpdate: false });
        editor.view.dispatch(
          editor.state.tr.setMeta(propertiesLinePluginKey, {
            tags: targetTab.tags || [],
            status: targetTab.status || null
          })
        );
        targetTab.editorState = editor.state;
        if (targetTab.savedSelection) {
          try {
            const maxPos = editor.state.doc.content.size;
            const from = Math.min(targetTab.savedSelection.from, maxPos);
            const to = Math.min(targetTab.savedSelection.to, maxPos);
            editor.commands.setTextSelection({ from, to });
          } catch {}
        }
        onTitleChangeRef.current?.(targetTab.title);
        setActiveTags(targetTab.tags || []);
        setActiveStatus(targetTab.status || null);
        setActiveDateLine(targetTab.dateLine || '');
      }

      // Restore destination tab's findBarState
      if (targetTab.findBarState) {
        setFindBarState(targetTab.findBarState);
        findBarStateRef.current = targetTab.findBarState;
        if (targetTab.findBarState.isOpen) {
          editor.commands.setFindState({
            searchTerm: targetTab.findBarState.searchTerm,
            replaceText: targetTab.findBarState.replaceText,
            options: {
              matchCase: targetTab.findBarState.matchCase,
              wholeWord: targetTab.findBarState.wholeWord
            },
            activeIndex: targetTab.findBarState.activeIndex
          });
        } else {
          editor.commands.clearFind();
        }
      } else {
        const defaultState: FindBarState = {
          isOpen: false,
          isReplaceOpen: false,
          searchTerm: sessionFindMemory.searchTerm,
          replaceText: sessionFindMemory.replaceText,
          matchCase: sessionFindMemory.matchCase,
          wholeWord: sessionFindMemory.wholeWord,
          activeIndex: 0
        };
        targetTab.findBarState = defaultState;
        setFindBarState(defaultState);
        findBarStateRef.current = defaultState;
        editor.commands.clearFind();
      }

      // Restore scroll position
      if (scrollRef.current && targetTab) {
        scrollRef.current.scrollTop = targetTab.scrollTop;
      }

      // Compute word count for active note
      if (editor) {
        const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ');
        const words = docText.trim() ? docText.trim().split(/\s+/).length : 0;
        setWordCount(words);
        setCharCount(docText.length);
      }

      setActiveTabPath(activeNotePath);
      notifyTabs();
    };

    void switchNote();
  }, [activeNotePath, activeTabPath, saveTabSession, checkRenameOnLeave, notifyTabs]);

  // Outside changes handler (quiet reload if clean; save (External).md if dirty; notify if deleted)
  const checkExternalChanges = useCallback(async () => {
    for (const tab of tabsRef.current.values()) {
      if (!window.wrriter?.note?.read) continue;
      const res = await window.wrriter.note.read({ path: tab.path });
      if (!res.ok) {
        if (tab.originalBytes.length > 0 && !(tab as any)._deletedNotified) {
          (tab as any)._deletedNotified = true;
          onNoticeRef.current?.(`"${tab.title}" was moved or deleted outside Wrriter. Your text is kept in the tab.`);
        }
        continue;
      }

      const diskText = res.value.text;
      const lastSavedText = tab.lastSavedText ?? (tab.originalBytes.length > 0 ? new TextDecoder().decode(tab.originalBytes) : '');
      const isDifferent = diskText !== lastSavedText;

      if (isDifferent) {
        const diskBytes = encodeUtf8(diskText);
        if (!tab.isDirty) {
          tab.originalBytes = diskBytes;
          tab.lastSavedText = diskText;
          const newText = diskText;
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
            // Note open in another tab updated in place; preserve its cursor
            if (tab.editorState) {
              tab.savedSelection = {
                from: tab.editorState.selection.from,
                to: tab.editorState.selection.to
              };
            }
            tab.editorState = null;
          }
        } else {
          const dir = tab.path.includes('/') ? tab.path.slice(0, tab.path.lastIndexOf('/')) : '';
          const currentFileName = tab.path.split('/').pop() ?? tab.initialFileName;
          const baseName = currentFileName.replace(/\.md$/i, '');
          const externalName = `${baseName} (External).md`;
          const externalPath = dir ? `${dir}/${externalName}` : externalName;

          if (window.wrriter?.note?.save) {
            await window.wrriter.note.save({
              path: externalPath,
              text: diskText
            });
            onNoticeRef.current?.(`"${tab.title}" was edited outside Wrriter. External version saved as ${externalName}.`);
          }
          tab.originalBytes = diskBytes;
          tab.lastSavedText = diskText;
        }
      }
    }
  }, []);

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
    onSelectTabRef.current?.(path);
  };

  // Close tab handler
  const handleCloseTab = async (e: React.MouseEvent | null, path: string) => {
    if (e) e.stopPropagation();
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
        onSelectTabRef.current?.(next);
      }
      notifyTabs();
    }
  };

  const handleCloseOtherTabs = useCallback(
    async (keepPath: string) => {
      for (const [path, tab] of tabsRef.current.entries()) {
        if (path !== keepPath) {
          if (tab.isDirty) await saveTabSession(tab);
          await checkRenameOnLeave(tab);
        }
      }
      const keepTab = tabsRef.current.get(keepPath);
      const remaining = new Map<string, TabSession>();
      if (keepTab) remaining.set(keepPath, keepTab);
      tabsRef.current = remaining;
      notifyTabs();
      if (activeTabPath !== keepPath) {
        handleSelectTab(keepPath);
      }
    },
    [activeTabPath, handleSelectTab, notifyTabs, saveTabSession, checkRenameOnLeave]
  );

  const handleCloseTabsToRight = useCallback(
    async (targetPath: string) => {
      const keys = Array.from(tabsRef.current.keys());
      const targetIndex = keys.indexOf(targetPath);
      if (targetIndex === -1) return;

      const toClose = keys.slice(targetIndex + 1);
      for (const path of toClose) {
        const tab = tabsRef.current.get(path);
        if (tab) {
          if (tab.isDirty) await saveTabSession(tab);
          await checkRenameOnLeave(tab);
          tabsRef.current.delete(path);
        }
      }
      notifyTabs();
      if (activeTabPath && toClose.includes(activeTabPath)) {
        handleSelectTab(targetPath);
      }
    },
    [activeTabPath, handleSelectTab, notifyTabs, saveTabSession, checkRenameOnLeave]
  );

  // Reorder tabs by drag & drop
  const handleReorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      const list = Array.from(tabsList);
      const [moved] = list.splice(fromIndex, 1);
      if (!moved) return;
      list.splice(toIndex, 0, moved);

      const reorderedMap = new Map<string, TabSession>();
      for (const item of list) {
        reorderedMap.set(item.path, item);
      }
      tabsRef.current = reorderedMap;
      setTabsList(list);
      notifyTabs();
    },
    [tabsList, notifyTabs]
  );

  // Scrolls active match into view and unfolds heading if folded
  const scrollToActiveMatch = useCallback(() => {
    setTimeout(() => {
      const activeEl = containerRef.current?.querySelector('.wr-find-match-active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      const editor = editorRef.current;
      if (editor) {
        const frState = findReplacePluginKey.getState(editor.state);
        const activeMatch = frState?.matches[frState.activeIndex];
        if (activeMatch) {
          const matchPos = activeMatch.from;
          window.dispatchEvent(new CustomEvent('wrriter:unfold-at', { detail: { pos: matchPos } }));
        }
      }
    }, 0);
  }, []);

  const handleOpenFind = useCallback(
    (openReplace = false) => {
      const editor = editorRef.current;
      if (!editor) return;

      let term = findBarStateRef.current.searchTerm;
      // Pre-fill find input with editor's selected text if non-empty
      const { from, to } = editor.state.selection;
      if (from < to) {
        const selected = editor.state.doc.textBetween(from, to, ' ');
        if (selected.trim() && !selected.includes('\n') && selected.length <= 100) {
          term = selected;
        }
      } else if (!term) {
        term = sessionFindMemory.searchTerm;
      }

      const updated: FindBarState = {
        isOpen: true,
        isReplaceOpen: openReplace ? true : findBarStateRef.current.isReplaceOpen,
        searchTerm: term,
        replaceText: findBarStateRef.current.replaceText || sessionFindMemory.replaceText,
        matchCase: findBarStateRef.current.matchCase || sessionFindMemory.matchCase,
        wholeWord: findBarStateRef.current.wholeWord || sessionFindMemory.wholeWord,
        activeIndex: 0
      };

      sessionFindMemory.searchTerm = updated.searchTerm;
      sessionFindMemory.replaceText = updated.replaceText;
      sessionFindMemory.matchCase = updated.matchCase;
      sessionFindMemory.wholeWord = updated.wholeWord;

      setFindBarState(updated);
      findBarStateRef.current = updated;

      editor.commands.setFindState({
        searchTerm: updated.searchTerm,
        replaceText: updated.replaceText,
        options: {
          matchCase: updated.matchCase,
          wholeWord: updated.wholeWord
        },
        activeIndex: 0
      });

      const activeTab = tabsRef.current.get(activePathRef.current ?? '');
      if (activeTab) {
        activeTab.findBarState = updated;
      }

      scrollToActiveMatch();
    },
    [scrollToActiveMatch]
  );

  const handleCloseFind = useCallback(() => {
    const editor = editorRef.current;
    const updated: FindBarState = {
      ...findBarStateRef.current,
      isOpen: false
    };

    setFindBarState(updated);
    findBarStateRef.current = updated;

    if (editor) {
      editor.commands.clearFind();
      editor.commands.focus();
    }

    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (activeTab) {
      activeTab.findBarState = updated;
    }
  }, []);

  const handleSearchChange = useCallback(
    (term: string) => {
      const editor = editorRef.current;
      sessionFindMemory.searchTerm = term;

      const updated: FindBarState = {
        ...findBarStateRef.current,
        searchTerm: term,
        activeIndex: 0
      };

      setFindBarState(updated);
      findBarStateRef.current = updated;

      if (editor) {
        editor.commands.setFindState({
          searchTerm: term,
          options: {
            matchCase: updated.matchCase,
            wholeWord: updated.wholeWord
          },
          activeIndex: 0
        });
      }

      const activeTab = tabsRef.current.get(activePathRef.current ?? '');
      if (activeTab) {
        activeTab.findBarState = updated;
      }

      scrollToActiveMatch();
    },
    [scrollToActiveMatch]
  );

  const handleReplaceChange = useCallback((replacement: string) => {
    sessionFindMemory.replaceText = replacement;

    const updated: FindBarState = {
      ...findBarStateRef.current,
      replaceText: replacement
    };

    setFindBarState(updated);
    findBarStateRef.current = updated;

    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (activeTab) {
      activeTab.findBarState = updated;
    }
  }, []);

  const handleToggleMatchCase = useCallback(() => {
    const editor = editorRef.current;
    const nextVal = !findBarStateRef.current.matchCase;
    sessionFindMemory.matchCase = nextVal;

    const updated: FindBarState = {
      ...findBarStateRef.current,
      matchCase: nextVal,
      activeIndex: 0
    };

    setFindBarState(updated);
    findBarStateRef.current = updated;

    if (editor) {
      editor.commands.setFindState({
        options: {
          matchCase: nextVal,
          wholeWord: updated.wholeWord
        },
        activeIndex: 0
      });
    }

    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (activeTab) {
      activeTab.findBarState = updated;
    }

    scrollToActiveMatch();
  }, [scrollToActiveMatch]);

  const handleToggleWholeWord = useCallback(() => {
    const editor = editorRef.current;
    const nextVal = !findBarStateRef.current.wholeWord;
    sessionFindMemory.wholeWord = nextVal;

    const updated: FindBarState = {
      ...findBarStateRef.current,
      wholeWord: nextVal,
      activeIndex: 0
    };

    setFindBarState(updated);
    findBarStateRef.current = updated;

    if (editor) {
      editor.commands.setFindState({
        options: {
          matchCase: updated.matchCase,
          wholeWord: nextVal
        },
        activeIndex: 0
      });
    }

    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (activeTab) {
      activeTab.findBarState = updated;
    }

    scrollToActiveMatch();
  }, [scrollToActiveMatch]);

  const handleToggleReplace = useCallback(() => {
    const updated: FindBarState = {
      ...findBarStateRef.current,
      isReplaceOpen: !findBarStateRef.current.isReplaceOpen
    };

    setFindBarState(updated);
    findBarStateRef.current = updated;

    const activeTab = tabsRef.current.get(activePathRef.current ?? '');
    if (activeTab) {
      activeTab.findBarState = updated;
    }
  }, []);

  const handleNextMatch = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.commands.findNext();
      scrollToActiveMatch();
    }
  }, [scrollToActiveMatch]);

  const handlePrevMatch = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.commands.findPrev();
      scrollToActiveMatch();
    }
  }, [scrollToActiveMatch]);

  const handleReplaceCurrent = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.commands.replaceCurrent(findBarStateRef.current.replaceText);
      scrollToActiveMatch();
    }
  }, [scrollToActiveMatch]);

  const handleReplaceAll = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.commands.replaceAll(findBarStateRef.current.replaceText);
    }
  }, []);

  // Keyboard shortcut listener (Ctrl+F, Ctrl+H, F3, Shift+F3) & Palette commands
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleOpenFind(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleOpenFind(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevMatch();
        } else {
          handleNextMatch();
        }
      }
    };

    const handleFindPaletteCommand = () => handleOpenFind(false);
    const handleReplacePaletteCommand = () => handleOpenFind(true);

    const handleFoldAll = () => {
      if (editorRef.current) {
        const tr = editorRef.current.state.tr.setMeta(headingFoldingPluginKey, { type: 'foldAll' });
        editorRef.current.view.dispatch(tr);
      }
    };

    const handleUnfoldAll = () => {
      if (editorRef.current) {
        const tr = editorRef.current.state.tr.setMeta(headingFoldingPluginKey, { type: 'unfoldAll' });
        editorRef.current.view.dispatch(tr);
      }
    };

    const handleUnfoldAt = (e: Event) => {
      const customEvent = e as CustomEvent<{ pos: number }>;
      if (editorRef.current && customEvent.detail?.pos !== undefined) {
        const tr = editorRef.current.state.tr.setMeta(headingFoldingPluginKey, {
          type: 'unfoldAt',
          pos: customEvent.detail.pos
        });
        editorRef.current.view.dispatch(tr);
      }
    };

    // Palette commands for Slash Menu items
    const slashListeners: [string, () => void][] = SLASH_MENU_ITEMS.map((item) => [
      item.paletteCommand,
      () => {
        if (editorRef.current) {
          item.action(editorRef.current);
        }
      }
    ]);

    // Palette commands for formatting and block conversions
    const formatListeners: [string, () => void][] = [
      ['wrriter:format-bold', () => (editorRef.current?.chain().focus() as any)?.toggleBold().run()],
      ['wrriter:format-italic', () => (editorRef.current?.chain().focus() as any)?.toggleItalic().run()],
      ['wrriter:format-strikethrough', () => (editorRef.current?.chain().focus() as any)?.toggleStrike().run()],
      ['wrriter:format-code', () => (editorRef.current?.chain().focus() as any)?.toggleCode().run()],
      ['wrriter:format-link', () => {
        if (editorRef.current) {
          const url = window.prompt('Enter link URL:');
          if (url) (editorRef.current.chain().focus() as any).setLink({ href: url }).run();
        }
      }],
      ['wrriter:format-clear', () => editorRef.current?.chain().focus().unsetAllMarks().clearNodes().run()],
      ['wrriter:turn-into-paragraph', () => (editorRef.current?.chain().focus() as any)?.setParagraph().run()],
      ['wrriter:turn-into-heading-1', () => (editorRef.current?.chain().focus() as any)?.setHeading({ level: 1 }).run()],
      ['wrriter:turn-into-heading-2', () => (editorRef.current?.chain().focus() as any)?.setHeading({ level: 2 }).run()],
      ['wrriter:turn-into-heading-3', () => (editorRef.current?.chain().focus() as any)?.setHeading({ level: 3 }).run()],
      ['wrriter:turn-into-quote', () => (editorRef.current?.chain().focus() as any)?.toggleBlockquote().run()],
      ['wrriter:turn-into-code-block', () => (editorRef.current?.chain().focus() as any)?.toggleCodeBlock().run()],
      ['wrriter:turn-into-bullet-list', () => (editorRef.current?.chain().focus() as any)?.toggleBulletList().run()],
      ['wrriter:turn-into-numbered-list', () => (editorRef.current?.chain().focus() as any)?.toggleOrderedList().run()],
      ['wrriter:turn-into-task-list', () => (editorRef.current?.chain().focus() as any)?.toggleTaskList().run()]
    ];

    const handleCloseAllMenus = (e: Event) => {
      const customEvent = e as CustomEvent<{ except?: string }>;
      if (customEvent.detail?.except !== 'slash-menu') setSlashMenuState(null);
      if (customEvent.detail?.except !== 'floating-toolbar') setFloatingToolbarState(null);
      if (customEvent.detail?.except !== 'tab-context-menu') setTabContextMenu(null);
    };

    const handleCloseTabCmd = () => {
      if (activePathRef.current) {
        void handleCloseTab(null, activePathRef.current);
      }
    };
    const handleCloseOthersCmd = () => {
      if (activePathRef.current) {
        void handleCloseOtherTabs(activePathRef.current);
      }
    };
    const handleCloseRightCmd = () => {
      if (activePathRef.current) {
        void handleCloseTabsToRight(activePathRef.current);
      }
    };
    const handleNextTabCmd = () => {
      const list = Array.from(tabsRef.current.keys());
      if (list.length > 1) {
        const curIdx = list.indexOf(activePathRef.current ?? '');
        const nextIdx = (curIdx + 1) % list.length;
        const nextPath = list[nextIdx];
        if (nextPath) handleSelectTab(nextPath);
      }
    };
    const handlePrevTabCmd = () => {
      const list = Array.from(tabsRef.current.keys());
      if (list.length > 1) {
        const curIdx = list.indexOf(activePathRef.current ?? '');
        const prevIdx = (curIdx - 1 + list.length) % list.length;
        const prevPath = list[prevIdx];
        if (prevPath) handleSelectTab(prevPath);
      }
    };
    const handleNoteDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      const deletedPath = customEvent.detail?.path;
      if (!deletedPath) return;

      const tab = tabsRef.current.get(deletedPath);
      if (tab) {
        tabsRef.current.delete(deletedPath);
        if (activePathRef.current === deletedPath) {
          const remaining = Array.from(tabsRef.current.keys());
          const next = remaining[remaining.length - 1] ?? null;
          setActiveTabPath(next);
          activePathRef.current = next;
          onSelectTabRef.current?.(next);
        }
        notifyTabs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wrriter:find-in-note', handleFindPaletteCommand);
    window.addEventListener('wrriter:replace-in-note', handleReplacePaletteCommand);
    window.addEventListener('wrriter:fold-all', handleFoldAll);
    window.addEventListener('wrriter:unfold-all', handleUnfoldAll);
    window.addEventListener('wrriter:unfold-at', handleUnfoldAt);
    window.addEventListener('wrriter:close-all-menus', handleCloseAllMenus);
    window.addEventListener('wrriter:close-tab', handleCloseTabCmd);
    window.addEventListener('wrriter:close-other-tabs', handleCloseOthersCmd);
    window.addEventListener('wrriter:close-tabs-to-right', handleCloseRightCmd);
    window.addEventListener('wrriter:next-tab', handleNextTabCmd);
    window.addEventListener('wrriter:prev-tab', handlePrevTabCmd);
    window.addEventListener('wrriter:note-deleted', handleNoteDeleted);
    slashListeners.forEach(([event, handler]) => window.addEventListener(event, handler));
    formatListeners.forEach(([event, handler]) => window.addEventListener(event, handler));

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wrriter:find-in-note', handleFindPaletteCommand);
      window.removeEventListener('wrriter:replace-in-note', handleReplacePaletteCommand);
      window.removeEventListener('wrriter:fold-all', handleFoldAll);
      window.removeEventListener('wrriter:unfold-all', handleUnfoldAll);
      window.removeEventListener('wrriter:unfold-at', handleUnfoldAt);
      window.removeEventListener('wrriter:close-all-menus', handleCloseAllMenus);
      window.removeEventListener('wrriter:close-tab', handleCloseTabCmd);
      window.removeEventListener('wrriter:close-other-tabs', handleCloseOthersCmd);
      window.removeEventListener('wrriter:close-tabs-to-right', handleCloseRightCmd);
      window.removeEventListener('wrriter:next-tab', handleNextTabCmd);
      window.removeEventListener('wrriter:prev-tab', handlePrevTabCmd);
      window.removeEventListener('wrriter:note-deleted', handleNoteDeleted);
      slashListeners.forEach(([event, handler]) => window.removeEventListener(event, handler));
      formatListeners.forEach(([event, handler]) => window.removeEventListener(event, handler));
    };
  }, [handleOpenFind, handleNextMatch, handlePrevMatch, handleCloseOtherTabs, handleCloseTabsToRight]);

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
      {/* Floating Find and Replace Bar (Ctrl+F / Ctrl+H) */}
      <FindBar
        isOpen={findBarState.isOpen}
        isReplaceOpen={findBarState.isReplaceOpen}
        searchTerm={findBarState.searchTerm}
        replaceText={findBarState.replaceText}
        matchCase={findBarState.matchCase}
        wholeWord={findBarState.wholeWord}
        currentIndex={currentMatchIndex}
        totalMatches={totalMatches}
        skippedMatches={skippedMatches}
        onSearchChange={handleSearchChange}
        onReplaceChange={handleReplaceChange}
        onToggleMatchCase={handleToggleMatchCase}
        onToggleWholeWord={handleToggleWholeWord}
        onToggleReplace={handleToggleReplace}
        onNext={handleNextMatch}
        onPrev={handlePrevMatch}
        onReplaceCurrent={handleReplaceCurrent}
        onReplaceAll={handleReplaceAll}
        onClose={handleCloseFind}
      />

      {/* Scrollable Note Content Column */}
      <div
        ref={scrollRef}
        className="edscroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto'
        }}
      >
        <div
          className="col"
          style={{
            '--col-gut': `${noteMargin}px`,
            paddingLeft: noteMargin,
            paddingRight: noteMargin,
            paddingTop: 48,
            paddingBottom: 64,
            minWidth: `calc(360px + ${noteMargin * 2}px)`
          } as React.CSSProperties}
        >
          {/* Centred Date Line: 13px third text, 16px above title */}
          {activeDateLine && (
            <div className="meta">{activeDateLine}</div>
          )}

          {/* TipTap Live Editor DOM Container (Properties line rendered under title by PropertiesLineExtension) */}
          <div ref={containerRef} className="editor-container" />

          {/* Backlinks from the index with containing line snippets */}
          {activeTabPath && backlinks.length > 0 && (
            <div className="note-backlinks">
              <button
                type="button"
                className="note-backlinks-header"
                onClick={() => setBacklinksExpanded((prev) => !prev)}
              >
                <span>Backlinks</span>
                <span className="note-backlinks-count">{backlinks.length}</span>
              </button>
              {backlinksExpanded && (
                <div className="note-backlinks-list">
                  {backlinks.map((bl) => (
                    <button
                      key={`${bl.sourcePath}-${bl.lineText}`}
                      type="button"
                      className="note-backlink-card"
                      onClick={() => onFollowLinkRef.current?.(bl.sourcePath, false)}
                    >
                      <div className="note-backlink-source-title">{bl.sourceTitle || bl.sourcePath}</div>
                      <div className="note-backlink-snippet">{bl.lineText}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slash Menu, Wikilink Suggest, and Floating Toolbar Overlays */}
      <SlashMenu
        editor={editorRef.current}
        menuState={slashMenuState}
        onClose={() => setSlashMenuState(null)}
      />

      <WikilinkSuggest
        editor={editorRef.current}
        suggestState={wikilinkSuggestState}
        availableNotes={availableNotesRef.current}
        onClose={() => setWikilinkSuggestState(null)}
      />

      <FloatingToolbar
        editor={editorRef.current}
        toolbarState={floatingToolbarState}
        onClose={() => setFloatingToolbarState(null)}
      />

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <ContextMenu
          isOpen={true}
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          onClose={() => setTabContextMenu(null)}
          items={[
            {
              id: 'close-tab',
              label: 'Close tab',
              shortcut: 'Ctrl+W',
              onClick: () => handleCloseTab(null, tabContextMenu.tabPath)
            },
            {
              id: 'close-other-tabs',
              label: 'Close other tabs',
              onClick: () => handleCloseOtherTabs(tabContextMenu.tabPath)
            },
            {
              id: 'close-tabs-right',
              label: 'Close tabs to the right',
              onClick: () => handleCloseTabsToRight(tabContextMenu.tabPath)
            },
            { id: 'div-1', label: '', isDivider: true },
            {
              id: 'show-in-explorer',
              label: 'Show in File Explorer',
              onClick: () => {
                if (window.wrriter?.showItemInFolder) {
                  void window.wrriter.showItemInFolder(tabContextMenu.tabPath);
                }
              }
            }
          ]}
        />
      )}

      {/* 32px TabStrip along the bottom of the editor pane */}
      <TabStrip
        tabs={tabsList.map((t) => ({ path: t.path, title: t.title }))}
        activeTabPath={activeTabPath}
        onSelectTab={handleSelectTab}
        onCloseTab={(path) => void handleCloseTab(null, path)}
        onNewTab={() => window.dispatchEvent(new CustomEvent('wrriter:new-note'))}
        onReorderTabs={handleReorderTabs}
        onContextMenu={(e, tabPath) => setTabContextMenu({ x: e.clientX, y: e.clientY, tabPath })}
        savedState={isSaving ? 'saving' : 'saved'}
        wordCount={wordCount}
        charCount={charCount}
      />
      {/* Add Tag Dialog */}
      <Dialog
        isOpen={isAddTagOpen}
        onClose={() => setIsAddTagOpen(false)}
        title="Add tag"
        width={360}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmAddTag();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}
        >
          <input
            autoFocus
            type="text"
            className="find-input"
            style={{
              width: '100%',
              height: 'var(--wc-d)',
              padding: '0 var(--s-2)',
              borderRadius: 'var(--r-s)',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--tx)'
            }}
            placeholder="Tag name (e.g. project, work/plan)"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
            <button
              type="button"
              className="fb"
              onClick={() => setIsAddTagOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="fb"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Add tag
            </button>
          </div>
        </form>
      </Dialog>

      {/* Set Status Dialog */}
      <Dialog
        isOpen={isSetStatusOpen}
        onClose={() => setIsSetStatusOpen(false)}
        title="Set status"
        width={380}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmSetStatus();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}
        >
          <input
            autoFocus
            type="text"
            className="find-input"
            style={{
              width: '100%',
              height: 'var(--wc-d)',
              padding: '0 var(--s-2)',
              borderRadius: 'var(--r-s)',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--tx)'
            }}
            placeholder="Status word (e.g. active, draft, done)"
            value={newStatusInput}
            onChange={(e) => setNewStatusInput(e.target.value)}
          />

          {suggestedStatuses && suggestedStatuses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-1)' }}>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>
                Suggestions from vault:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-1)' }}>
                {suggestedStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="hstatus"
                    style={{ border: 'none' }}
                    onClick={() => handleConfirmSetStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--s-2)' }}>
            <button
              type="button"
              className="fb"
              style={{ color: 'var(--danger, #C15343)' }}
              onClick={() => handleConfirmSetStatus('')}
            >
              Clear status
            </button>
            <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
              <button
                type="button"
                className="fb"
                onClick={() => setIsSetStatusOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="fb"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
