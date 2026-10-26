import React, { useState } from 'react';
import type { VaultInfo } from '../../shared/ipc';
import { NotesTileIcon, FolderAddIcon } from './icons';

export interface FirstRunScreenProps {
  onVaultOpened: (vault: VaultInfo) => void;
}

export const FirstRunScreen: React.FC<FirstRunScreenProps> = ({ onVaultOpened }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Open an existing folder as vault
  const handleOpenFolder = async () => {
    setErrorMessage(null);
    try {
      if (!window.wrriter?.vault?.selectFolderDialog) {
        setErrorMessage('IPC vault service is not ready.');
        return;
      }
      const selectRes = await window.wrriter.vault.selectFolderDialog({});
      if (!selectRes.ok || !selectRes.value) {
        return; // User canceled dialog
      }

      setLoading(true);
      const openRes = await window.wrriter.vault.open({ path: selectRes.value });
      setLoading(false);

      if (!openRes.ok) {
        if (openRes.error.kind === 'ruleViolation') {
          setErrorMessage(openRes.error.rule);
        } else if (openRes.error.kind === 'validation') {
          setErrorMessage(`${openRes.error.field}: ${openRes.error.reason}`);
        } else {
          setErrorMessage('Could not open selected folder as a vault.');
        }
        return;
      }

      onVaultOpened(openRes.value);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || 'Failed to open vault.');
    }
  };

  // 2. Create a new vault in suggested Documents\Wrriter or user-picked location
  const handleCreateVault = async (customPath?: string) => {
    setErrorMessage(null);
    try {
      setLoading(true);
      let targetPath = customPath;

      if (!targetPath) {
        // Create in suggested default location
        const createRes = await window.wrriter.vault.create({});
        setLoading(false);
        if (!createRes.ok) {
          if (createRes.error.kind === 'ruleViolation') {
            setErrorMessage(createRes.error.rule);
          } else {
            setErrorMessage('Could not create default vault.');
          }
          return;
        }
        onVaultOpened(createRes.value);
        return;
      }

      const createRes = await window.wrriter.vault.create({ path: targetPath });
      setLoading(false);
      if (!createRes.ok) {
        if (createRes.error.kind === 'ruleViolation') {
          setErrorMessage(createRes.error.rule);
        } else {
          setErrorMessage('Could not create vault at specified path.');
        }
        return;
      }
      onVaultOpened(createRes.value);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || 'Failed to create vault.');
    }
  };

  const handlePickCustomLocationAndCreate = async () => {
    setErrorMessage(null);
    try {
      const selectRes = await window.wrriter.vault.selectFolderDialog({});
      if (!selectRes.ok || !selectRes.value) {
        return;
      }
      await handleCreateVault(selectRes.value);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to select location.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        width: '100%',
        padding: '32px 24px',
        backgroundColor: 'var(--canvas)',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: 'var(--pop)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          boxShadow: 'var(--shadow)',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'lin var(--t-fast) var(--ease-arrive) both'
        }}
      >
        {/* App Logo / Mark */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent), var(--vault-p))',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            fontWeight: 800,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            marginBottom: 20
          }}
        >
          W
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            color: 'var(--tx)'
          }}
        >
          Welcome to Wrriter
        </h1>

        <p
          style={{
            fontSize: 'var(--fs-ui)',
            lineHeight: 1.5,
            color: 'var(--tx2)',
            margin: '0 0 28px',
            maxWidth: 440
          }}
        >
          Wrriter keeps your notes as plain markdown files on your drive.
          No proprietary database, no conversions, completely local and fast.
        </p>

        {/* Error Alert Notice */}
        {errorMessage && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--dgr)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20,
              textAlign: 'left',
              color: 'var(--dgr)',
              fontSize: 'var(--fs-small)',
              lineHeight: 1.4
            }}
          >
            <strong>Note:</strong> {errorMessage}
          </div>
        )}

        {/* Two Primary Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          {/* 1. Open Folder as Vault */}
          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              width: '100%',
              padding: '18px 20px',
              backgroundColor: 'var(--tile)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              cursor: loading ? 'wait' : 'pointer',
              textAlign: 'left',
              transition: 'all var(--t-fast) var(--ease-move)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'var(--pop)',
                border: '1px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--tx)',
                flexShrink: 0
              }}
            >
              <NotesTileIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>
                Open folder as vault
              </div>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--tx2)' }}>
                Choose any existing folder of notes on your computer
              </div>
            </div>
          </button>

          {/* 2. Create New Vault */}
          <button
            type="button"
            onClick={() => handleCreateVault()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              width: '100%',
              padding: '18px 20px',
              backgroundColor: 'var(--tile)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              cursor: loading ? 'wait' : 'pointer',
              textAlign: 'left',
              transition: 'all var(--t-fast) var(--ease-move)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'var(--pop)',
                border: '1px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--tx)',
                flexShrink: 0
              }}
            >
              <FolderAddIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>
                Create a new vault
              </div>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--tx2)' }}>
                Create in suggested <code style={{ fontSize: '0.9em', color: 'var(--tx)' }}>Documents\Wrriter</code>
              </div>
            </div>
          </button>
        </div>

        {/* Alternative custom location link */}
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={handlePickCustomLocationAndCreate}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--tx2)',
              fontSize: 'var(--fs-small)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px'
            }}
          >
            Or choose a different location for a new vault...
          </button>
        </div>
      </div>
    </div>
  );
};
