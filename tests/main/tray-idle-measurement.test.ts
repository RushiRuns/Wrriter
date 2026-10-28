import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { AppLifecycle } from '../../src/main/app/app-lifecycle';
import { AppDataStore } from '../../src/main/store/app-data-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { WindowService } from '../../src/main/services/window-service';
import { IndexClient } from '../../src/main/services/index-client';

vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    getPath: vi.fn(() => os.tmpdir()),
    requestSingleInstanceLock: vi.fn(() => true),
    on: vi.fn(),
    setLoginItemSettings: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false }))
  },
  globalShortcut: {
    register: vi.fn(() => true),
    unregister: vi.fn(),
    isRegistered: vi.fn(() => true)
  },
  Tray: class {
    setToolTip() {}
    setContextMenu() {}
    on() { return this; }
    destroy() {}
    isDestroyed() { return false; }
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({}))
  },
  nativeImage: {
    createFromDataURL: vi.fn(() => ({}))
  }
}));

describe('Tray Idle State & Index Worker Idle Shutdown Measurement (PERFORMANCE.md)', () => {
  let tmpDir: string;
  let tmpVault: string;
  let appDataStore: AppDataStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = path.join(
      os.tmpdir(),
      `wrriter-idle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    tmpVault = path.join(tmpDir, 'Vault');
    await fs.promises.mkdir(tmpVault, { recursive: true });

    appDataStore = new AppDataStore(tmpDir, new SafeWriter());
    await appDataStore.saveVaults([
      { id: 'vault-1', name: 'Vault', path: tmpVault, createdAt: Date.now(), lastOpenedAt: Date.now() }
    ]);
    await appDataStore.saveWindowState({
      width: 1200,
      height: 800,
      isMaximized: false,
      sidebarWidth: 248,
      listWidth: 320
    });
    await appDataStore.saveFirstPaintState('vault-1', {
      openTabs: ['Note1.md'],
      activeTabPath: 'Note1.md',
      firstPageNotes: [
        { path: 'Note1.md', title: 'Note 1', preview: 'Content', modified: Date.now() }
      ]
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('verifies that while idle in tray, no polling or watchers run', async () => {
    let watcherRunning = false;
    const mockWatcher = {
      start: vi.fn(async () => {
        watcherRunning = true;
      }),
      stop: vi.fn(async () => {
        watcherRunning = false;
      })
    };

    const windowService = new WindowService({
      appDataStore,
      ipcRouter: { register: vi.fn() } as any,
      watcherFactory: () => mockWatcher
    });

    // Populate active vault
    await windowService.handleActiveVaultChanged({
      id: 'vault-1',
      name: 'Vault',
      path: tmpVault,
      createdAt: Date.now(),
      lastOpenedAt: Date.now()
    });

    expect(mockWatcher.start).toHaveBeenCalled();
    expect(watcherRunning).toBe(true);

    // Pause for tray idle
    await windowService.pauseForTrayIdle(false);

    expect(mockWatcher.stop).toHaveBeenCalled();
    expect(watcherRunning).toBe(false);
  });

  it('measures memory and restore duration: with vs without index worker kept alive', async () => {
    let isWorkerAlive = false;

    const mockIndexClient = {
      start: vi.fn(async () => {
        isWorkerAlive = true;
      }),
      close: vi.fn(async () => {
        isWorkerAlive = false;
      })
    } as unknown as IndexClient;

    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      on: vi.fn(),
      once: vi.fn((event, cb) => {
        if (event === 'ready-to-show') cb();
      })
    };

    const windowService = new WindowService({
      appDataStore,
      ipcRouter: { register: vi.fn() } as any,
      indexClient: mockIndexClient
    });

    vi.spyOn(windowService, 'createMainWindow').mockImplementation(async () => mockWindow as any);

    // Scenario A: Index worker KEPT ALIVE while idle in tray
    const lifecycleA = new AppLifecycle({
      appDataStore,
      windowService,
      shutdownIndexWorkerOnIdle: false
    });
    await lifecycleA.initialize();
    await mockIndexClient.start('vault-1', tmpVault, tmpDir);
    expect(isWorkerAlive).toBe(true);

    await windowService.pauseForTrayIdle(false);
    expect(isWorkerAlive).toBe(true); // Worker kept alive in background
    const memIdleA = process.memoryUsage().heapUsed;

    const startRebuildA = performance.now();
    await lifecycleA.openMainWindow();
    const durationA = performance.now() - startRebuildA;

    // Scenario B: Index worker SHUT DOWN while idle in tray
    const lifecycleB = new AppLifecycle({
      appDataStore,
      windowService,
      shutdownIndexWorkerOnIdle: true
    });
    await lifecycleB.initialize();
    await mockIndexClient.start('vault-1', tmpVault, tmpDir);
    expect(isWorkerAlive).toBe(true);

    await windowService.pauseForTrayIdle(true);
    expect(isWorkerAlive).toBe(false); // Worker shut down
    const memIdleB = process.memoryUsage().heapUsed;

    const startRebuildB = performance.now();
    await lifecycleB.openMainWindow();
    const durationB = performance.now() - startRebuildB;

    // Both restore scenarios must complete in under 500 ms (PERFORMANCE.md target)
    expect(durationA).toBeLessThan(500);
    expect(durationB).toBeLessThan(500);

    console.log('\n--- Idle in Tray & Index Worker Shutdown Measurements ---');
    console.log(`Scenario A (Worker Kept Alive): Heap Idle: ${(memIdleA / 1024 / 1024).toFixed(2)} MB, Reopen Duration: ${durationA.toFixed(2)} ms`);
    console.log(`Scenario B (Worker Shut Down):   Heap Idle: ${(memIdleB / 1024 / 1024).toFixed(2)} MB, Reopen Duration: ${durationB.toFixed(2)} ms`);
    console.log('---------------------------------------------------------\n');
  });
});
