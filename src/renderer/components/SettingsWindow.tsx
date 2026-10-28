import React, { useState, useEffect, useRef } from 'react';
import type { AppSettingsContract } from '../../shared/ipc/contracts';
import { SHORTCUTS, type ShortcutDefinition } from '../../shared/shortcuts';
import { CloseIcon, WebLinkGlobeIcon } from './icons';
import { crossFadeTransition, broadcastThemeChange } from '../motion';

export interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettingsContract;
  onSaveSettings: (patch: Partial<AppSettingsContract>) => Promise<void>;
  onMarginChangeLive?: (margin: number) => void;
  defaultTab?: 'appearance' | 'system' | 'sync' | 'shortcuts';
}

type SettingsTab = 'appearance' | 'system' | 'sync' | 'shortcuts';

const ACCENTS: Array<{
  id: AppSettingsContract['accent'];
  label: string;
  cssClass: string;
}> = [
  { id: 'yellow', label: 'Yellow', cssClass: 'yellow' },
  { id: 'sky', label: 'Sky', cssClass: 'sky' },
  { id: 'coral', label: 'Coral', cssClass: 'coral' },
  { id: 'mint', label: 'Mint', cssClass: 'mint' },
  { id: 'lilac', label: 'Lilac', cssClass: 'lilac' }
];

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSaveSettings,
  onMarginChangeLive,
  defaultTab = 'appearance'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  const [theme, setTheme] = useState(currentSettings.theme);
  const [accent, setAccent] = useState(currentSettings.accent);
  const [motion, setMotion] = useState(currentSettings.motion);
  const [noteMargin, setNoteMargin] = useState(currentSettings.noteMargin);
  const [keepRunning, setKeepRunning] = useState(currentSettings.keepRunningInBackground);
  const [startWithWindows, setStartWithWindows] = useState(currentSettings.startWithWindows);
  const [captureHotkey, setCaptureHotkey] = useState(currentSettings.captureHotkey || 'Ctrl+Alt+N');
  const [hotkeyStatusMessage, setHotkeyStatusMessage] = useState<string | null>(null);
  const [hotkeyIsError, setHotkeyIsError] = useState<boolean>(false);
  const [shortcutFilter, setShortcutFilter] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync state if currentSettings changes externally
  useEffect(() => {
    setTheme(currentSettings.theme);
    setAccent(currentSettings.accent);
    setMotion(currentSettings.motion);
    setNoteMargin(currentSettings.noteMargin);
    setKeepRunning(currentSettings.keepRunningInBackground);
    setStartWithWindows(currentSettings.startWithWindows);
    setCaptureHotkey(currentSettings.captureHotkey || 'Ctrl+Alt+N');
  }, [currentSettings]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle Theme Change with Slow Cross-Fade
  const handleThemeChange = (nextTheme: AppSettingsContract['theme']) => {
    setTheme(nextTheme);
    void crossFadeTransition(() => {
      let effectiveTheme = nextTheme;
      if (nextTheme === 'follow-windows' && typeof window !== 'undefined' && window.matchMedia) {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    });
    broadcastThemeChange('theme', nextTheme);
    void onSaveSettings({ theme: nextTheme });
  };

  // Handle Accent Change with Slow Cross-Fade
  const handleAccentChange = (nextAccent: AppSettingsContract['accent']) => {
    setAccent(nextAccent);
    void crossFadeTransition(() => {
      document.documentElement.setAttribute('data-accent', nextAccent);
    });
    broadcastThemeChange('accent', nextAccent);
    void onSaveSettings({ accent: nextAccent });
  };

  // Handle Motion Change
  const handleMotionChange = (nextMotion: AppSettingsContract['motion']) => {
    setMotion(nextMotion);
    if (nextMotion === 'reduced') {
      document.documentElement.setAttribute('data-motion', 'reduced');
    } else {
      document.documentElement.removeAttribute('data-motion');
    }
    void onSaveSettings({ motion: nextMotion });
  };

  // Handle Note Margin Slider & Reset
  const handleMarginChange = (val: number) => {
    setNoteMargin(val);
    onMarginChangeLive?.(val);
    void onSaveSettings({ noteMargin: val });
  };

  const handleResetMargin = () => {
    handleMarginChange(24);
  };

  // Handle System Toggles
  const handleToggleKeepRunning = (checked: boolean) => {
    setKeepRunning(checked);
    const newStartWithWin = checked ? startWithWindows : false;
    if (!checked) {
      setStartWithWindows(false);
    }
    void onSaveSettings({
      keepRunningInBackground: checked,
      startWithWindows: newStartWithWin
    });
  };

  const handleToggleStartWithWindows = (checked: boolean) => {
    if (!keepRunning) return;
    setStartWithWindows(checked);
    void onSaveSettings({ startWithWindows: checked });
  };

  // Handle opening Syncthing URL safely
  const handleOpenSyncthing = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = 'https://syncthing.net';
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Filtered shortcuts
  const filteredShortcuts = SHORTCUTS.filter((s: ShortcutDefinition) => {
    if (!shortcutFilter) return true;
    const q = shortcutFilter.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.key.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="wr-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="wr-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wr-settings-title-heading"
      >
        {/* Header */}
        <div className="wr-settings-header">
          <h2 id="wr-settings-title-heading" className="wr-settings-title">
            Settings
          </h2>
          <button
            type="button"
            className="ib"
            onClick={onClose}
            title="Close (Escape)"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="wr-settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`wr-settings-tab ${activeTab === 'appearance' ? 'on' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'system'}
            className={`wr-settings-tab ${activeTab === 'system' ? 'on' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sync'}
            className={`wr-settings-tab ${activeTab === 'sync' ? 'on' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            Sync
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shortcuts'}
            className={`wr-settings-tab ${activeTab === 'shortcuts' ? 'on' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            Shortcuts
          </button>
        </div>

        {/* Content Body */}
        <div className="wr-settings-body">
          {/* 1. APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <>
              {/* Theme */}
              <div className="wr-settings-section">
                <div className="wr-settings-label">Theme</div>
                <div className="wr-settings-desc">
                  Select your interface theme or follow Windows system mode
                </div>
                <div className="wr-settings-pills">
                  <button
                    type="button"
                    className={`wr-settings-pill ${theme === 'follow-windows' ? 'on' : ''}`}
                    onClick={() => handleThemeChange('follow-windows')}
                  >
                    Follow Windows
                  </button>
                  <button
                    type="button"
                    className={`wr-settings-pill ${theme === 'light' ? 'on' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={`wr-settings-pill ${theme === 'dark' ? 'on' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    Dark
                  </button>
                </div>
              </div>

              {/* Accent */}
              <div className="wr-settings-section">
                <div className="wr-settings-label">Accent</div>
                <div className="wr-settings-desc">
                  Highlight and selection colour across the window shell
                </div>
                <div className="wr-settings-accents">
                  {ACCENTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`wr-settings-accent-btn ${accent === item.id ? 'on' : ''}`}
                      onClick={() => handleAccentChange(item.id)}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <div className={`wr-settings-accent-dot ${item.cssClass}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Motion */}
              <div className="wr-settings-section">
                <div className="wr-settings-label">Motion</div>
                <div className="wr-settings-desc">
                  Control UI animations and transition effects
                </div>
                <div className="wr-settings-pills">
                  <button
                    type="button"
                    className={`wr-settings-pill ${motion === 'follow-windows' ? 'on' : ''}`}
                    onClick={() => handleMotionChange('follow-windows')}
                  >
                    Follow Windows
                  </button>
                  <button
                    type="button"
                    className={`wr-settings-pill ${motion === 'reduced' ? 'on' : ''}`}
                    onClick={() => handleMotionChange('reduced')}
                  >
                    Reduced
                  </button>
                  <button
                    type="button"
                    className={`wr-settings-pill ${motion === 'full' ? 'on' : ''}`}
                    onClick={() => handleMotionChange('full')}
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Note margin */}
              <div className="wr-settings-section">
                <div className="wr-settings-label">Note margin</div>
                <div className="wr-settings-desc">
                  Horizontal side padding for note text with live preview
                </div>
                <div className="wr-settings-margin-row">
                  <input
                    type="range"
                    min={16}
                    max={96}
                    step={4}
                    value={noteMargin}
                    className="wr-settings-slider"
                    aria-label="Note margin slider"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setNoteMargin(val);
                      onMarginChangeLive?.(val);
                    }}
                    onMouseUp={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      handleMarginChange(val);
                    }}
                    onTouchEnd={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      handleMarginChange(val);
                    }}
                  />
                  <div className="wr-settings-val">{noteMargin} px</div>
                  <button
                    type="button"
                    className="wr-settings-btn"
                    onClick={handleResetMargin}
                    title="Reset to 24 px default"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 2. SYSTEM TAB */}
          {activeTab === 'system' && (
            <>
              {/* Keep running in background */}
              <div className="wr-settings-section">
                <label className="wr-settings-toggle-row">
                  <input
                    type="checkbox"
                    checked={keepRunning}
                    className="wr-settings-checkbox"
                    onChange={(e) => handleToggleKeepRunning(e.target.checked)}
                  />
                  <div>
                    <div className="wr-settings-label">
                      Keep running in the background
                    </div>
                    <div className="wr-settings-desc">
                      Closing the main window leaves Wrriter ready in the Windows notification area for instant capture
                    </div>
                  </div>
                </label>
              </div>

              {/* Start with Windows */}
              <div className="wr-settings-section">
                <label className={`wr-settings-toggle-row ${!keepRunning ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={startWithWindows}
                    disabled={!keepRunning}
                    className="wr-settings-checkbox"
                    onChange={(e) => handleToggleStartWithWindows(e.target.checked)}
                  />
                  <div>
                    <div className="wr-settings-label">
                      Start with Windows
                    </div>
                    <div className="wr-settings-desc">
                      Launch Wrriter hidden at Windows startup. Offered only while keep running in the background is on
                    </div>
                  </div>
                </label>
              </div>

              {/* Quick capture shortcut */}
              <div className="wr-settings-section">
                <div className="wr-settings-label">Quick capture global shortcut</div>
                <div className="wr-settings-desc">
                  Open quick note capture from any application (default Ctrl+Alt+N)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
                  <input
                    type="text"
                    className="wr-settings-shortcuts-search"
                    style={{ width: '180px' }}
                    value={captureHotkey}
                    onChange={(e) => setCaptureHotkey(e.target.value)}
                    placeholder="e.g. Ctrl+Alt+N"
                  />
                  <button
                    type="button"
                    className="wr-settings-btn"
                    onClick={async () => {
                      setHotkeyStatusMessage(null);
                      setHotkeyIsError(false);
                      await onSaveSettings({ captureHotkey });
                      const status = await window.wrriter?.app?.getHotkeyStatus?.({ hotkey: captureHotkey });
                      if (status && status.ok) {
                        if (!status.value.registered) {
                          setHotkeyIsError(true);
                          setHotkeyStatusMessage(status.value.error || `Shortcut "${captureHotkey}" is taken.`);
                        } else {
                          setHotkeyIsError(false);
                          setHotkeyStatusMessage(`Shortcut registered: ${status.value.accelerator}`);
                        }
                      }
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="wr-settings-btn"
                    onClick={async () => {
                      setCaptureHotkey('Ctrl+Alt+N');
                      setHotkeyStatusMessage(null);
                      setHotkeyIsError(false);
                      await onSaveSettings({ captureHotkey: 'Ctrl+Alt+N' });
                      const status = await window.wrriter?.app?.getHotkeyStatus?.({ hotkey: 'Ctrl+Alt+N' });
                      if (status && status.ok && status.value.registered) {
                        setHotkeyStatusMessage('Shortcut reset to Ctrl+Alt+N');
                      }
                    }}
                  >
                    Reset
                  </button>
                </div>
                {hotkeyStatusMessage && (
                  <div
                    style={{
                      fontSize: '12px',
                      marginTop: 'var(--s-1)',
                      color: hotkeyIsError ? 'var(--cor)' : 'var(--tx2)'
                    }}
                  >
                    {hotkeyStatusMessage}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. SYNC TAB */}
          {activeTab === 'sync' && (
            <div className="wr-settings-section">
              <div className="wr-settings-label">Vault synchronization</div>
              <div className="wr-settings-card">
                <div className="wr-settings-desc">
                  Wrriter stores notes as plain markdown files on disk. To sync notes between computers or mobile devices, use Syncthing to sync your vault folder. Wrriter works beside Syncthing without accounts, servers, or cloud dependencies.
                </div>
                <div>
                  <a
                    href="https://syncthing.net"
                    className="wl web"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleOpenSyncthing}
                  >
                    <span className="globe-icon" aria-hidden="true">
                      <WebLinkGlobeIcon style={{ width: 14, height: 14 }} />
                    </span>
                    <span className="u">https://syncthing.net</span>
                  </a>
                </div>
                <div className="wr-settings-desc" style={{ fontSize: '12px' }}>
                  Syncthing conflict copies show as ordinary notes so no text is ever lost.
                </div>
              </div>
            </div>
          )}

          {/* 4. SHORTCUTS TAB */}
          {activeTab === 'shortcuts' && (
            <div className="wr-settings-section">
              <input
                type="text"
                className="wr-settings-shortcuts-search"
                placeholder="Search shortcuts..."
                value={shortcutFilter}
                onChange={(e) => setShortcutFilter(e.target.value)}
              />
              <div className="wr-settings-desc">
                Read-only list of all {SHORTCUTS.length} keyboard shortcuts
              </div>
              <div className="wr-settings-shortcuts-list">
                {filteredShortcuts.map((s) => (
                  <div key={s.id} className="wr-settings-shortcut-row">
                    <div className="wr-settings-shortcut-info">
                      <span className="wr-settings-shortcut-title">{s.title}</span>
                      <span className="wr-settings-shortcut-desc">{s.description}</span>
                    </div>
                    <kbd className="wr-settings-shortcut-kbd">{s.key}</kbd>
                  </div>
                ))}
                {filteredShortcuts.length === 0 && (
                  <div className="wr-settings-desc" style={{ padding: 'var(--s-4) 0', textAlign: 'center' }}>
                    No matching shortcuts found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsWindow;
