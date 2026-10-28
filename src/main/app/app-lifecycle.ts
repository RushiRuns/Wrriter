import { app, BrowserWindow } from 'electron';
import { AppDataStore, type AppSettings } from '../store/app-data-store';
import { WindowService } from '../services/window-service';
import { SingleInstanceAdapter } from '../platform/single-instance';
import { ElectronTrayAdapter, type TrayAdapter } from '../platform/tray';
import { ElectronHotkeyAdapter, type HotkeyAdapter, type HotkeyRegistrationOutcome } from '../platform/hotkey';
import { ElectronLoginItemAdapter, type LoginItemAdapter } from '../platform/login-item';
import { startMainLagMonitor, stopMainLagMonitor } from '../platform/lag-monitor';
import { Result, ok, err } from '../../shared/result';
import type { AppSettingsContract } from '../../shared/ipc/contracts';

export interface AppLifecycleOptions {
  appDataStore: AppDataStore;
  windowService: WindowService;
  singleInstanceAdapter?: SingleInstanceAdapter;
  trayAdapter?: TrayAdapter;
  hotkeyAdapter?: HotkeyAdapter;
  loginItemAdapter?: LoginItemAdapter;
  shutdownIndexWorkerOnIdle?: boolean;
  onTriggerQuickNote?: () => void;
}

/**
 * Coordinates application lifecycle, background persistence, tray, global hotkey,
 * single running copy, and Windows login item integration.
 *
 * Requirements:
 * - SingleInstance: Lock taken first. Second instance hands request to running copy.
 * - Tray: Icon with menu (New quick note, Open Wrriter, Quit), click opens main window.
 * - Closing to tray destroys the main window. Opening rebuilds from saved state in < 500 ms.
 * - With keep running in background off, closing the last window quits Wrriter fully.
 * - LoginItem: Start with Windows is off by default, starts hidden, offered only while keep running is on.
 * - Hotkey: Ctrl+Alt+N default, changeable without restart, confirms registration, says plainly when taken.
 * - While idle in tray, nothing runs: no timers, no polling, no rendering, no animation.
 * - Index worker idle shutdown: optional toggle and measurements.
 */
export class AppLifecycle {
  private readonly appDataStore: AppDataStore;
  private readonly windowService: WindowService;
  private readonly singleInstance: SingleInstanceAdapter;
  private readonly tray: TrayAdapter;
  private readonly hotkey: HotkeyAdapter;
  private readonly loginItem: LoginItemAdapter;
  private shutdownIndexWorkerOnIdle: boolean;
  private onTriggerQuickNoteCustom?: (() => void) | undefined;

  private currentSettings: AppSettings | null = null;
  private isQuitting = false;
  private lastRebuildDurationMs = 0;

  constructor(options: AppLifecycleOptions) {
    this.appDataStore = options.appDataStore;
    this.windowService = options.windowService;
    this.singleInstance = options.singleInstanceAdapter ?? new SingleInstanceAdapter();
    this.tray = options.trayAdapter ?? new ElectronTrayAdapter();
    this.hotkey = options.hotkeyAdapter ?? new ElectronHotkeyAdapter();
    this.loginItem = options.loginItemAdapter ?? new ElectronLoginItemAdapter();
    this.shutdownIndexWorkerOnIdle = options.shutdownIndexWorkerOnIdle ?? false;
    this.onTriggerQuickNoteCustom = options.onTriggerQuickNote;
  }

  /**
   * Initializes application lifecycle: single-instance check, tray, hotkey, and login item.
   * Returns true if lock was acquired and startup can continue, or false if secondary instance.
   */
  async initialize(options?: { isHiddenStartup?: boolean }): Promise<boolean> {
    // 1. Single-instance lock
    if (!this.singleInstance.requestLock()) {
      app.quit();
      return false;
    }

    // Register second instance handoff
    this.singleInstance.registerSecondInstance({
      onSecondInstance: (argv) => {
        if (argv.includes('--quick-note')) {
          this.triggerQuickNote();
        } else {
          void this.openMainWindow();
        }
      }
    });

    // 2. Read settings
    this.currentSettings = await this.appDataStore.getSettings();

    // 3. Create Tray
    this.tray.createTray({
      onOpenMainWindow: () => {
        void this.openMainWindow();
      },
      onNewQuickNote: () => {
        this.triggerQuickNote();
      },
      onQuit: () => {
        this.quit();
      }
    });

    // 4. Register global hotkey
    const hotkeyCombination = this.currentSettings.captureHotkey || 'Ctrl+Alt+N';
    this.hotkey.register(hotkeyCombination, () => {
      this.triggerQuickNote();
    });

    // 5. Sync LoginItem (Start with Windows)
    if (this.currentSettings.keepRunningInBackground) {
      this.loginItem.setStartWithWindows(this.currentSettings.startWithWindows);
    } else {
      this.loginItem.setStartWithWindows(false);
    }

    // 6. Handle startup window display (skip creation if launched hidden with --hidden)
    const isHidden = options?.isHiddenStartup ?? false;
    if (!isHidden) {
      await this.openMainWindow();
    } else {
      // Idle in tray at startup: ensure lag monitor is not running
      stopMainLagMonitor();
    }

    return true;
  }

