import { BrowserWindow, nativeTheme, type WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppDataStore, type CaptureWindowState, DEFAULT_CAPTURE_WINDOW_STATE } from '../store/app-data-store';
import { SafeWriter } from './safe-writer';
import { VaultReader } from './vault-reader';
import { VaultService } from './vault-service';
import { WindowService } from './window-service';
import { IpcRouter } from '../ipc/router';
import { createSecureWindow } from '../windows/window-factory';
import { Result, ok, err } from '../../shared/result';
import {
  formatQuickNoteTitle,
  sanitizeFileName,
  formatClashName
} from '../../shared/domain/names';
import type {
  CaptureStateResult,
  SaveQuickNoteResult
} from '../../shared/ipc/contracts';

export interface CaptureServiceOptions {
  appDataStore: AppDataStore;
  safeWriter: SafeWriter;
  vaultReader?: VaultReader;
  vaultService: VaultService;
  windowService: WindowService;
  ipcRouter: IpcRouter;
  captureHtmlPath?: string;
  onOpenNoteInMain?: (notePath: string) => void;
}

/**
 * Service managing Quick Capture and Pop-out editor windows (M4).
 *
 * Requirements:
 * - One small window for both jobs, with the same editor: small by default, resizable,
 *   size and position remembered, following theme/accent, on top by default with pin toggle.
 * - Quick capture: blank note with live cursor, no file until typed, saved into Inbox/,
 *   named "Quick note YYYY-MM-DD HH.mm" when first line is empty. Escape closes.
 *   One capture window at a time (hotkey brings forward). Open in main window moves note to tab.
 * - Capture goes to last active vault, or fixed vault chosen in settings.
 * - Pop-outs: any number, one note each, survives closing main window, does not reopen on restart.
 * - Two capture approaches: on-demand vs ready hidden window.
 */
export class CaptureService {
  private readonly appDataStore: AppDataStore;
  private readonly safeWriter: SafeWriter;
  private readonly vaultService: VaultService;
  private readonly windowService: WindowService;
  private readonly ipcRouter: IpcRouter;
  private readonly captureHtmlPath: string;
  private onOpenNoteInMain?: ((notePath: string) => void) | undefined;

  private quickCaptureWindow: BrowserWindow | null = null;
  private popOutWindows = new Map<string, BrowserWindow>(); // notePath -> window
  private currentCaptureState: CaptureWindowState = { ...DEFAULT_CAPTURE_WINDOW_STATE };
  private captureMode: 'on-demand' | 'ready' = 'on-demand';
  private prewarmedCaptureWindow: BrowserWindow | null = null;

  private boundsSaveTimer: NodeJS.Timeout | null = null;

  constructor(options: CaptureServiceOptions) {
    this.appDataStore = options.appDataStore;
    this.safeWriter = options.safeWriter;
    this.vaultService = options.vaultService;
    this.windowService = options.windowService;
    this.ipcRouter = options.ipcRouter;
    this.captureHtmlPath =
      options.captureHtmlPath ??
      path.join(__dirname, '../renderer/windows/capture/index.html');
    this.onOpenNoteInMain = options.onOpenNoteInMain;

    this.registerIpcHandlers();
  }

  setOpenNoteInMainHandler(handler: (notePath: string) => void): void {
    this.onOpenNoteInMain = handler;
  }

  setCaptureMode(mode: 'on-demand' | 'ready'): void {
    this.captureMode = mode;
    if (mode === 'ready' && !this.quickCaptureWindow && !this.prewarmedCaptureWindow) {
      void this.prewarmReadyWindow();
    } else if (mode === 'on-demand' && this.prewarmedCaptureWindow) {
      this.prewarmedCaptureWindow.destroy();
      this.prewarmedCaptureWindow = null;
    }
  }

  getCaptureMode(): 'on-demand' | 'ready' {
    return this.captureMode;
  }

  getQuickCaptureWindow(): BrowserWindow | null {
    return this.quickCaptureWindow;
  }

  getPopOutWindows(): BrowserWindow[] {
    return Array.from(this.popOutWindows.values()).filter((w) => !w.isDestroyed());
  }

  /**
   * Pre-warms a hidden capture window for the 'ready' approach.
   */
  private async prewarmReadyWindow(): Promise<BrowserWindow> {
    const win = await this.buildCaptureWindow({ mode: 'quick-capture' });
    this.prewarmedCaptureWindow = win;
    return win;
  }

