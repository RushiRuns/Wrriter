import { BrowserWindow, nativeTheme } from 'electron';
import * as path from 'path';
import { AppDataStore, type AppSettings, type WindowState, type KnownVault, type FirstPaintState } from '../store/app-data-store';
import { createSecureWindow } from '../windows/window-factory';
import { IpcRouter } from '../ipc/router';
import { VaultReader } from './vault-reader';
import { WatcherAdapter } from './watcher-adapter';
import { JobService } from './job-service';
import { Result, ok, err } from '../../shared/result';
import type { StartupState, AccentName, SetPaneWidthsArgs } from '../../shared/ipc';

export interface WindowServiceOptions {
  appDataStore: AppDataStore;
  ipcRouter: IpcRouter;
  vaultReader?: VaultReader | undefined;
  watcherAdapter?: { start(): Promise<void>; stop(): Promise<void> } | undefined;
  watcherFactory?: ((vaultPath: string) => { start(): Promise<void>; stop(): Promise<void> }) | undefined;
  jobService?: JobService | undefined;
  htmlPath?: string | undefined;
}

export class WindowService {
  private readonly appDataStore: AppDataStore;
  private readonly ipcRouter: IpcRouter;
  private readonly vaultReader: VaultReader;
  private readonly watcherAdapter?: { start(): Promise<void>; stop(): Promise<void> };
  private readonly watcherFactory?: (vaultPath: string) => { start(): Promise<void>; stop(): Promise<void> };
  private readonly jobService?: JobService;
  private readonly htmlPath: string;

  private mainWindow: BrowserWindow | null = null;
  private currentWindowState: WindowState | null = null;
  private currentSettings: AppSettings | null = null;
  private activeVault: KnownVault | null = null;
  private firstPaintState: FirstPaintState | null = null;

  private boundsSaveTimer: NodeJS.Timeout | null = null;
  private isIdleWorkStarted = false;

  constructor(options: WindowServiceOptions) {
    this.appDataStore = options.appDataStore;
    this.ipcRouter = options.ipcRouter;
    this.vaultReader = options.vaultReader ?? new VaultReader();
    if (options.watcherAdapter) {
      this.watcherAdapter = options.watcherAdapter;
    }
    if (options.watcherFactory) {
      this.watcherFactory = options.watcherFactory;
    }
    if (options.jobService) {
      this.jobService = options.jobService;
    }
    this.htmlPath = options.htmlPath ?? path.join(__dirname, '../renderer/windows/main/index.html');

    this.registerIpcHandlers();
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Creates the primary application window adhering strictly to Startup requirements:
   * 1. Read settings before window creation.
   * 2. Determine effective theme and create window hidden with the theme's background colour.
   * 3. Show window only when ready-to-show (first frame ready) with zero white flash.
   */
  async createMainWindow(): Promise<BrowserWindow> {
    // 1. Read settings, window state, and vaults
    const [settings, windowState, vaults] = await Promise.all([
      this.appDataStore.getSettings(),
      this.appDataStore.getWindowState(),
      this.appDataStore.getVaults()
    ]);

    this.currentSettings = settings;
    this.currentWindowState = windowState;

    // Determine active vault: latest opened vault
    if (vaults.length > 0) {
      const sorted = vaults.slice().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      this.activeVault = sorted[0] ?? null;
    } else {
      this.activeVault = null;
    }

    // 2. Load cached first-paint state for the active vault if available
    if (this.activeVault) {
      this.firstPaintState = await this.appDataStore.getFirstPaintState(this.activeVault.id);
    } else {
      this.firstPaintState = null;
    }

    // 3. Compute effective theme and canvas background color
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'follow-windows' && (nativeTheme?.shouldUseDarkColors ?? true));
    const effectiveTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
    const backgroundColor = effectiveTheme === 'dark' ? '#1E1E1E' : '#F5F4F2';

    // 4. Create window hidden in theme background color
    const win = createSecureWindow({
      width: windowState.width,
      height: windowState.height,
      minWidth: 800,
      minHeight: 600,
      ...(windowState.x !== undefined ? { x: windowState.x } : {}),
      ...(windowState.y !== undefined ? { y: windowState.y } : {}),
      backgroundColor,
      htmlPath: this.htmlPath,
      query: {
        theme: effectiveTheme,
        accent: settings.accent,
        sidebarWidth: String(windowState.sidebarWidth || 248),
        listWidth: String(windowState.listWidth || 320),
        activeVaultId: this.activeVault?.id ?? ''
      }
    });

    this.mainWindow = win;

    // 5. Restore maximized state on show
    win.once('ready-to-show', () => {
      if (windowState.isMaximized) {
        win.maximize();
      }
    });

    // 6. Track window movements and resizing
    const trackBounds = () => {
      if (!win.isDestroyed() && !win.isMinimized()) {
        const bounds = win.getBounds();
        this.currentWindowState = {
          ...this.currentWindowState!,
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: win.isMaximized()
        };
        this.scheduleSaveWindowState();
      }
    };

    win.on('resize', trackBounds);
    win.on('move', trackBounds);
    win.on('maximize', trackBounds);
    win.on('unmaximize', trackBounds);

    win.on('closed', () => {
      this.mainWindow = null;
      if (this.boundsSaveTimer) {
        clearTimeout(this.boundsSaveTimer);
        this.boundsSaveTimer = null;
      }
    });

    return win;
  }

