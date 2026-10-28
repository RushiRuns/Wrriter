import React, { useState, useEffect, useRef } from 'react';
import type { FolderNode } from '../../shared/ipc/contracts';
import {
  FolderClosedIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  PlusIcon
} from './icons';
import { ContextMenu } from './menu/ContextMenu';
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

interface CreatingFolderState {
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
  const [creatingFolder, setCreatingFolder] = useState<CreatingFolderState | null>(null);
  const [createFolderName, setCreateFolderName] = useState('');
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);

  // Close context menu and inputs on window click, Escape, or close-all event
  useEffect(() => {
    const handleOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRenamingPath(null);
        setRenameError(null);
        setDeleteConfirm(null);
        setCreatingFolder(null);
        setCreateFolderName('');
        setCreateFolderError(null);
      }
    };
    const handleCloseAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ except?: string }>;
      if (
        customEvent.detail?.except !== 'folder-context-menu' &&
        customEvent.detail?.except !== 'context-menu'
      ) {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wrriter:close-all-menus', handleCloseAll);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wrriter:close-all-menus', handleCloseAll);
    };
  }, []);

  // Focus rename input on rename start
  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  // Focus create folder input on creation start
  useEffect(() => {
    if (creatingFolder && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creatingFolder]);

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
    cancelCreateFolder();
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

  const startCreateFolder = (parentRelPath: string | null) => {
    setContextMenu(null);
    setRenamingPath(null);
    setRenameError(null);
    setCreatingFolder({ parentRelPath });
    setCreateFolderName('');
    setCreateFolderError(null);
    if (parentRelPath) {
      setExpandedPaths((prev) => new Set(prev).add(parentRelPath));
    }
  };

  const cancelCreateFolder = () => {
    setCreatingFolder(null);
    setCreateFolderName('');
    setCreateFolderError(null);
  };

  const commitCreateFolder = async () => {
    if (!creatingFolder) return;
    const trimmed = createFolderName.trim();
    if (!trimmed) {
      cancelCreateFolder();
      return;
    }

    const validationErr = getFileNameValidationError(trimmed);
    if (validationErr) {
      setCreateFolderError(validationErr);
      return;
    }

    const parent = creatingFolder.parentRelPath;
    const folderPath = parent ? `${parent}/${trimmed}` : trimmed;

    if (window.wrriter?.folder?.create) {
      const res = await window.wrriter.folder.create({ path: folderPath });
      if (res.ok) {
        cancelCreateFolder();
        if (parent) {
          setExpandedPaths((prev) => new Set(prev).add(parent));
        }
        await onRefresh();
        onSelectFolder(folderPath);
      } else {
        setCreateFolderError(res.error.kind === 'ruleViolation' ? res.error.rule : 'Failed to create folder');
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
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(folder.relPath);
          return next;
        });
        await onRefresh();
        if (selectedFolder === folder.relPath) {
          onSelectFolder(null);
        }
      }
    }
  };

  const renderInlineCreateRow = (depth: number) => {
    return (
      <div
        key="__new_folder_input__"
        className="fr"
        style={{
          marginLeft: depth * 24,
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fslot">
          <FolderClosedIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <input
            ref={createInputRef}
            type="text"
            placeholder="Folder name"
            value={createFolderName}
            onChange={(e) => {
              setCreateFolderName(e.target.value);
              setCreateFolderError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitCreateFolder();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelCreateFolder();
              }
            }}
            onBlur={() => void commitCreateFolder()}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              height: 24,
              padding: '0 6px',
              fontSize: 'var(--fs-ui)',
              fontFamily: 'inherit',
              backgroundColor: 'var(--pop)',
              border: createFolderError ? '1px solid var(--dgr)' : '1px solid var(--accent)',
              borderRadius: 'var(--r-s)',
              color: 'var(--tx)',
              outline: 'none'
            }}
          />
          {createFolderError && (
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
                borderRadius: 'var(--r-s)',
                boxShadow: 'var(--shadow)',
                whiteSpace: 'nowrap'
              }}
            >
              {createFolderError}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFolderItem = (folder: FolderNode, depth: number = 0) => {
    const isSelected = selectedFolder === folder.relPath;
    const hasChildren = Boolean(folder.children && folder.children.length > 0);
    const isCreatingHere = creatingFolder?.parentRelPath === folder.relPath;
    const isExpanded = (hasChildren || isCreatingHere) && expandedPaths.has(folder.relPath);
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
          {hasChildren || isCreatingHere ? (
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
                  borderRadius: 'var(--r-s)',
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
                    borderRadius: 'var(--r-s)',
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

        {/* Subfolders or inline creation row */}
        {(hasChildren || isCreatingHere) && isExpanded && (
          <div>
            {isCreatingHere && renderInlineCreateRow(depth + 1)}
            {hasChildren && folder.children.map((child) => renderFolderItem(child as FolderNode, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* FOLDERS Header with hover + button */}
      <div className="lbl lbl-header">
        <span>FOLDERS</span>
        <button
          type="button"
          className="lbl-btn"
          title="New folder"
          aria-label="New folder"
          onClick={(e) => {
            e.stopPropagation();
            startCreateFolder(null);
          }}
        >
          <PlusIcon />
        </button>
      </div>

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

        {/* Root-level inline folder creation row */}
        {creatingFolder?.parentRelPath === null && renderInlineCreateRow(0)}

        {/* 2. Folders hierarchy */}
        {folders.map((folder) => renderFolderItem(folder, 0))}

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            isOpen={true}
            menuId="folder-context-menu"
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                id: 'new-folder',
                label: 'New folder',
                onClick: () => {
                  const parentPath = contextMenu.folder?.relPath ?? null;
                  startCreateFolder(parentPath);
                }
              },
              ...(contextMenu.folder
                ? [
                    {
                      id: 'rename',
                      label: 'Rename',
                      shortcut: 'F2',
                      onClick: () => handleStartRename(contextMenu.folder!)
                    },
                    {
                      id: 'explorer',
                      label: 'Show in File Explorer',
                      onClick: () => {
                        if (contextMenu.folder?.relPath && window.wrriter?.showItemInFolder) {
                          void window.wrriter.showItemInFolder(contextMenu.folder.relPath);
                        }
                      }
                    },
                    { id: 'div-1', label: '', isDivider: true },
                    {
                      id: 'delete',
                      label: 'Delete folder',
                      isDanger: true,
                      onClick: () => {
                        setDeleteConfirm({ folder: contextMenu.folder! });
                      }
                    }
                  ]
                : [])
            ]}
          />
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
      </div>
    </>
  );
};