  /**
   * Opens or focuses the single Quick Capture window.
   */
  async openQuickCapture(): Promise<BrowserWindow> {
    // If capture window already exists, bring it forward
    if (this.quickCaptureWindow && !this.quickCaptureWindow.isDestroyed()) {
      if (this.quickCaptureWindow.isMinimized()) {
        this.quickCaptureWindow.restore();
      }
      this.quickCaptureWindow.show();
      this.quickCaptureWindow.focus();
      this.quickCaptureWindow.webContents.send('capture:re-enter');
      return this.quickCaptureWindow;
    }

    if (this.captureMode === 'ready' && this.prewarmedCaptureWindow && !this.prewarmedCaptureWindow.isDestroyed()) {
      const win = this.prewarmedCaptureWindow;
      this.prewarmedCaptureWindow = null;
      this.quickCaptureWindow = win;
      win.show();
      win.focus();
      return win;
    }

    const win = await this.buildCaptureWindow({ mode: 'quick-capture' });
    this.quickCaptureWindow = win;

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    win.on('closed', () => {
      this.quickCaptureWindow = null;
      if (this.captureMode === 'ready') {
        void this.prewarmReadyWindow();
      }
    });

    return win;
  }

  /**
   * Opens a note in a standalone pop-out window.
   */
  async openPopOut(notePath: string): Promise<BrowserWindow> {
    const existing = this.popOutWindows.get(notePath);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }

    const win = await this.buildCaptureWindow({
      mode: 'pop-out',
      notePath
    });

    this.popOutWindows.set(notePath, win);

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    win.on('closed', () => {
      this.popOutWindows.delete(notePath);
    });

