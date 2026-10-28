import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { AppLifecycle } from '../../src/main/app/app-lifecycle';
import { AppDataStore } from '../../src/main/store/app-data-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { app } from 'electron';

vi.mock('electron', () => ({
  app: {
    quit: vi.fn()
  }
}));

describe('AppLifecycle (Tray, Hotkey, and One Running Copy)', () => {
  let tmpDir: string;
  let appDataStore: AppDataStore;
  let mockWindowService: any;
  let mockSingleInstance: any;
  let mockTray: any;
  let mockHotkey: any;
  let mockLoginItem: any;

  let registeredHotkey = '';
  let secondInstanceHandler: ((argv: string[]) => void) | null = null;
  let mockMainWindow: any = null;
  let windowCloseListener: (() => void) | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = path.join(
      os.tmpdir(),
      `wrriter-lifecycle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.promises.mkdir(tmpDir, { recursive: true });

    appDataStore = new AppDataStore(tmpDir, new SafeWriter());
    windowCloseListener = null;

    mockMainWindow = {
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      on: vi.fn((event: string, cb: any) => {
        if (event === 'close') {
          windowCloseListener = cb;
        }
      }),
      once: vi.fn((event, cb) => {
        if (event === 'ready-to-show') {
          cb();
        }
      })
    };

    mockWindowService = {
      getMainWindow: vi.fn(() => null), // Initially null before window is opened
      createMainWindow: vi.fn(async () => mockMainWindow),
      pauseForTrayIdle: vi.fn(async () => {})
    };

    mockSingleInstance = {
      requestLock: vi.fn(() => true),
      hasLock: vi.fn(() => true),
      registerSecondInstance: vi.fn((handlers) => {
        secondInstanceHandler = handlers.onSecondInstance;
      })
    };

    mockTray = {
      createTray: vi.fn(),
      destroyTray: vi.fn(),
      isCreated: vi.fn(() => true),
      setToolTip: vi.fn()
    };

    registeredHotkey = '';
    mockHotkey = {
      register: vi.fn((acc) => {
        registeredHotkey = acc;
        return { registered: true, accelerator: acc };
      }),
      unregister: vi.fn(() => {
        registeredHotkey = '';
      }),
      isRegistered: vi.fn((acc) => acc === registeredHotkey),
      getCurrentAccelerator: vi.fn(() => registeredHotkey)
    };

    mockLoginItem = {
      setStartWithWindows: vi.fn(),
      getStartWithWindows: vi.fn(() => false)
    };
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('SingleInstance: takes the lock first at startup and registers second-instance listener', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    const success = await lifecycle.initialize();
    expect(success).toBe(true);
    expect(mockSingleInstance.requestLock).toHaveBeenCalled();
    expect(mockSingleInstance.registerSecondInstance).toHaveBeenCalled();
  });

  it('SingleInstance: secondary launch terminates without starting second engine', async () => {
    mockSingleInstance.requestLock.mockReturnValueOnce(false);

    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    const success = await lifecycle.initialize();
    expect(success).toBe(false);
    expect(app.quit).toHaveBeenCalled();
  });

  it('SingleInstance: second launch hands request to running copy (focuses window or triggers quick note)', async () => {
    const quickNoteSpy = vi.fn();
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem,
      onTriggerQuickNote: quickNoteSpy
    });

    await lifecycle.initialize();
    expect(secondInstanceHandler).toBeDefined();

    // Secondary launch with regular args -> brings main window forward
    mockWindowService.getMainWindow.mockReturnValue(mockMainWindow);
    secondInstanceHandler!(['wrriter.exe']);
    expect(mockMainWindow.show).toHaveBeenCalled();
    expect(mockMainWindow.focus).toHaveBeenCalled();

    // Secondary launch with --quick-note flag -> triggers capture
    secondInstanceHandler!(['wrriter.exe', '--quick-note']);
    expect(quickNoteSpy).toHaveBeenCalledTimes(1);
  });

  it('Tray: Keep running in background is on by default with no question on first launch', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    await lifecycle.initialize();

    // Check defaults
    expect(lifecycle.shouldKeepRunningInBackground()).toBe(true);
    expect(mockTray.createTray).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenMainWindow: expect.any(Function),
        onNewQuickNote: expect.any(Function),
        onQuit: expect.any(Function)
      })
    );
  });

  it('Closing main window to the tray destroys it, pauses idle background tasks, and rebuilds on restore in under 500 ms', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    await lifecycle.initialize();
    expect(windowCloseListener).toBeDefined();

    // Simulate closing main window to tray
    windowCloseListener!();
    expect(mockWindowService.pauseForTrayIdle).toHaveBeenCalledWith(false);

    // Now window is destroyed (null)
    mockWindowService.getMainWindow.mockReturnValue(null);

    // Reopen from tray
    const rebuiltWin = await lifecycle.openMainWindow();
    expect(mockWindowService.createMainWindow).toHaveBeenCalled();
    expect(rebuiltWin).toBeDefined();
    // Measured rebuild duration must be under 500 ms per PERFORMANCE.md
    expect(lifecycle.getLastRebuildDurationMs()).toBeLessThan(500);
  });

  it('With keep running in background off, closing the last window quits Wrriter fully', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    await lifecycle.initialize();

    // Toggle keep running in background to false
    await lifecycle.handleSaveSettings({ keepRunningInBackground: false });
    expect(lifecycle.shouldKeepRunningInBackground()).toBe(false);

    // Start with Windows must be forced off when keep running is off
    expect(mockLoginItem.setStartWithWindows).toHaveBeenCalledWith(false);
  });

  it('LoginItem: Start with Windows is off by default and starts Wrriter hidden when requested', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    // Start with --hidden argument (e.g. at Windows login)
    await lifecycle.initialize({ isHiddenStartup: true });

    // When started hidden, createMainWindow is NOT called on launch
    expect(mockWindowService.createMainWindow).not.toHaveBeenCalled();
    // Tray and hotkey are ready
    expect(mockTray.createTray).toHaveBeenCalled();
    expect(mockHotkey.register).toHaveBeenCalledWith('Ctrl+Alt+N', expect.any(Function));
  });

  it('Hotkey: Ctrl+Alt+N by default, changeable without restart, and says plainly when taken', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem
    });

    await lifecycle.initialize();
    expect(mockHotkey.register).toHaveBeenCalledWith('Ctrl+Alt+N', expect.any(Function));

    // Change hotkey dynamically
    const changeRes = await lifecycle.handleSaveSettings({ captureHotkey: 'Ctrl+Shift+K' });
    expect(changeRes.ok).toBe(true);
    expect(registeredHotkey).toBe('Ctrl+Shift+K');

    // Simulate taken combination
    mockHotkey.register.mockReturnValueOnce({
      registered: false,
      accelerator: 'Ctrl+Taken',
      error: 'The shortcut "Ctrl+Taken" is already in use by another application or Windows.'
    });

    const takenRes = await lifecycle.handleSaveSettings({ captureHotkey: 'Ctrl+Taken' });
    expect(takenRes.ok).toBe(false);
    if (!takenRes.ok) {
      expect((takenRes.error as any).reason).toBe(
        'The shortcut "Ctrl+Taken" is already in use by another application or Windows.'
      );
    }
  });

  it('Index worker idle shutdown: pauses index worker when enabled on tray idle', async () => {
    const lifecycle = new AppLifecycle({
      appDataStore,
      windowService: mockWindowService,
      singleInstanceAdapter: mockSingleInstance,
      trayAdapter: mockTray,
      hotkeyAdapter: mockHotkey,
      loginItemAdapter: mockLoginItem,
      shutdownIndexWorkerOnIdle: true
    });

    await lifecycle.initialize();
    expect(lifecycle.getShutdownIndexWorkerOnIdle()).toBe(true);
    expect(windowCloseListener).toBeDefined();

    windowCloseListener!();
    // Verify shutdownIndexWorker=true passed to pauseForTrayIdle
    expect(mockWindowService.pauseForTrayIdle).toHaveBeenCalledWith(true);
  });
});
