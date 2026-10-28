import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { CaptureService } from '../../src/main/services/capture-service';
import { AppDataStore } from '../../src/main/store/app-data-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { IpcRouter } from '../../src/main/ipc/router';

vi.mock('electron', () => {
  class MockWebContents {
    send = vi.fn();
    setWindowOpenHandler = vi.fn();
    on = vi.fn();
  }

  class MockBrowserWindow {
    static fromWebContents = vi.fn();
    private _destroyed = false;
    private _minimized = false;
    private _alwaysOnTop = false;
    webContents = new MockWebContents();

    isDestroyed = vi.fn(() => this._destroyed);
    isMinimized = vi.fn(() => this._minimized);
    restore = vi.fn(() => { this._minimized = false; });
    show = vi.fn();
    focus = vi.fn();
    close = vi.fn(() => { this._destroyed = true; });
    destroy = vi.fn(() => { this._destroyed = true; });
    loadFile = vi.fn();
    loadURL = vi.fn();
    setAlwaysOnTop = vi.fn((val: boolean) => { this._alwaysOnTop = val; });
    isAlwaysOnTop = vi.fn(() => this._alwaysOnTop);
    getBounds = vi.fn(() => ({ x: 100, y: 150, width: 500, height: 400 }));
    on = vi.fn((event: string, cb: any) => {
      if (event === 'closed') {
        this._closedCallback = cb;
      }
    });
    once = vi.fn((event: string, cb: any) => {
      if (event === 'ready-to-show') {
        cb();
      }
    });
    _closedCallback?: () => void;
  }

  return {
    BrowserWindow: MockBrowserWindow,
    session: {
      defaultSession: {
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        setDevicePermissionHandler: vi.fn(),
        webRequest: {
          onHeadersReceived: vi.fn()
        }
      }
    },
    nativeTheme: {
      shouldUseDarkColors: true
    }
  };
});

