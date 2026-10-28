import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { IndexTagCount } from '../../shared/ipc/contracts';
import {
  buildTagTree,
  isValidTag,
  cleanTag,
  normalizeTag,
  type TagNode
} from '../../shared/domain/tags';
import { ChevronRightIcon, TagItemIcon } from './icons';
import { ContextMenu } from './menu/ContextMenu';
import { Dialog } from './Dialog';

export interface TagTreeProps {
  tagsWithCounts: readonly IndexTagCount[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onRefresh: () => Promise<void>;
  onNotice?: (message: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TagNode;
}

interface TagActionModalState {
  type: 'rename' | 'merge';
  node: TagNode;
  targetTag: string;
  isExecuting: boolean;
  error: string | null;
}

export const TagTree: React.FC<TagTreeProps> = ({
  tagsWithCounts,
  selectedTag,
  onSelectTag,
  onRefresh,
  onNotice
}) => {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [actionModal, setActionModal] = useState<TagActionModalState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Build hierarchical tag tree
  const tree = useMemo(() => {
    return buildTagTree(tagsWithCounts);
  }, [tagsWithCounts]);

  // Expand parent nodes on initial tree build or load
  useEffect(() => {
    if (selectedTag) {
      const norm = normalizeTag(selectedTag);
      const segments = norm.split('/');
      if (segments.length > 1) {
        setExpandedTags((prev) => {
          const next = new Set(prev);
          let acc = '';
          for (let i = 0; i < segments.length - 1; i++) {
            acc = acc ? `${acc}/${segments[i]}` : segments[i]!;
            next.add(acc);
          }
          return next;
        });
      }
    }
  }, [selectedTag]);

  // Focus modal input on open
  useEffect(() => {
    if (actionModal && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [actionModal?.type]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    const handleOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        if (!actionModal?.isExecuting) {
          setActionModal(null);
        }
      }
    };
    const handleCloseAll = () => setContextMenu(null);

    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wrriter:close-all-menus', handleCloseAll);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wrriter:close-all-menus', handleCloseAll);
    };
  }, [actionModal]);

  const toggleExpanded = (normalizedTag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedTag)) {
        next.delete(normalizedTag);
      } else {
        next.add(normalizedTag);
      }
      return next;
    });
  };

  const handleStartRename = (node: TagNode) => {
    setContextMenu(null);
    setActionModal({
      type: 'rename',
      node,
      targetTag: node.tag,
      isExecuting: false,
      error: null
    });
  };

  const handleStartMerge = (node: TagNode) => {
    setContextMenu(null);
    setActionModal({
      type: 'merge',
      node,
      targetTag: '',
      isExecuting: false,
      error: null
    });
  };

  const handleExecuteAction = async () => {
    if (!actionModal || actionModal.isExecuting) return;

    const trimmed = cleanTag(actionModal.targetTag);
    if (!trimmed) {
      setActionModal((prev) => prev ? { ...prev, error: 'Tag name cannot be empty' } : null);
      return;
    }

    if (!isValidTag(trimmed)) {
      setActionModal((prev) =>
        prev
          ? {
              ...prev,
              error: 'Invalid tag. Use letters, numbers, hyphens, underscores and slashes.'
            }
          : null
      );
      return;
    }

    const isSame = normalizeTag(trimmed) === normalizeTag(actionModal.node.tag);
    if (isSame) {
      setActionModal((prev) =>
        prev ? { ...prev, error: 'Target tag cannot be identical to current tag.' } : null
      );
      return;
    }

    setActionModal((prev) => prev ? { ...prev, isExecuting: true, error: null } : null);

    try {
      if (window.wrriter?.tag?.rename) {
        const res = await window.wrriter.tag.rename({
          oldTag: actionModal.node.tag,
          newTag: trimmed
        });

        if (res.ok) {
          const count = res.value.affectedCount;
          const verb = actionModal.type === 'rename' ? 'Renamed' : 'Merged';
          onNotice?.(`${verb} tag #${actionModal.node.tag} across ${count} notes`);

          // If current selection was renamed, update selection
          if (selectedTag && normalizeTag(selectedTag) === normalizeTag(actionModal.node.tag)) {
            onSelectTag(trimmed);
          }

          setActionModal(null);
          await onRefresh();
        } else {
          setActionModal((prev) =>
            prev ? { ...prev, isExecuting: false, error: 'Failed to execute tag job' } : null
          );
        }
      }
    } catch {
      setActionModal((prev) =>
        prev ? { ...prev, isExecuting: false, error: 'An unexpected error occurred' } : null
      );
    }
  };

  const renderTagItem = (node: TagNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedTags.has(node.normalizedTag);
    const isSelected = selectedTag !== null && normalizeTag(selectedTag) === node.normalizedTag;
    const displayCount = node.count > 0 ? node.count : node.totalCount;

    return (
      <React.Fragment key={node.normalizedTag}>
        <div
          className={`fr ${isSelected ? 'sel' : ''} ${isExpanded ? 'open' : ''}`}
          style={{
            marginLeft: depth * 24,
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={() => onSelectTag(node.tag)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, node });
          }}
          tabIndex={0}
        >
          {/* Chevron slot */}
          {hasChildren ? (
            <button
              type="button"
              className="ftg fslot"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse tag' : 'Expand tag'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.normalizedTag);
              }}
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <ChevronRightIcon className="ic cv" />
            </button>
          ) : (
            <div className="fslot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TagItemIcon />
            </div>
          )}

          {/* Tag Name */}
          <span className="nm">#{node.name}</span>

          {/* Count */}
          <span className="ct">{displayCount}</span>
        </div>

        {/* Child tags */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderTagItem(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* TAGS Header */}
      <div className="lbl lbl-header">
        <span>TAGS</span>
      </div>

      <div
        className="tree"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingBottom: 'var(--s-4)',
          userSelect: 'none'
        }}
      >
        {tree.length === 0 ? (
          <div
            style={{
              padding: 'var(--s-4) var(--s-3)',
              fontSize: 'var(--fs-ui)',
              color: 'var(--tx-sub)',
              textAlign: 'center'
            }}
          >
            No tags in vault
          </div>
        ) : (
          tree.map((node) => renderTagItem(node, 0))
        )}
      </div>

      {/* Context Menu on Right Click */}
      {contextMenu && (
        <ContextMenu
          isOpen={true}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              id: 'rename-tag',
              label: 'Rename tag',
              onClick: () => handleStartRename(contextMenu.node)
            },
            {
              id: 'merge-tag',
              label: 'Merge tag into...',
              onClick: () => handleStartMerge(contextMenu.node)
            }
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Confirmation & Rename/Merge Modal */}
      {actionModal && (
        <Dialog
          isOpen={true}
          title={actionModal.type === 'rename' ? 'Rename Tag' : 'Merge Tag'}
          onClose={() => {
            if (!actionModal.isExecuting) setActionModal(null);
          }}
        >
          {actionModal.isExecuting ? (
            <div style={{ padding: 'var(--s-3) 0', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--tx)', marginBottom: 'var(--s-2)' }}>
                {actionModal.type === 'rename' ? 'Renaming' : 'Merging'} tag #{actionModal.node.tag}...
              </div>
              <div style={{ fontSize: 'var(--fs-ui)', color: 'var(--tx-sub)' }}>
                Updating {actionModal.node.totalCount} notes in the background. No action needed.
              </div>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 var(--s-3) 0', fontSize: 'var(--fs-ui)', color: 'var(--tx-dim)' }}>
                {actionModal.type === 'rename'
                  ? `Rename #${actionModal.node.tag} across ${actionModal.node.totalCount} ${
                      actionModal.node.totalCount === 1 ? 'note' : 'notes'
                    }? Only the tags key will be updated.`
                  : `Merge #${actionModal.node.tag} across ${actionModal.node.totalCount} ${
                      actionModal.node.totalCount === 1 ? 'note' : 'notes'
                    } into another tag? Only the tags key will be updated.`}
              </p>

              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--fs-ui)',
                  fontWeight: 'var(--fw-bold)',
                  color: 'var(--tx)',
                  marginBottom: 'var(--s-1)'
                }}
              >
                {actionModal.type === 'rename' ? 'New tag name' : 'Target tag name'}
              </label>

              <input
                ref={inputRef}
                type="text"
                value={actionModal.targetTag}
                onChange={(e) =>
                  setActionModal((prev) =>
                    prev ? { ...prev, targetTag: e.target.value, error: null } : null
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleExecuteAction();
                }}
                placeholder={actionModal.type === 'rename' ? 'e.g. Work/V2' : 'e.g. ExistingTag'}
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 var(--s-2)',
                  fontSize: 'var(--fs-ui)',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--bg)',
                  border: actionModal.error ? '1px solid var(--dgr)' : '1px solid var(--b)',
                  borderRadius: 'var(--r-s)',
                  color: 'var(--tx)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              {actionModal.error && (
                <div
                  style={{
                    color: 'var(--dgr)',
                    fontSize: 'var(--fs-ui)',
                    marginTop: 'var(--s-1)'
                  }}
                >
                  {actionModal.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActionModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleExecuteAction()}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--tx-on-accent)',
                    fontWeight: 'var(--fw-bold)'
                  }}
                >
                  {actionModal.type === 'rename' ? 'Rename' : 'Merge'}
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
};
