import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppDataStore, DEFAULT_APP_SETTINGS, DEFAULT_WINDOW_STATE } from '../../src/main/store/app-data-store';
import { OrderService } from '../../src/main/services/order-service';
import { SafeWriter } from '../../src/main/services/safe-writer';

describe('AppDataStore', () => {
  let tmpDir: string;
  let store: AppDataStore;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `wrriter-test-appdata-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    store = new AppDataStore(tmpDir, new SafeWriter());
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('provides default settings when no settings file exists', async () => {
    const settings = await store.getSettings();
    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('saves and merges partial settings', async () => {
    const res = await store.saveSettings({ accent: 'coral', noteMargin: 32 });
    expect(res.ok).toBe(true);

    const updated = await store.getSettings();
    expect(updated.accent).toBe('coral');
    expect(updated.noteMargin).toBe(32);
    expect(updated.theme).toBe('follow-windows');
  });

  it('manages known vaults list', async () => {
    expect(await store.getVaults()).toEqual([]);

    const vaults = [
      { id: 'v1', name: 'Personal', path: 'C:/Vaults/Personal', createdAt: 100, lastOpenedAt: 200 }
    ];
    const saveRes = await store.saveVaults(vaults);
    expect(saveRes.ok).toBe(true);

    const loaded = await store.getVaults();
    expect(loaded).toEqual(vaults);
  });

  it('manages window state', async () => {
    const defaultState = await store.getWindowState();
    expect(defaultState).toEqual(DEFAULT_WINDOW_STATE);

    const newState = {
      width: 1400,
      height: 900,
      isMaximized: true,
      sidebarWidth: 260,
      listWidth: 340,
      x: 100,
      y: 50
    };
    const res = await store.saveWindowState(newState);
    expect(res.ok).toBe(true);

    const loaded = await store.getWindowState();
    expect(loaded).toEqual(newState);
  });

  it('manages first-paint cache per vault', async () => {
    expect(await store.getFirstPaintState('vault-123')).toBeNull();

    const fpState = {
      openTabs: ['Notes/Ideas.md'],
      activeTabPath: 'Notes/Ideas.md',
      firstPageNotes: [
        { path: 'Notes/Ideas.md', title: 'Ideas', preview: 'Quick preview', modified: Date.now() }
      ]
    };
    const saveRes = await store.saveFirstPaintState('vault-123', fpState);
    expect(saveRes.ok).toBe(true);

    const loaded = await store.getFirstPaintState('vault-123');
    expect(loaded).toEqual(fpState);
  });

  it('returns logs directory path', () => {
    expect(store.getLogsDir()).toBe(path.join(tmpDir, 'logs'));
  });
});

describe('OrderService', () => {
  let tmpVault: string;
  let orderService: OrderService;

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-test-vault-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });
    orderService = new OrderService(new SafeWriter());
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('manages pinned notes in .wrriter/pins.json', async () => {
    expect(await orderService.getPins(tmpVault)).toEqual([]);

    const pinRes1 = await orderService.setPin(tmpVault, 'folder\\Daily Notes.md', true);
    expect(pinRes1.ok).toBe(true);
    if (pinRes1.ok) {
      expect(pinRes1.value).toEqual(['folder/Daily Notes.md']);
    }

    const pinRes2 = await orderService.setPin(tmpVault, 'Inbox.md', true);
    expect(pinRes2.ok).toBe(true);
    if (pinRes2.ok) {
      expect(pinRes2.value).toEqual(['folder/Daily Notes.md', 'Inbox.md']);
    }

    // Unpin
    const unpinRes = await orderService.setPin(tmpVault, 'folder/Daily Notes.md', false);
    expect(unpinRes.ok).toBe(true);
    if (unpinRes.ok) {
      expect(unpinRes.value).toEqual(['Inbox.md']);
    }

    const finalPins = await orderService.getPins(tmpVault);
    expect(finalPins).toEqual(['Inbox.md']);
  });

  it('manages fractional order keys in .wrriter/order.json', async () => {
    const initialOrder = await orderService.getFolderOrder(tmpVault, '');
    expect(initialOrder).toEqual({});

    await orderService.setOrderKey(tmpVault, '', 'NoteA.md', 'a0');
    await orderService.setOrderKey(tmpVault, '', 'NoteB.md', 'a1');
    await orderService.setOrderKey(tmpVault, 'Work', 'Project.md', 'a0');

    const rootOrder = await orderService.getFolderOrder(tmpVault, '');
    expect(rootOrder).toEqual({
      'NoteA.md': 'a0',
      'NoteB.md': 'a1'
    });

    const workOrder = await orderService.getFolderOrder(tmpVault, 'Work');
    expect(workOrder).toEqual({
      'Project.md': 'a0'
    });

    const rawFile = await orderService.getOrderFile(tmpVault);
    expect(rawFile.version).toBe(1);
    expect(rawFile.folders['']).toBeDefined();
    expect(rawFile.folders['Work']).toBeDefined();
  });
});
