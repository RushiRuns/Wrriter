import React, { useState, useEffect, useRef } from 'react';
import type { FolderNode } from '../../shared/ipc/contracts';
import {
  FolderClosedIcon,
  FolderOpenIcon,
  ChevronRightIcon
} from './icons';
import { getFileNameValidationError } from '../../shared/domain/names';

export interface FolderTreeProps {
  folders: readonly FolderNode[];
  selectedFolder: string | null;
  onSelectFolder: (folderRelPath: string | null) => void;
  totalVaultNotesCount: number;
  onRefresh: () => Promise<void>;
}

interface ContextMenuState {
  x: number;
  y: number;
  folder: FolderNode | null; // null means vault root
}

interface ConfirmDeleteState {
  folder: FolderNode;
}

interface NewFolderModalState {
  parentRelPath: string | null;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  totalVaultNotesCount,
  onRefresh
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ConfirmDeleteState | null>(null);
  const [newFolderModal, setNewFolderModal] = useState<NewFolderModalState | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Close context menu on window click or Escape
  useEffect(() => {
    const handleOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRenamingPath(null);
        setDeleteConfirm(null);
        setNewFolderModal(null);
      }
    };

    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Focus rename input on rename start
  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  const toggleExpanded = (relPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
      } else {
        next.add(relPath);
      }
      return next;
    });
  };

  const handleStartRename = (folder: FolderNode) => {
    setContextMenu(null);
    setRenamingPath(folder.relPath);
    setRenameValue(folder.name);
    setRenameError(null);
  };

  const commitRename = async (folder: FolderNode) => {
    const trimmed = renameValue.trim();
    if (trimmed === folder.name) {
      setRenamingPath(null);
      setRenameError(null);
      return;
    }

    const validationErr = getFileNameValidationError(trimmed);
    if (validationErr) {
      setRenameError(validationErr);
      return;
    }

    const parentDir = folder.parentPath;
    const newRelPath = parentDir ? `${parentDir}/${trimmed}` : trimmed;

    if (window.wrriter?.folder?.rename) {
      const res = await window.wrriter.folder.rename({
        oldPath: folder.relPath,
        newPath: newRelPath
      });
      if (res.ok) {
        setRenamingPath(null);
        setRenameError(null);
        await onRefresh();
        if (selectedFolder === folder.relPath) {
          onSelectFolder(newRelPath);
        }
      } else {
        setRenameError(res.error.kind === 'ruleViolation' ? res.error.rule : 'Failed to rename folder');
      }
    }
  };

  const handleCreateFolderSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim();
    const validationErr = getFileNameValidationError(trimmed);
    if (validationErr) {
      setNewFolderError(validationErr);
      return;
    }

    const parent = newFolderModal?.parentRelPath;
    const folderPath = parent ? `${parent}/${trimmed}` : trimmed;

    if (window.wrriter?.folder?.create) {
      const res = await window.wrriter.folder.create({ path: folderPath });
      if (res.ok) {
        setNewFolderModal(null);
        setNewFolderName('');
        setNewFolderError(null);
        if (parent) {
          setExpandedPaths((prev) => new Set(prev).add(parent));
        }
        await onRefresh();
        onSelectFolder(folderPath);
      } else {
        setNewFolderError(res.error.kind === 'ruleViolation' ? res.error.rule : 'Failed to create folder');
      }
    }
  };

  const handleDeleteFolderSubmit = async () => {
    if (!deleteConfirm) return;
    const folder = deleteConfirm.folder;

    if (window.wrriter?.folder?.delete) {
      const res = await window.wrriter.folder.delete({ path: folder.relPath });
      if (res.ok) {
        setDeleteConfirm(null);
        await onRefresh();
        if (selectedFolder === folder.relPath) {
          onSelectFolder(null);
        }
      }
    }
  };

  const renderFolderItem = (folder: FolderNode, depth: number = 0) => {
    const isSelected = selectedFolder === folder.relPath;
    const isExpanded = expandedPaths.has(folder.relPath);
    const hasChildren = folder.children && folder.children.length > 0;
    const isRenaming = renamingPath === folder.relPath;

    return (
      <React.Fragment key={folder.relPath}>
        <div
          className={`fr ${isSelected ? 'sel' : ''} ${isExpanded ? 'open' : ''}`}
          style={{
            marginLeft: depth * 24,
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={() => onSelectFolder(folder.relPath)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, folder });
          }}
          onKeyDown={(e) => {
            if (e.key === 'F2') {
              e.preventDefault();
              handleStartRename(folder);
            }
          }}
          tabIndex={0}
        >
          {/* Folder Icon Toggle */}
          {hasChildren ? (
            <button
              type="button"
              className="ftg fslot"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(folder.relPath);
              }}
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <FolderClosedIcon />
              <FolderOpenIcon />
              <ChevronRightIcon className="ic cv" />
            </button>
          ) : (
            <div className="fslot">
              <FolderClosedIcon />
            </div>
          )}

          {/* Folder Name or Inline Rename */}
          {isRenaming ? (
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  setRenameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(folder);
                  if (e.key === 'Escape') {
                    setRenamingPath(null);
                    setRenameError(null);
                  }
                }}
                onBlur={() => void commitRename(folder)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  height: 24,
                  padding: '0 6px',
                  fontSize: 'var(--fs-ui)',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--pop)',
                  border: renameError ? '1px solid var(--dgr)' : '1px solid var(--accent)',
                  borderRadius: 4,
                  color: 'var(--tx)',
                  outline: 'none'
                }}
              />
              {renameError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 60,
                    fontSize: 11,
                    color: 'var(--dgr)',
                    backgroundColor: 'var(--pop)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    boxShadow: 'var(--shadow)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {renameError}
                </div>
              )}
            </div>
          ) : (
            <span className="nm">{folder.name}</span>
          )}

          {/* Note Count */}
          <span className="ct">{folder.noteCount}</span>
        </div>

        {/* Subfolders (children loaded on expand) */}
        {hasChildren && isExpanded && (
          <div>
            {folder.children.map((child) => renderFolderItem(child as FolderNode, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      className="tree"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
      onContextMenu={(e) => {
        // Right-clicking empty space in tree opens root context menu
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, folder: null });
      }}
    >
      {/* 1. All Notes root item */}
      <div
        className={`fr ${selectedFolder === null ? 'sel' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectFolder(null)}
        tabIndex={0}
      >
        <div className="fslot">
          <FolderClosedIcon />
        </div>
        <span className="nm">Notes</span>
        <span className="ct">{totalVaultNotesCount}</span>
      </div>

      {/* 2. Folders hierarchy */}
      {folders.map((folder) => renderFolderItem(folder, 0))}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="lmenu"
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 150),
            minWidth: 200,
            zIndex: 100,
            animation: 'lin var(--t-fast) var(--ease-arrive) both'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <li
            className="vi"
            style={{ cursor: 'pointer', height: 32, padding: '0 8px', borderRadius: 8 }}
            onClick={() => {
              const parentPath = contextMenu.folder?.relPath ?? null;
              setContextMenu(null);
              setNewFolderModal({ parentRelPath: parentPath });
              setNewFolderName('');
              setNewFolderError(null);
            }}
          >
            <span className="vn">New folder</span>
          </li>

          {contextMenu.folder && (
            <>
              <li
                className="vi"
                style={{ cursor: 'pointer', height: 32, padding: '0 8px', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}
                onClick={() => handleStartRename(contextMenu.folder!)}
              >
                <span className="vn">Rename</span>
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--tx3)' }}>F2</span>
              </li>

              <li className="vmd" style={{ height: 1, margin: '4px 0', backgroundColor: 'var(--line)' }} />

              <li
                className="vi"
                style={{ cursor: 'pointer', height: 32, padding: '0 8px', borderRadius: 8, color: 'var(--dgr)' }}
                onClick={() => {
                  const targetFolder = contextMenu.folder!;
                  setContextMenu(null);
                  setDeleteConfirm({ folder: targetFolder });
                }}
              >
                <span className="vn" style={{ color: 'var(--dgr)' }}>Delete folder</span>
              </li>
            </>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Delete Folder */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'center'
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              width: 380,
              backgroundColor: 'var(--pop)',
              borderRadius: 'var(--r-l)',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--line)',
              padding: 24,
              animation: 'lin var(--t-fast) var(--ease-arrive) both'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>
              Delete folder
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 'var(--fs-ui)', color: 'var(--tx2)', lineHeight: 1.4 }}>
              Delete folder "{deleteConfirm.folder.name}" and its {deleteConfirm.folder.noteCount} notes? This will send them to the Recycle Bin.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="fb"
                onClick={() => setDeleteConfirm(null)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid var(--div)',
                  background: 'none',
                  color: 'var(--tx)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteFolderSubmit()}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--dgr)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'center'
          }}
          onClick={() => setNewFolderModal(null)}
        >
          <form
            onSubmit={(e) => void handleCreateFolderSubmit(e)}
            style={{
              width: 380,
              backgroundColor: 'var(--pop)',
              borderRadius: 'var(--r-l)',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--line)',
              padding: 24,
              animation: 'lin var(--t-fast) var(--ease-arrive) both'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>
              New folder
            </h3>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                autoFocus
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  setNewFolderError(null);
                }}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  fontSize: 'var(--fs-ui)',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--pop)',
                  border: newFolderError ? '1px solid var(--dgr)' : '1px solid var(--div)',
                  borderRadius: 8,
                  color: 'var(--tx)',
                  outline: 'none'
                }}
              />
              {newFolderError && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--dgr)' }}>
                  {newFolderError}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="fb"
                onClick={() => setNewFolderModal(null)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid var(--div)',
                  background: 'none',
                  color: 'var(--tx)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--onacc)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
