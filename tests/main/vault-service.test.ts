import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppDataStore } from '../../src/main/store/app-data-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import {
  VaultService,
  checkVaultContainment,
  resolveInsideVault
} from '../../src/main/services/vault-service';

describe('VaultService & checkVaultContainment', () => {
  let tmpBase: string;
  let tmpAppData: string;
  let appDataStore: AppDataStore;
  let safeWriter: SafeWriter;
  let vaultService: VaultService;

  beforeEach(async () => {
    tmpBase = path.join(os.tmpdir(), `wrriter-vault-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tmpAppData = path.join(tmpBase, 'appdata');
    await fs.promises.mkdir(tmpAppData, { recursive: true });

    safeWriter = new SafeWriter();
    appDataStore = new AppDataStore(tmpAppData, safeWriter);
    vaultService = new VaultService({
      appDataStore,
      safeWriter,
      suggestedDocsDir: path.join(tmpBase, 'Documents')
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
  });

  describe('checkVaultContainment', () => {
    const existing = [
      { id: 'v1', name: 'Personal', path: 'C:\\Users\\Notes\\Personal', createdAt: 1, lastOpenedAt: 1 },
      { id: 'v2', name: 'Work', path: 'C:\\Users\\Notes\\Work', createdAt: 2, lastOpenedAt: 2 }
    ];

    it('allows a separate folder', () => {
      const res = checkVaultContainment('C:\\Users\\Notes\\Projects', existing);
      expect(res.ok).toBe(true);
    });

    it('refuses a folder inside an existing vault with clear reason', () => {
      const res = checkVaultContainment('C:\\Users\\Notes\\Personal\\Archive', existing);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe('ruleViolation');
        if (res.error.kind === 'ruleViolation') {
          expect(res.error.rule).toContain('is inside an existing vault ("Personal")');
        }
      }
    });

    it('refuses a folder that contains an existing vault with clear reason', () => {
      const res = checkVaultContainment('C:\\Users\\Notes', existing);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe('ruleViolation');
        if (res.error.kind === 'ruleViolation') {
          expect(res.error.rule).toContain('contains an existing vault');
        }
      }
    });

    it('does not false-positive on prefix folder names (e.g. Work vs Workshop)', () => {
      const res = checkVaultContainment('C:\\Users\\Notes\\Workshop', existing);
      expect(res.ok).toBe(true);
    });
  });

  describe('openVault', () => {
    it('opens a folder as vault, writes ONLY .wrriter/vault.json with UUID v4, and converts nothing', async () => {
      const vaultFolder = path.join(tmpBase, 'MyNotes');
      await fs.promises.mkdir(vaultFolder, { recursive: true });
      const sampleNote = path.join(vaultFolder, 'Hello.md');
      await fs.promises.writeFile(sampleNote, '# Hello World\nExisting text.\n');

      const res = await vaultService.openVault({ path: vaultFolder });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.name).toBe('MyNotes');
      expect(res.value.path).toBe(path.resolve(vaultFolder));
      expect(res.value.vaultId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Verify .wrriter/vault.json was created
      const vaultJsonPath = path.join(vaultFolder, '.wrriter', 'vault.json');
      expect(fs.existsSync(vaultJsonPath)).toBe(true);
      const vaultJson = JSON.parse(await fs.promises.readFile(vaultJsonPath, 'utf8'));
      expect(vaultJson.vaultId).toBe(res.value.vaultId);
      expect(vaultJson.version).toBe(1);

      // Verify original note was NOT touched or converted
      const noteContent = await fs.promises.readFile(sampleNote, 'utf8');
      expect(noteContent).toBe('# Hello World\nExisting text.\n');

      // Verify no other files were written in the vault root
      const filesInRoot = await fs.promises.readdir(vaultFolder);
      expect(filesInRoot.sort()).toEqual(['.wrriter', 'Hello.md'].sort());
    });

    it('preserves existing UUID v4 when opening a folder that already has .wrriter/vault.json', async () => {
      const vaultFolder = path.join(tmpBase, 'ExistingVault');
      const wrriterDir = path.join(vaultFolder, '.wrriter');
      await fs.promises.mkdir(wrriterDir, { recursive: true });
      const existingId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      await fs.promises.writeFile(path.join(wrriterDir, 'vault.json'), JSON.stringify({ version: 1, vaultId: existingId }));

      const res = await vaultService.openVault({ path: vaultFolder });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.vaultId).toBe(existingId);
    });

    it('refuses opening a non-existent folder', async () => {
      const res = await vaultService.openVault({ path: path.join(tmpBase, 'DoesNotExist') });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe('validation');
      }
    });

    it('refuses opening a folder inside an already opened vault', async () => {
      const parentVault = path.join(tmpBase, 'ParentVault');
      await fs.promises.mkdir(parentVault, { recursive: true });
      await vaultService.openVault({ path: parentVault });

      const subFolder = path.join(parentVault, 'SubFolder');
      await fs.promises.mkdir(subFolder, { recursive: true });

      const res = await vaultService.openVault({ path: subFolder });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe('ruleViolation');
        if (res.error.kind === 'ruleViolation') {
          expect(res.error.rule).toContain('Nested vaults are not permitted');
        }
      }
    });
  });

  describe('createVault', () => {
    it('creates new vault in suggested directory with .wrriter/vault.json', async () => {
      const res = await vaultService.createVault({});
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe(path.resolve(tmpBase, 'Documents', 'Wrriter'));
      expect(fs.existsSync(path.join(res.value.path, '.wrriter', 'vault.json'))).toBe(true);
    });

    it('creates new vault in custom path', async () => {
      const customPath = path.join(tmpBase, 'CustomVault');
      const res = await vaultService.createVault({ path: customPath });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.path).toBe(path.resolve(customPath));
      expect(fs.existsSync(path.join(customPath, '.wrriter', 'vault.json'))).toBe(true);
    });
  });

  describe('listVaults & switchVault', () => {
    it('lists multiple vaults, identifies active vault, and marks available/unavailable', async () => {
      const v1Path = path.join(tmpBase, 'Vault1');
      const v2Path = path.join(tmpBase, 'Vault2');
      await fs.promises.mkdir(v1Path, { recursive: true });
      await fs.promises.mkdir(v2Path, { recursive: true });

      const r1 = await vaultService.openVault({ path: v1Path });
      const r2 = await vaultService.openVault({ path: v2Path });
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) return;

      const listRes = await vaultService.listVaults();
      expect(listRes.ok).toBe(true);
      if (!listRes.ok) return;

      expect(listRes.value.length).toBe(2);
      const v1 = listRes.value.find((v) => v.id === r1.value.vaultId);
      const v2 = listRes.value.find((v) => v.id === r2.value.vaultId);
      expect(v1?.isAvailable).toBe(true);
      expect(v2?.isAvailable).toBe(true);
      expect(v2?.isActive).toBe(true); // last opened is active

      // Switch to v1
      const switchRes = await vaultService.switchVault({ vaultId: r1.value.vaultId });
      expect(switchRes.ok).toBe(true);
      expect(vaultService.getActiveVaultId()).toBe(r1.value.vaultId);

      // Simulate drive unplug / folder deleted for v2
      await fs.promises.rm(v2Path, { recursive: true, force: true });

      const updatedList = await vaultService.listVaults();
      expect(updatedList.ok).toBe(true);
      if (!updatedList.ok) return;

      const v2After = updatedList.value.find((v) => v.id === r2.value.vaultId);
      expect(v2After?.isAvailable).toBe(false);

      // Attempting to switch to unavailable vault is refused
      const refuseRes = await vaultService.switchVault({ vaultId: r2.value.vaultId });
      expect(refuseRes.ok).toBe(false);
      if (!refuseRes.ok) {
        expect(refuseRes.error.kind).toBe('ruleViolation');
      }
    });
  });

  describe('renameVault', () => {
    it('renames display name in vaults.json only without touching disk folder', async () => {
      const vaultFolder = path.join(tmpBase, 'OriginalDiskFolder');
      await fs.promises.mkdir(vaultFolder, { recursive: true });
      const openRes = await vaultService.openVault({ path: vaultFolder });
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      const renameRes = await vaultService.renameVault({
        vaultId: openRes.value.vaultId,
        newName: 'Client Notes Display'
      });
      expect(renameRes.ok).toBe(true);

      // Check vaults.json
      const vaults = await appDataStore.getVaults();
      const updated = vaults.find((v) => v.id === openRes.value.vaultId);
      expect(updated?.name).toBe('Client Notes Display');

      // Verify folder on disk has NOT changed its path
      expect(fs.existsSync(vaultFolder)).toBe(true);
      expect(updated?.path).toBe(path.resolve(vaultFolder));
    });
  });

  describe('removeVault', () => {
    it('removes vault from Wrriter and NEVER deletes any file on disk', async () => {
      const vaultFolder = path.join(tmpBase, 'ImportantVault');
      await fs.promises.mkdir(vaultFolder, { recursive: true });
      const testFile = path.join(vaultFolder, 'ValuableData.md');
      await fs.promises.writeFile(testFile, 'Do not delete me!');

      const openRes = await vaultService.openVault({ path: vaultFolder });
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      const removeRes = await vaultService.removeVault({ vaultId: openRes.value.vaultId });
      expect(removeRes.ok).toBe(true);

      // Verify removed from known vaults
      const vaults = await appDataStore.getVaults();
      expect(vaults.some((v) => v.id === openRes.value.vaultId)).toBe(false);

      // CRITICAL: Verify file on disk is completely untouched!
      expect(fs.existsSync(vaultFolder)).toBe(true);
      expect(fs.existsSync(testFile)).toBe(true);
      expect(await fs.promises.readFile(testFile, 'utf8')).toBe('Do not delete me!');
    });
  });

  describe('locateVault', () => {
    it('re-locates unavailable vault to new path and enforces containment', async () => {
      const oldPath = path.join(tmpBase, 'OldVaultFolder');
      await fs.promises.mkdir(oldPath, { recursive: true });
      const openRes = await vaultService.openVault({ path: oldPath });
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      // Rename folder on disk outside of Wrriter
      const newPath = path.join(tmpBase, 'MovedVaultFolder');
      await fs.promises.rename(oldPath, newPath);

      // Vault is initially marked unavailable
      let list = await vaultService.listVaults();
      expect(list.ok).toBe(true);
      if (list.ok) {
        expect(list.value[0]?.isAvailable).toBe(false);
      }

      // Locate vault to new location
      const locateRes = await vaultService.locateVault({
        vaultId: openRes.value.vaultId,
        newPath
      });
      expect(locateRes.ok).toBe(true);

      // Now marked available again
      list = await vaultService.listVaults();
      expect(list.ok).toBe(true);
      if (list.ok) {
        expect(list.value[0]?.isAvailable).toBe(true);
        expect(list.value[0]?.path).toBe(path.resolve(newPath));
      }
    });
  });

  describe('showInExplorer and selectFolderDialog', () => {
    it('delegates showInExplorer to shellOpenPath', async () => {
      let openedPath: string | null = null;
      const testService = new VaultService({
        appDataStore,
        safeWriter,
        shellOpenPath: async (p) => {
          openedPath = p;
          return '';
        }
      });

      const vaultPath = path.join(tmpBase, 'ExplorerVault');
      await fs.promises.mkdir(vaultPath, { recursive: true });
      const openRes = await testService.openVault({ path: vaultPath });
      expect(openRes.ok).toBe(true);
      if (!openRes.ok) return;

      const res = await testService.showInExplorer({ vaultId: openRes.value.vaultId });
      expect(res.ok).toBe(true);
      expect(openedPath).toBe(path.resolve(vaultPath));
    });

    it('delegates selectFolderDialog to dialogShowOpenDialog', async () => {
      const testService = new VaultService({
        appDataStore,
        safeWriter,
        dialogShowOpenDialog: async () => ({
          canceled: false,
          filePaths: ['C:\\Chosen\\Directory']
        })
      });

      const res = await testService.selectFolderDialog({});
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe('C:\\Chosen\\Directory');
      }
    });

    it('returns null when selectFolderDialog is canceled', async () => {
      const testService = new VaultService({
        appDataStore,
        safeWriter,
        dialogShowOpenDialog: async () => ({
          canceled: true,
          filePaths: []
        })
      });

      const res = await testService.selectFolderDialog({});
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBeNull();
      }
    });
  });

  describe('resolveInsideVault', () => {
    it('restricts resolved path strictly inside the vault root', () => {
      const root = path.resolve(tmpBase, 'VaultRoot');
      const safe = resolveInsideVault(root, 'Notes/Day1.md');
      expect(safe.ok).toBe(true);
      if (safe.ok) {
        expect(safe.value).toBe(path.join(root, 'Notes', 'Day1.md'));
      }

      const malicious = resolveInsideVault(root, '../../Windows/System32/calc.exe');
      expect(malicious.ok).toBe(false);
      if (!malicious.ok) {
        expect(malicious.error.kind).toBe('outsideVault');
      }
    });
  });
});
