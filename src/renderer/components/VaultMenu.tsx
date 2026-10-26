import React, { useState, useEffect, useRef } from 'react';
import type { VaultInfo, VaultListItem } from '../../shared/ipc';
import { CheckmarkIcon, FolderAddIcon } from './icons';
import { ContextMenu } from './menu/ContextMenu';

export interface VaultMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeVaultId: string | null;
  onVaultSwitched: (vault: VaultInfo) => void;
  onVaultListChanged: () => void;
  onShowFirstRun: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  vault: VaultListItem;
}

export const VaultMenu: React.FC<VaultMenuProps> = ({
  isOpen,
  onClose,
  activeVaultId,
  onVaultSwitched,
  onVaultListChanged,
  onShowFirstRun
}) => {
  const [vaults, setVaults] = useState<readonly VaultListItem[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingVaultId, setRenamingVaultId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const menuRef = useRef<HTMLUListElement | null>(null);

  const loadVaults = async () => {
    if (window.wrriter?.vault?.list) {
      const res = await window.wrriter.vault.list();
      if (res.ok) {
        setVaults(res.value);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadVaults();
      setContextMenu(null);
      setRenamingVaultId(null);
      setShowAddOptions(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCloseAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ except?: string }>;
      if (customEvent.detail?.except !== 'vault-menu') {
        onClose();
      }
    };
    window.addEventListener('wrriter:close-all-menus', handleCloseAll);
    return () => window.removeEventListener('wrriter:close-all-menus', handleCloseAll);
  }, [onClose]);

  if (!isOpen) return null;

  // Handle switching vault
  const handleSelectVault = async (vault: VaultListItem) => {
    if (vault.id === activeVaultId) {
      onClose();
      return;
    }
    if (!vault.isAvailable) {
      setErrorMsg(`Vault "${vault.name}" is unavailable: folder is missing or drive is unplugged.`);
      return;
    }

    try {
      const res = await window.wrriter.vault.switch({ vaultId: vault.id });
      if (res.ok) {
        onVaultSwitched(res.value);
        onClose();
      } else {
        setErrorMsg(res.error.kind === 'ruleViolation' ? res.error.rule : 'Failed to switch vault.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error switching vault.');
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, vault: VaultListItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      vault
    });
  };

  // 1. Rename display name
  const handleStartRename = (vault: VaultListItem) => {
    setContextMenu(null);
    setRenamingVaultId(vault.id);
    setRenameText(vault.name);
  };

  const handleSaveRename = async (vaultId: string) => {
    const trimmed = renameText.trim();
    if (!trimmed) {
      setRenamingVaultId(null);
      return;
    }
    await window.wrriter.vault.rename({ vaultId, newName: trimmed });
    setRenamingVaultId(null);
    await loadVaults();
    onVaultListChanged();
  };

  // 2. Show in File Explorer
  const handleShowInExplorer = async (vaultId: string) => {
    setContextMenu(null);
    await window.wrriter.vault.showInExplorer({ vaultId });
  };

  // 3. Remove vault from Wrriter (never deletes files)
  const handleRemoveVault = async (vaultId: string) => {
    setContextMenu(null);
    await window.wrriter.vault.remove({ vaultId });
    await loadVaults();
    onVaultListChanged();

    // Check if remaining vaults exist
    const listRes = await window.wrriter.vault.list();
    if (listRes.ok && listRes.value.length === 0) {
      onShowFirstRun();
      onClose();
    }
  };

  // 4. Locate unavailable vault
  const handleLocateVault = async (vaultId: string) => {
    setContextMenu(null);
    const selectRes = await window.wrriter.vault.selectFolderDialog({});
    if (selectRes.ok && selectRes.value) {
      const locateRes = await window.wrriter.vault.locate({ vaultId, newPath: selectRes.value });
      if (locateRes.ok) {
        await loadVaults();
        onVaultListChanged();
      } else {
        setErrorMsg(locateRes.error.kind === 'ruleViolation' ? locateRes.error.rule : 'Failed to relocate vault.');
      }
    }
  };

  // 5. Add vault actions
  const handleAddOpenFolder = async () => {
    const selectRes = await window.wrriter.vault.selectFolderDialog({});
    if (selectRes.ok && selectRes.value) {
      const openRes = await window.wrriter.vault.open({ path: selectRes.value });
      if (openRes.ok) {
        onVaultSwitched(openRes.value);
        onClose();
      } else {
        setErrorMsg(openRes.error.kind === 'ruleViolation' ? openRes.error.rule : 'Cannot open folder as vault.');
      }
    }
  };

  const handleAddCreateNew = async () => {
    const selectRes = await window.wrriter.vault.selectFolderDialog({});
    if (selectRes.ok && selectRes.value) {
      const createRes = await window.wrriter.vault.create({ path: selectRes.value });
      if (createRes.ok) {
        onVaultSwitched(createRes.value);
        onClose();
      } else {
        setErrorMsg(createRes.error.kind === 'ruleViolation' ? createRes.error.rule : 'Cannot create vault.');
      }
    }
  };

  return (
    <>
      {/* Scrim to capture outside clicks and close menu */}
      <div
        className="vscrim"
        onClick={() => {
          if (contextMenu) {
            setContextMenu(null);
          } else {
            onClose();
          }
        }}
      />

      {/* Floating Vault Menu */}
      <ul
        ref={menuRef}
        className="vmenu"
        style={{
          width: 260,
          minWidth: 240,
          maxHeight: 380,
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <li className="vmh">Vaults</li>

        {/* Optional Error Banner */}
        {errorMsg && (
          <li
            style={{
              padding: '6px 8px',
              margin: '0 4px 6px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 6,
              color: 'var(--dgr)',
              fontSize: 'var(--fs-small)',
              lineHeight: 1.3
            }}
          >
            {errorMsg}
          </li>
        )}

        {/* Vault List Items */}
        {vaults.map((vault) => {
          const isActive = vault.id === activeVaultId;
          const isRenaming = renamingVaultId === vault.id;

          return (
            <li
              key={vault.id}
              className={`vi ${!vault.isAvailable ? 'dg' : ''}`}
              aria-checked={isActive}
              onClick={() => {
                if (!isRenaming) handleSelectVault(vault);
              }}
              onContextMenu={(e) => handleContextMenu(e, vault)}
              style={{
                cursor: 'pointer',
                opacity: vault.isAvailable ? 1 : 0.7
              }}
            >
              {/* Initials Circle */}
              <div
                className={`vc ${isActive ? 'p' : 'w'}`}
                style={{
                  backgroundColor: vault.isAvailable
                    ? isActive
                      ? 'var(--vault-p)'
                      : 'var(--tile)'
                    : 'var(--dgr)',
                  color: vault.isAvailable && !isActive ? 'var(--tx)' : '#fff'
                }}
              >
                {vault.name[0]?.toUpperCase() || 'V'}
              </div>

              {/* Vault Name or Inline Rename Input */}
              {isRenaming ? (
                <input
                  type="text"
                  value={renameText}
                  autoFocus
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveRename(vault.id);
                    if (e.key === 'Escape') setRenamingVaultId(null);
                  }}
                  onBlur={() => void handleSaveRename(vault.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: 24,
                    padding: '0 4px',
                    fontSize: 'var(--fs-ui)',
                    backgroundColor: 'var(--pop)',
                    border: '1px solid var(--accent)',
                    borderRadius: 4,
                    color: 'var(--tx)'
                  }}
                />
              ) : (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span className="vn">{vault.name}</span>
                  {!vault.isAvailable && (
                    <span style={{ fontSize: '10px', color: 'var(--dgr)' }}>
                      (Unavailable)
                    </span>
                  )}
                </div>
              )}

              {/* Checkmark Indicator */}
              <span className={`ck ${isActive ? 'on' : ''}`}>
                <CheckmarkIcon />
              </span>
            </li>
          );
        })}

        {/* Divider */}
        <li className="vmd" />

        {/* Add Vault Options */}
        {showAddOptions ? (
          <>
            <li
              className="vi"
              onClick={handleAddOpenFolder}
              style={{ cursor: 'pointer', paddingLeft: 12 }}
            >
              <span className="vn" style={{ fontSize: 'var(--fs-small)' }}>
                Open folder as vault...
              </span>
            </li>
            <li
              className="vi"
              onClick={handleAddCreateNew}
              style={{ cursor: 'pointer', paddingLeft: 12 }}
            >
              <span className="vn" style={{ fontSize: 'var(--fs-small)' }}>
                Create new vault...
              </span>
            </li>
          </>
        ) : (
          <li
            className="vi add"
            onClick={() => setShowAddOptions(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="vc" style={{ backgroundColor: 'var(--tile)', color: 'var(--tx2)' }}>
              +
            </div>
            <span className="vn">Add vault...</span>
          </li>
        )}
      </ul>

      {/* Vault Right-Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          isOpen={true}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.vault.isAvailable
              ? [
                  {
                    id: 'rename',
                    label: 'Rename display name',
                    onClick: () => handleStartRename(contextMenu.vault)
                  },
                  {
                    id: 'explorer',
                    label: 'Show in File Explorer',
                    onClick: () => handleShowInExplorer(contextMenu.vault.id)
                  },
                  { id: 'div-1', label: '', isDivider: true },
                  {
                    id: 'remove',
                    label: 'Remove from Wrriter',
                    isDanger: true,
                    onClick: () => handleRemoveVault(contextMenu.vault.id)
                  }
                ]
              : [
                  {
                    id: 'locate',
                    label: 'Locate vault...',
                    onClick: () => handleLocateVault(contextMenu.vault.id)
                  },
                  { id: 'div-1', label: '', isDivider: true },
                  {
                    id: 'remove',
                    label: 'Remove from list',
                    isDanger: true,
                    onClick: () => handleRemoveVault(contextMenu.vault.id)
                  }
                ]
          }
        />
      )}
    </>
  );
};
