import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppDataStore } from '../../src/main/store/app-data-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { WindowService } from '../../src/main/services/window-service';
import { IPC_VALIDATORS } from '../../src/shared/ipc';
import { ok } from '../../src/shared/result';

describe('VaultReader - listNotes', () => {
  let tmpVault: string;
  let vaultReader: VaultReader;

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-test-listnotes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });
    vaultReader = new VaultReader();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('scans notes, ignores dot folders and attachments, and sorts by modified descending', async () => {
    // 1. Root notes
    await fs.promises.writeFile(path.join(tmpVault, 'Alpha.md'), 'First note');
    // slight delay for mtime
    await new Promise((r) => setTimeout(r, 20));
    await fs.promises.writeFile(path.join(tmpVault, 'Beta.md'), 'Second note');

    // 2. Subfolder note
    const subDir = path.join(tmpVault, 'Projects');
    await fs.promises.mkdir(subDir, { recursive: true });
    await new Promise((r) => setTimeout(r, 20));
    await fs.promises.writeFile(path.join(subDir, 'Gamma.md'), 'Third note');

    // 3. Dot folder (must be ignored)
    const dotDir = path.join(tmpVault, '.obsidian');
    await fs.promises.mkdir(dotDir, { recursive: true });
    await fs.promises.writeFile(path.join(dotDir, 'workspace.md'), 'Ignored note');

    // 4. Attachments folder (must be ignored)
    const attachDir = path.join(tmpVault, 'attachments');
    await fs.promises.mkdir(attachDir, { recursive: true });
    await fs.promises.writeFile(path.join(attachDir, 'ImageNote.md'), 'Ignored note');

    // 5. Non-markdown file
    await fs.promises.writeFile(path.join(tmpVault, 'data.json'), '{}');

    const res = await vaultReader.listNotes(tmpVault);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const notes = res.value;
    expect(notes.length).toBe(3);

    // Verify paths (normalized to forward slash)
    const paths = notes.map((n) => n.path);
    expect(paths).toContain('Alpha.md');
    expect(paths).toContain('Beta.md');
    expect(paths).toContain('Projects/Gamma.md');
    expect(paths).not.toContain('.obsidian/workspace.md');
    expect(paths).not.toContain('attachments/ImageNote.md');

    // Verify modified desc sorting
    expect(notes[0]?.path).toBe('Projects/Gamma.md');
    expect(notes[1]?.path).toBe('Beta.md');
    expect(notes[2]?.path).toBe('Alpha.md');
  });
});

describe('Startup IPC Validators', () => {
  it('validates app.getStartupState', () => {
    const valid = IPC_VALIDATORS['app.getStartupState']({});
    expect(valid.ok).toBe(true);

    const invalid = IPC_VALIDATORS['app.getStartupState']('invalid');
    expect(invalid.ok).toBe(false);
  });

  it('validates window.firstPaintComplete', () => {
    const valid = IPC_VALIDATORS['window.firstPaintComplete']({});
    expect(valid.ok).toBe(true);
  });

  it('validates window.setPaneWidths', () => {
    const valid = IPC_VALIDATORS['window.setPaneWidths']({
      sidebarWidth: 260,
      listWidth: 340
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value.sidebarWidth).toBe(260);
      expect(valid.value.listWidth).toBe(340);
    }

    const invalid = IPC_VALIDATORS['window.setPaneWidths']({
      sidebarWidth: '260',
      listWidth: 340
    });
    expect(invalid.ok).toBe(false);
  });
});