  /**
   * Debounced save of window state to app data store.
   */
  private scheduleSaveWindowState(): void {
    if (this.boundsSaveTimer) {
      clearTimeout(this.boundsSaveTimer);
    }
    this.boundsSaveTimer = setTimeout(async () => {
      if (this.currentWindowState) {
        await this.appDataStore.saveWindowState(this.currentWindowState);
      }
    }, 500);
  }

  /**
   * Registers IPC handlers for startup state and window controls.
   */
  private registerIpcHandlers(): void {
    // 1. Startup State for First Paint
    this.ipcRouter.register('app.getStartupState', async () => {
      if (!this.currentSettings) {
        this.currentSettings = await this.appDataStore.getSettings();
      }
      if (!this.currentWindowState) {
        this.currentWindowState = await this.appDataStore.getWindowState();
      }
      if (!this.activeVault) {
        const vaults = await this.appDataStore.getVaults();
        if (vaults.length > 0) {
          const sorted = vaults.slice().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
          this.activeVault = sorted[0] ?? null;
        }
      }
      if (this.activeVault && !this.firstPaintState) {
        this.firstPaintState = await this.appDataStore.getFirstPaintState(this.activeVault.id);
      }

      const isDark =
        this.currentSettings.theme === 'dark' ||
        (this.currentSettings.theme === 'follow-windows' && (nativeTheme?.shouldUseDarkColors ?? true));
      const effectiveTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

      const state: StartupState = {
        theme: effectiveTheme,
        accent: this.currentSettings.accent as AccentName,
        windowState: {
          width: this.currentWindowState.width,
          height: this.currentWindowState.height,
          isMaximized: this.currentWindowState.isMaximized,
          sidebarWidth: this.currentWindowState.sidebarWidth,
          listWidth: this.currentWindowState.listWidth
        },
        activeVault: this.activeVault
          ? {
              vaultId: this.activeVault.id,
              name: this.activeVault.name,
              path: this.activeVault.path
            }
          : null,
        firstPaintNotes: this.firstPaintState?.firstPageNotes ?? []
      };

      return ok(state);
    });

    // 2. Set Pane Widths
    this.ipcRouter.register('window.setPaneWidths', async (args: SetPaneWidthsArgs) => {
      if (!this.currentWindowState) {
        this.currentWindowState = await this.appDataStore.getWindowState();
      }
      this.currentWindowState.sidebarWidth = args.sidebarWidth;
      this.currentWindowState.listWidth = args.listWidth;
      this.scheduleSaveWindowState();
      return ok(undefined);
    });

    // 3. First Paint Completed -> Start Idle Tasks
    this.ipcRouter.register('window.firstPaintComplete', async () => {
      this.triggerIdleWork();
      return ok(undefined);
    });
  }

  /**
   * After the first paint, when idle: start the watcher and bring the list up to date.
   */
  triggerIdleWork(): void {
    if (this.isIdleWorkStarted) return;
    this.isIdleWorkStarted = true;

    // Use setImmediate to defer until the current event loop iteration completes
    setImmediate(async () => {
      if (!this.activeVault) return;

      // 1. Start file watcher
      if (this.watcherFactory && this.activeVault) {
        try {
          const watcher = this.watcherFactory(this.activeVault.path);
          await watcher.start();
        } catch {
          // Ignore watcher startup errors
        }
      } else if (this.watcherAdapter) {
        try {
          await this.watcherAdapter.start();
        } catch {
          // Ignore watcher startup errors
        }
      }

      // 2. Sync note list from disk to update first paint cache
      try {
        const notesRes = await this.vaultReader.listNotes(this.activeVault.path);
        if (notesRes.ok) {
          const firstPageNotes = notesRes.value.slice(0, 50);
          const updatedState: FirstPaintState = {
            openTabs: this.firstPaintState?.openTabs ?? [],
            activeTabPath: this.firstPaintState?.activeTabPath ?? null,
            firstPageNotes
          };
          this.firstPaintState = updatedState;
          await this.appDataStore.saveFirstPaintState(this.activeVault.id, updatedState);
        }
      } catch {
        // Safe skip on disk sync failure
      }

      // 3. Resume any interrupted jobs
      if (this.jobService) {
        try {
          await this.jobService.resumePendingJobs(this.activeVault.id);
        } catch {
          // Safe skip
        }
      }
    });
  }
}