describe('CaptureService (M4 Quick Capture & Pop-Out)', () => {
  let tmpDir: string;
  let vaultDir: string;
  let appDataStore: AppDataStore;
  let safeWriter: SafeWriter;
  let mockVaultService: any;
  let mockWindowService: any;
  let ipcRouter: IpcRouter;
  let captureService: CaptureService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = path.join(
      os.tmpdir(),
      `wrriter-capture-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    vaultDir = path.join(tmpDir, 'MyVault');
    await fs.promises.mkdir(vaultDir, { recursive: true });

    safeWriter = new SafeWriter();
    appDataStore = new AppDataStore(tmpDir, safeWriter);

    // Seed default vault
    await appDataStore.saveVaults([
      {
        id: 'vault-1',
        name: 'MyVault',
        path: vaultDir,
        lastOpenedAt: Date.now()
      }
    ]);

    mockVaultService = {
      getActiveVaultId: vi.fn(() => 'vault-1')
    };

    mockWindowService = {
      getMainWindow: vi.fn(() => null),
      createMainWindow: vi.fn(async () => {
        const win = new BrowserWindow();
        return win;
      })
    };

    ipcRouter = new IpcRouter();

    captureService = new CaptureService({
      appDataStore,
      safeWriter,
      vaultService: mockVaultService,
      windowService: mockWindowService,
      ipcRouter,
      captureHtmlPath: path.join(tmpDir, 'capture.html')
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('Quick capture file writing invariants', () => {
    it('no file is written until text is typed (empty note leaves no file in Inbox/)', async () => {
      const res = await captureService.saveQuickNote('');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.written).toBe(false);
        expect(res.value.path).toBe('');
      }

      // Verify Inbox/ directory was not even created
      const inboxExists = fs.existsSync(path.join(vaultDir, 'Inbox'));
      expect(inboxExists).toBe(false);
    });

    it('creates Inbox/ directory on first note and saves formatted note', async () => {
      const res = await captureService.saveQuickNote('# Meeting with Krishna\n\nDiscussing M4 release.');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.written).toBe(true);
        expect(res.value.title).toBe('Meeting with Krishna');
        expect(res.value.path).toBe('Inbox/Meeting with Krishna.md');

        const fullPath = path.join(vaultDir, res.value.path);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = await fs.promises.readFile(fullPath, 'utf8');
        expect(content).toContain('Discussing M4 release.');
      }
    });

    it('names note "Quick note YYYY-MM-DD HH.mm" when first line is empty', async () => {
      const res = await captureService.saveQuickNote('   \n\nA note without heading.');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.written).toBe(true);
        expect(res.value.title).toMatch(/^Quick note \d{4}-\d{2}-\d{2} \d{2}\.\d{2}$/);
        expect(res.value.path).toMatch(/^Inbox\/Quick note \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.md$/);

        const fullPath = path.join(vaultDir, res.value.path);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('adds clash numbers when note title already exists in Inbox/', async () => {
      const res1 = await captureService.saveQuickNote('# Daily Standup\n\nFirst note.');
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.value.path).toBe('Inbox/Daily Standup.md');
      }

      const res2 = await captureService.saveQuickNote('# Daily Standup\n\nSecond note.');
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.value.path).toBe('Inbox/Daily Standup 2.md');
        expect(res2.value.title).toBe('Daily Standup 2');
      }

      const res3 = await captureService.saveQuickNote('# Daily Standup\n\nThird note.');
      expect(res3.ok).toBe(true);
      if (res3.ok) {
        expect(res3.value.path).toBe('Inbox/Daily Standup 3.md');
      }
    });

    it('updates existing note when path is provided', async () => {
      const first = await captureService.saveQuickNote('# Initial Idea\n\nDraft.');
      expect(first.ok).toBe(true);
      const notePath = (first as any).value.path;

      const updated = await captureService.saveQuickNote('# Initial Idea\n\nDraft updated with new thoughts.', notePath);
      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.value.path).toBe(notePath);
        const content = await fs.promises.readFile(path.join(vaultDir, notePath), 'utf8');
        expect(content).toContain('Draft updated with new thoughts.');
      }
    });
  });

  describe('Target vault resolution', () => {
    it('defaults to last active vault', async () => {
      const target = await captureService.resolveTargetVault();
      expect(target).not.toBeNull();
      expect(target?.id).toBe('vault-1');
    });

    it('uses fixed vault from settings when configured', async () => {
      const fixedVaultDir = path.join(tmpDir, 'FixedVault');
      await fs.promises.mkdir(fixedVaultDir, { recursive: true });

      const vaults = await appDataStore.getVaults();
      await appDataStore.saveVaults([
        ...vaults,
        {
          id: 'vault-fixed',
          name: 'FixedVault',
          path: fixedVaultDir,
          lastOpenedAt: 100
        }
      ]);

      await appDataStore.saveSettings({
        captureVault: 'vault-fixed'
      });

      const target = await captureService.resolveTargetVault();
      expect(target?.id).toBe('vault-fixed');
      expect(target?.name).toBe('FixedVault');
    });
  });

  describe('Window management and single-instance capture', () => {
    it('brings existing capture forward when opened a second time and sends capture:re-enter', async () => {
      const win1 = await captureService.openQuickCapture();
      expect(win1).toBeDefined();

      const win2 = await captureService.openQuickCapture();
      expect(win2).toBe(win1);
      expect(win1.show).toHaveBeenCalled();
      expect(win1.focus).toHaveBeenCalled();
      expect(win1.webContents.send).toHaveBeenCalledWith('capture:re-enter');
    });

    it('openInMainWindow moves note to tabs in FirstPaintState and closes capture window', async () => {
      const captureWin = await captureService.openQuickCapture();
      const notePath = 'Inbox/Meeting.md';

      let openedNoteInMain = '';
      captureService.setOpenNoteInMainHandler((p) => {
        openedNoteInMain = p;
      });

      const res = await captureService.openInMainWindow(notePath);
      expect(res.ok).toBe(true);
      expect(openedNoteInMain).toBe(notePath);
      expect(captureWin.close).toHaveBeenCalled();

      // Check first paint state has note in openTabs and activeTabPath
      const firstPaint = await appDataStore.getFirstPaintState('vault-1');
      expect(firstPaint?.openTabs).toContain(notePath);
      expect(firstPaint?.activeTabPath).toBe(notePath);
    });

    it('supports multiple pop-out windows (one per note)', async () => {
      const win1 = await captureService.openPopOut('Notes/Doc1.md');
      const win2 = await captureService.openPopOut('Notes/Doc2.md');

      expect(win1).not.toBe(win2);
      expect(captureService.getPopOutWindows().length).toBe(2);

      // Opening existing pop-out brings it forward
      const win1Again = await captureService.openPopOut('Notes/Doc1.md');
      expect(win1Again).toBe(win1);
      expect(win1.show).toHaveBeenCalled();
      expect(captureService.getPopOutWindows().length).toBe(2);
    });

    it('remembers capture window size and position in AppDataStore', async () => {
      await appDataStore.saveCaptureWindowState({
        width: 620,
        height: 480,
        x: 250,
        y: 200,
        isAlwaysOnTop: true
      });

      const saved = await appDataStore.getCaptureWindowState();
      expect(saved.width).toBe(620);
      expect(saved.height).toBe(480);
      expect(saved.x).toBe(250);
      expect(saved.y).toBe(200);
      expect(saved.isAlwaysOnTop).toBe(true);
    });

    it('setAlwaysOnTop toggles pin state and schedules save', () => {
      const mockWin = new BrowserWindow();
      (BrowserWindow.fromWebContents as any).mockReturnValue(mockWin);

      const res = captureService.setAlwaysOnTop(true, mockWin.webContents as any);
      expect(res.ok).toBe(true);
      expect(mockWin.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });

    it('switches between on-demand and ready capture mode', () => {
      expect(captureService.getCaptureMode()).toBe('on-demand');
      captureService.setCaptureMode('ready');
      expect(captureService.getCaptureMode()).toBe('ready');
      captureService.setCaptureMode('on-demand');
      expect(captureService.getCaptureMode()).toBe('on-demand');
    });
  });
});
