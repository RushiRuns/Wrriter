import * as fs from 'fs';
import * as path from 'path';
import { SafeWriter } from '../services/safe-writer';
import { Result, ok, err } from '../../shared/result';

export interface KnownVault {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastOpenedAt: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'follow-windows';
  accent: 'sky' | 'yellow' | 'coral' | 'mint' | 'lilac';
  motion: 'follow-windows' | 'reduced' | 'full';
  noteMargin: number; // 16 to 96, default 24
  keepRunningInBackground: boolean;
  startWithWindows: boolean;
  captureHotkey: string;
  captureVault: 'last-active' | string;
  noteList: {
    sortBy: 'manual' | 'modified' | 'created' | 'title';
    showSortIcon: boolean;
    showPreviews: boolean;
    showDates: boolean;
    showImages: boolean;
  };
  dragHintShown: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'follow-windows',
  accent: 'yellow',
  motion: 'follow-windows',
  noteMargin: 24,
  keepRunningInBackground: true,
  startWithWindows: false,
  captureHotkey: 'Ctrl+Alt+N',
  captureVault: 'last-active',
  noteList: {
    sortBy: 'manual',
    showSortIcon: false,
    showPreviews: true,
    showDates: true,
    showImages: true
  },
  dragHintShown: false
};

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  sidebarWidth: number;
  listWidth: number;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
  sidebarWidth: 248,
  listWidth: 320
};

export interface FirstPaintState {
  openTabs: string[];
  activeTabPath: string | null;
  firstPageNotes: Array<{
    path: string;
    title: string;
    preview: string;
    modified: number;
  }>;
}

export class AppDataStore {
  private readonly appDataDir: string;
  private readonly safeWriter: SafeWriter;

  constructor(appDataDir: string, safeWriter: SafeWriter = new SafeWriter()) {
    this.appDataDir = appDataDir;
    this.safeWriter = safeWriter;
  }

  getLogsDir(): string {
    return path.join(this.appDataDir, 'logs');
  }

  getAppDataDir(): string {
    return this.appDataDir;
  }

  // --- Vaults List ---
  async getVaults(): Promise<KnownVault[]> {
    const file = path.join(this.appDataDir, 'vaults.json');
    try {
      if (!fs.existsSync(file)) return [];
      const content = await fs.promises.readFile(file, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.vaults ?? [];
    } catch {
      return [];
    }
  }

  async saveVaults(vaults: KnownVault[]): Promise<Result<void>> {
    const file = path.join(this.appDataDir, 'vaults.json');
    await fs.promises.mkdir(this.appDataDir, { recursive: true });
    const payload = JSON.stringify({ version: 1, vaults }, null, 2);
    const res = await this.safeWriter.write(this.appDataDir, 'vaults.json', payload);
    if (!res.ok) return res;
    return ok(undefined);
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    const file = path.join(this.appDataDir, 'settings.json');
    try {
      if (!fs.existsSync(file)) return { ...DEFAULT_APP_SETTINGS };
      const content = await fs.promises.readFile(file, 'utf8');
      const parsed = JSON.parse(content);
      return { ...DEFAULT_APP_SETTINGS, ...(parsed.settings ?? {}) };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<Result<AppSettings>> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await fs.promises.mkdir(this.appDataDir, { recursive: true });
    const payload = JSON.stringify({ version: 1, settings: updated }, null, 2);
    const res = await this.safeWriter.write(this.appDataDir, 'settings.json', payload);
    if (!res.ok) return res;
    return ok(updated);
  }

  // --- Window State ---
  async getWindowState(): Promise<WindowState> {
    const file = path.join(this.appDataDir, 'window-state.json');
    try {
      if (!fs.existsSync(file)) return { ...DEFAULT_WINDOW_STATE };
      const content = await fs.promises.readFile(file, 'utf8');
      const parsed = JSON.parse(content);
      return { ...DEFAULT_WINDOW_STATE, ...(parsed.windowState ?? {}) };
    } catch {
      return { ...DEFAULT_WINDOW_STATE };
    }
  }

  async saveWindowState(state: WindowState): Promise<Result<void>> {
    await fs.promises.mkdir(this.appDataDir, { recursive: true });
    const payload = JSON.stringify({ version: 1, windowState: state }, null, 2);
    const res = await this.safeWriter.write(this.appDataDir, 'window-state.json', payload);
    if (!res.ok) return res;
    return ok(undefined);
  }

  // --- First Paint Cache ---
  async getFirstPaintState(vaultId: string): Promise<FirstPaintState | null> {
    const file = path.join(this.appDataDir, 'first-paint', `${vaultId}.json`);
    try {
      if (!fs.existsSync(file)) return null;
      const content = await fs.promises.readFile(file, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async saveFirstPaintState(vaultId: string, state: FirstPaintState): Promise<Result<void>> {
    const dir = path.join(this.appDataDir, 'first-paint');
    await fs.promises.mkdir(dir, { recursive: true });
    const payload = JSON.stringify(state, null, 2);
    const res = await this.safeWriter.write(dir, `${vaultId}.json`, payload);
    if (!res.ok) return res;
    return ok(undefined);
  }
}