    return win;
  }

  /**
   * Resolves the target vault for quick capture based on settings.
   */
  async resolveTargetVault(): Promise<{ id: string; name: string; path: string } | null> {
    const settings = await this.appDataStore.getSettings();
    const vaults = await this.appDataStore.getVaults();
    if (vaults.length === 0) return null;

    if (settings.captureVault && settings.captureVault !== 'last-active') {
      const fixed = vaults.find((v) => v.id === settings.captureVault);
      if (fixed) return fixed;
    }

    // Default: last active vault
    const activeId = this.vaultService.getActiveVaultId();
    if (activeId) {
      const active = vaults.find((v) => v.id === activeId);
      if (active) return active;
    }

    const sorted = vaults.slice().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    return sorted[0] ?? null;
  }

  /**
   * Builds a secure small window adhering to the unified capture/pop-out specification.
   */
  private async buildCaptureWindow(params: {
    mode: 'quick-capture' | 'pop-out';
    notePath?: string;
  }): Promise<BrowserWindow> {
    const [settings, savedCaptureState, targetVault] = await Promise.all([
      this.appDataStore.getSettings(),
      this.appDataStore.getCaptureWindowState(),
      this.resolveTargetVault()
    ]);

    this.currentCaptureState = savedCaptureState;

    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'follow-windows' && (nativeTheme?.shouldUseDarkColors ?? true));
    const effectiveTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
    const backgroundColor = effectiveTheme === 'dark' ? '#1E1E1E' : '#F5F4F2';

    const win = createSecureWindow({
      width: savedCaptureState.width || DEFAULT_CAPTURE_WINDOW_STATE.width,
      height: savedCaptureState.height || DEFAULT_CAPTURE_WINDOW_STATE.height,
      minWidth: 380,
      minHeight: 280,
      ...(savedCaptureState.x !== undefined ? { x: savedCaptureState.x } : {}),
      ...(savedCaptureState.y !== undefined ? { y: savedCaptureState.y } : {}),
      backgroundColor,
      htmlPath: this.captureHtmlPath,
      query: {
        mode: params.mode,
        theme: effectiveTheme,
        accent: settings.accent,
        path: params.notePath ?? '',
        vaultId: targetVault?.id ?? '',
        vaultPath: targetVault?.path ?? '',
        alwaysOnTop: String(savedCaptureState.isAlwaysOnTop)
      }
    });

    win.setAlwaysOnTop(savedCaptureState.isAlwaysOnTop);

    // Save window size and position changes
    const trackBounds = () => {
      if (!win.isDestroyed() && !win.isMinimized()) {
        const bounds = win.getBounds();
        this.currentCaptureState = {
          ...this.currentCaptureState,
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y
        };
        this.scheduleSaveCaptureWindowState();
      }
    };

    win.on('resize', trackBounds);
    win.on('move', trackBounds);

    return win;
  }

  private scheduleSaveCaptureWindowState(): void {
    if (this.boundsSaveTimer) {
      clearTimeout(this.boundsSaveTimer);
    }
    this.boundsSaveTimer = setTimeout(async () => {
      await this.appDataStore.saveCaptureWindowState(this.currentCaptureState);
    }, 400);
  }

  /**
   * Saves a quick capture note to the Inbox/ folder of the target vault.
   */
  async saveQuickNote(
    text: string,
    existingPath?: string
  ): Promise<Result<SaveQuickNoteResult>> {
    const targetVault = await this.resolveTargetVault();
    if (!targetVault) {
      return err({ kind: 'vaultUnavailable' });
    }

    const trimmed = text.trim();
    if (!trimmed && !existingPath) {
      return ok({ path: '', title: '', written: false });
    }

    // 1. If updating an already-saved note in Inbox
    if (existingPath) {
      const writeRes = await this.safeWriter.write(targetVault.path, existingPath, text);
      if (!writeRes.ok) return writeRes;
      const title = path.basename(existingPath, '.md');
      return ok({ path: existingPath, title, written: true });
    }

    // 2. Fresh note creation in Inbox/
    const inboxDir = path.join(targetVault.path, 'Inbox');
    await fs.promises.mkdir(inboxDir, { recursive: true });

    // Derive title from first line or default to "Quick note YYYY-MM-DD HH.mm"
    const firstLine = text.split('\n')[0]?.replace(/^#+\s*/, '').trim() || '';
    const rawTitle = firstLine ? sanitizeFileName(firstLine) : formatQuickNoteTitle();
    const title = rawTitle || formatQuickNoteTitle();

    // Check clash numbering in Inbox/
    let fileName = `${title}.md`;
    let clashIndex = 1;
    while (fs.existsSync(path.join(inboxDir, fileName))) {
      clashIndex++;
      fileName = formatClashName(title, clashIndex, '.md');
    }

    const relPath = `Inbox/${fileName}`;
    const writeRes = await this.safeWriter.write(targetVault.path, relPath, text);
    if (!writeRes.ok) return writeRes;

    return ok({
      path: relPath,
      title: path.basename(fileName, '.md'),
      written: true
    });
  }

  /**
   * Moves a captured note from the quick capture window into a tab in the main window.
   */
  async openInMainWindow(notePath: string): Promise<Result<void>> {
    const targetVault = await this.resolveTargetVault();
    if (!targetVault) return err({ kind: 'vaultUnavailable' });

    // 1. Update first paint state so when main window opens or focuses, note is in tabs
    const firstPaint = await this.appDataStore.getFirstPaintState(targetVault.id);
    const openTabs = firstPaint?.openTabs ? [...firstPaint.openTabs] : [];
    if (!openTabs.includes(notePath)) {
      openTabs.push(notePath);
    }
    await this.appDataStore.saveFirstPaintState(targetVault.id, {
      openTabs,
      activeTabPath: notePath,
      firstPageNotes: firstPaint?.firstPageNotes ?? []
    });

    // 2. Open / focus main window
    const mainWin = await this.windowService.createMainWindow();
    mainWin.show();
    mainWin.focus();
    mainWin.webContents.send('note:opened-in-main', { path: notePath });

    // Notify custom handler or renderer
    if (this.onOpenNoteInMain) {
      this.onOpenNoteInMain(notePath);
    }

    // 3. Close quick capture window
    if (this.quickCaptureWindow && !this.quickCaptureWindow.isDestroyed()) {
      this.quickCaptureWindow.close();
      this.quickCaptureWindow = null;
    }

    return ok(undefined);
  }

  /**
   * Toggles Always On Top on the calling capture or pop-out window.
   */
  setAlwaysOnTop(alwaysOnTop: boolean, sender: WebContents): Result<void> {
    const win = BrowserWindow.fromWebContents(sender);
    if (!win || win.isDestroyed()) {
      return err({ kind: 'notFound' });
    }

    win.setAlwaysOnTop(alwaysOnTop);
    this.currentCaptureState = {
      ...this.currentCaptureState,
      isAlwaysOnTop: alwaysOnTop
    };
    this.scheduleSaveCaptureWindowState();
    return ok(undefined);
  }

  /**
   * Registers IPC handlers for capture and pop-out channels.
   */
  private registerIpcHandlers(): void {
    this.ipcRouter.register('capture.openQuickCapture', async () => {
      await this.openQuickCapture();
      return ok(undefined);
    });

    this.ipcRouter.register('capture.openPopOut', async (args) => {
      await this.openPopOut(args.path);
      return ok(undefined);
    });

    this.ipcRouter.register('capture.openInMainWindow', async (args) => {
      return this.openInMainWindow(args.path);
    });

    this.ipcRouter.register('capture.setAlwaysOnTop', async (args, event) => {
      return this.setAlwaysOnTop(args.alwaysOnTop, event.sender);
    });

    this.ipcRouter.register('capture.saveQuickNote', async (args) => {
      return this.saveQuickNote(args.text, args.path);
    });

    this.ipcRouter.register('capture.getCaptureState', async (_args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const isTop = win?.isAlwaysOnTop() ?? this.currentCaptureState.isAlwaysOnTop;
      const targetVault = await this.resolveTargetVault();

      const result: CaptureStateResult = {
        mode: win === this.quickCaptureWindow ? 'quick-capture' : 'pop-out',
        isAlwaysOnTop: isTop,
        activeVaultName: targetVault?.name
      };
      return ok(result);
    });
  }
}