  /**
   * Opens or rebuilds the main application window.
   * If window was destroyed when closing to tray, rebuilds from saved state in < 500 ms.
   */
  async openMainWindow(): Promise<BrowserWindow> {
    const existing = this.windowService.getMainWindow();
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) {
        existing.restore();
      }
      existing.show();
      existing.focus();
      return existing;
    }

    const startTime = performance.now();
    startMainLagMonitor();

    const win = await this.windowService.createMainWindow();

    // Wire close event on window to enforce destruction to tray
    win.on('close', (event) => {
      if (this.isQuitting) return;

      if (this.shouldKeepRunningInBackground()) {
        // Allow the window to be destroyed naturally, releasing the Chromium renderer process
        // Immediately pause background tasks and monitors
        void this.handleMainWindowClosedToTray();
      }
    });

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
      this.lastRebuildDurationMs = performance.now() - startTime;
    });

    return win;
  }

  /**
   * Cleanly handles main window destruction when closed to tray:
   * - Pauses file watcher and active jobs
   * - Stops lag monitor
   * - Optionally shuts down index worker to conserve memory
   */
  private async handleMainWindowClosedToTray(): Promise<void> {
    stopMainLagMonitor();
    await this.windowService.pauseForTrayIdle(this.shutdownIndexWorkerOnIdle);
  }

  /**
   * Triggers the quick note capture workflow.
   * If a custom handler or capture window is registered, invokes it.
   * Fallback: opens the main window with a new note.
   */
  triggerQuickNote(): void {
    if (this.onTriggerQuickNoteCustom) {
      this.onTriggerQuickNoteCustom();
      return;
    }

    // Baseline fallback before M4 capture window is built: open main window
    void this.openMainWindow();
  }

  setQuickNoteHandler(handler: () => void): void {
    this.onTriggerQuickNoteCustom = handler;
  }

  /**
   * Returns whether the application should remain alive in the tray when the main window closes.
   */
  shouldKeepRunningInBackground(): boolean {
    if (this.isQuitting) return false;
    return this.currentSettings?.keepRunningInBackground ?? true;
  }

  /**
   * Updates settings, managing hotkey reassignment and login-item integration dynamically.
   */
  async handleSaveSettings(patch: Partial<AppSettingsContract>): Promise<Result<AppSettingsContract>> {
    // 1. Handle Hotkey Change
    if (patch.captureHotkey !== undefined && patch.captureHotkey !== this.currentSettings?.captureHotkey) {
      const outcome = this.hotkey.register(patch.captureHotkey, () => {
        this.triggerQuickNote();
      });

      if (!outcome.registered) {
        return err({
          kind: 'validation',
          field: 'captureHotkey',
          reason: outcome.error ?? `The shortcut "${patch.captureHotkey}" could not be registered.`
        });
      }
    }

    // 2. Handle Keep Running in Background & Start with Windows
    const nextKeepRunning =
      patch.keepRunningInBackground !== undefined
        ? patch.keepRunningInBackground
        : (this.currentSettings?.keepRunningInBackground ?? true);

    let nextStartWithWin =
      patch.startWithWindows !== undefined
        ? patch.startWithWindows
        : (this.currentSettings?.startWithWindows ?? false);

    if (!nextKeepRunning) {
      nextStartWithWin = false;
      this.loginItem.setStartWithWindows(false);
    } else if (patch.startWithWindows !== undefined) {
      this.loginItem.setStartWithWindows(nextStartWithWin);
    }

    const modifiedPatch: Partial<AppSettings> = {
      ...patch,
      keepRunningInBackground: nextKeepRunning,
      startWithWindows: nextStartWithWin
    };

    const saved = await this.appDataStore.saveSettings(modifiedPatch);
    if (!saved.ok) {
      return saved;
    }
    this.currentSettings = saved.value;
    return ok(saved.value as AppSettingsContract);
  }

  /**
   * Checks current hotkey registration status.
   */
  getHotkeyStatus(accelerator?: string): HotkeyRegistrationOutcome {
    const target = accelerator ?? this.currentSettings?.captureHotkey ?? 'Ctrl+Alt+N';
    const isRegistered = this.hotkey.isRegistered(target);
    return {
      registered: isRegistered,
      accelerator: target,
      ...(isRegistered
        ? {}
        : { error: `The shortcut "${target}" is not registered or in use by another application.` })
    };
  }

  /**
   * Sets whether the index worker should be terminated when the app is idle in the tray.
   */
  setShutdownIndexWorkerOnIdle(enabled: boolean): void {
    this.shutdownIndexWorkerOnIdle = enabled;
  }

  getShutdownIndexWorkerOnIdle(): boolean {
    return this.shutdownIndexWorkerOnIdle;
  }

  getLastRebuildDurationMs(): number {
    return this.lastRebuildDurationMs;
  }

  /**
   * Exits Wrriter completely.
   */
  quit(): void {
    this.isQuitting = true;
    this.hotkey.unregister();
    this.tray.destroyTray();
    app.quit();
  }
}