describe('WindowService and Startup Flow', () => {
  let tmpAppData: string;
  let tmpVault: string;
  let appDataStore: AppDataStore;
  let mockRouter: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(async () => {
    tmpAppData = path.join(os.tmpdir(), `wrriter-test-appdata-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tmpVault = path.join(os.tmpdir(), `wrriter-test-vault-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpAppData, { recursive: true });
    await fs.promises.mkdir(tmpVault, { recursive: true });

    appDataStore = new AppDataStore(tmpAppData, new SafeWriter());

    registeredHandlers = new Map();
    mockRouter = {
      register: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      })
    };
  });

  afterEach(async () => {
    await fs.promises.rm(tmpAppData, { recursive: true, force: true }).catch(() => {});
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('registers startup IPC handlers and provides initial startup state for first paint', async () => {
    // Seed vaults and window state
    await appDataStore.saveVaults([
      { id: 'vault-1', name: 'Work', path: tmpVault, createdAt: 100, lastOpenedAt: 500 }
    ]);
    await appDataStore.saveWindowState({
      width: 1400,
      height: 900,
      isMaximized: false,
      sidebarWidth: 260,
      listWidth: 340
    });
    await appDataStore.saveFirstPaintState('vault-1', {
      openTabs: ['Notes/Meeting.md'],
      activeTabPath: 'Notes/Meeting.md',
      firstPageNotes: [
        { path: 'Notes/Meeting.md', title: 'Meeting', preview: 'Discuss roadmap', modified: 200 }
      ]
    });

    const windowService = new WindowService({
      appDataStore,
      ipcRouter: mockRouter as any,
      vaultReader: new VaultReader()
    });

    expect(mockRouter.register).toHaveBeenCalledWith('app.getStartupState', expect.any(Function));
    expect(mockRouter.register).toHaveBeenCalledWith('window.setPaneWidths', expect.any(Function));
    expect(mockRouter.register).toHaveBeenCalledWith('window.firstPaintComplete', expect.any(Function));

    // Call app.getStartupState
    const getStartupHandler = registeredHandlers.get('app.getStartupState');
    expect(getStartupHandler).toBeDefined();

    const startupRes = await getStartupHandler!({});
    expect(startupRes.ok).toBe(true);
    expect(startupRes.value.theme).toMatch(/light|dark/);
    expect(startupRes.value.accent).toBe('yellow');
    expect(startupRes.value.windowState.sidebarWidth).toBe(260);
    expect(startupRes.value.windowState.listWidth).toBe(340);
  });

  it('handles window.setPaneWidths and updates saved window state', async () => {
    new WindowService({
      appDataStore,
      ipcRouter: mockRouter as any,
      vaultReader: new VaultReader()
    });

    const setPaneWidthsHandler = registeredHandlers.get('window.setPaneWidths');
    expect(setPaneWidthsHandler).toBeDefined();

    const res = await setPaneWidthsHandler!({
      sidebarWidth: 280,
      listWidth: 360
    });
    expect(res.ok).toBe(true);

    // Wait for debounced scheduleSaveWindowState
    await new Promise((r) => setTimeout(r, 600));

    const savedState = await appDataStore.getWindowState();
    expect(savedState.sidebarWidth).toBe(280);
    expect(savedState.listWidth).toBe(360);
  });

  it('triggers idle sync after first paint, bringing first-paint cache up to date with disk', async () => {
    // Seed vault with files on disk
    await fs.promises.writeFile(path.join(tmpVault, 'Note1.md'), 'First note');
    await fs.promises.writeFile(path.join(tmpVault, 'Note2.md'), 'Second note');

    await appDataStore.saveVaults([
      { id: 'vault-sync', name: 'SyncVault', path: tmpVault, createdAt: 100, lastOpenedAt: 500 }
    ]);

    const mockWatcher = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    };
    const watcherFactory = vi.fn((_vaultPath: string) => mockWatcher);

    const windowService = new WindowService({
      appDataStore,
      ipcRouter: mockRouter as any,
      vaultReader: new VaultReader(),
      watcherFactory
    });

    // Invoke getStartupState so activeVault is loaded
    const getStartupHandler = registeredHandlers.get('app.getStartupState');
    await getStartupHandler!({});

    // Invoke firstPaintComplete handler
    const firstPaintHandler = registeredHandlers.get('window.firstPaintComplete');
    await firstPaintHandler!({});

    // Wait for setImmediate idle callback
    await new Promise((r) => setTimeout(r, 100));

    // Verify watcher factory called with active vault path and started
    expect(watcherFactory).toHaveBeenCalledWith(tmpVault);
    expect(mockWatcher.start).toHaveBeenCalled();

    // Verify first paint cache updated on disk
    const updatedCache = await appDataStore.getFirstPaintState('vault-sync');
    expect(updatedCache).not.toBeNull();
    expect(updatedCache?.firstPageNotes.length).toBe(2);
  });
});
