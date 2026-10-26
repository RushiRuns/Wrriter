import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { dialog, shell } from 'electron';
import { AppDataStore, type KnownVault } from '../store/app-data-store';
import { SafeWriter } from './safe-writer';
import { Result, ok, err } from '../../shared/result';
import type {
  CreateVaultArgs,
  LocateVaultArgs,
  OpenVaultArgs,
  RenameVaultArgs,
  RemoveVaultArgs,
  SelectFolderDialogArgs,
  ShowInExplorerArgs,
  SwitchVaultArgs,
  VaultInfo,
  VaultListItem
} from '../../shared/ipc/contracts';
import { resolveInsideVault } from './vault-reader';

export { resolveInsideVault };

export interface VaultServiceOptions {
  appDataStore: AppDataStore;
  safeWriter?: SafeWriter | undefined;
  suggestedDocsDir?: string | undefined;
  dialogShowOpenDialog?: ((options: any) => Promise<{ canceled: boolean; filePaths: string[] }>) | undefined;
  shellOpenPath?: ((fullPath: string) => Promise<string>) | undefined;
  onActiveVaultChanged?: ((vault: KnownVault | null) => Promise<void> | void) | undefined;
}

/**
 * Validates that candidatePath does not nest inside any existing vault,
 * and does not contain any existing vault.
 */
export function checkVaultContainment(
  candidatePath: string,
  existingVaults: readonly KnownVault[],
  ignoreVaultId?: string
): Result<void> {
  const normCandidate = path.resolve(candidatePath);
  const normCandidateWithSep = normCandidate.endsWith(path.sep) ? normCandidate : normCandidate + path.sep;
  const candidateLower = normCandidateWithSep.toLowerCase();

  for (const vault of existingVaults) {
    if (ignoreVaultId && vault.id === ignoreVaultId) continue;
    const normVault = path.resolve(vault.path);
    const normVaultWithSep = normVault.endsWith(path.sep) ? normVault : normVault + path.sep;
    const vaultLower = normVaultWithSep.toLowerCase();

    // Exact match is not a containment conflict
    if (candidateLower === vaultLower) {
      continue;
    }

    // Candidate is inside an existing vault
    if (candidateLower.startsWith(vaultLower)) {
      return err({
        kind: 'ruleViolation',
        rule: `Cannot open folder: "${path.basename(normCandidate)}" is inside an existing vault ("${vault.name}"). Nested vaults are not permitted.`
      });
    }

    // Candidate contains an existing vault
    if (vaultLower.startsWith(candidateLower)) {
      return err({
        kind: 'ruleViolation',
        rule: `Cannot open folder: "${path.basename(normCandidate)}" contains an existing vault ("${vault.name}"). Containing vaults are not permitted.`
      });
    }
  }

  return ok(undefined);
}

export class VaultService {
  private readonly appDataStore: AppDataStore;
  private readonly safeWriter: SafeWriter;
  private readonly suggestedDocsDir: string | undefined;
  private readonly dialogShowOpenDialog:
    | ((options: any) => Promise<{ canceled: boolean; filePaths: string[] }>)
    | undefined;
  private readonly shellOpenPath: ((fullPath: string) => Promise<string>) | undefined;
  private readonly onActiveVaultChanged:
    | ((vault: KnownVault | null) => Promise<void> | void)
    | undefined;

  private activeVaultId: string | null = null;

  constructor(options: VaultServiceOptions) {
    this.appDataStore = options.appDataStore;
    this.safeWriter = options.safeWriter ?? new SafeWriter();
    this.suggestedDocsDir = options.suggestedDocsDir;
    this.dialogShowOpenDialog = options.dialogShowOpenDialog;
    this.shellOpenPath = options.shellOpenPath;
    this.onActiveVaultChanged = options.onActiveVaultChanged;
  }

  /**
   * Initializes active vault state from AppData store.
   */
  async initialize(): Promise<void> {
    const vaults = await this.appDataStore.getVaults();
    if (vaults.length > 0) {
      const sorted = vaults.slice().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      const available = sorted.find((v) => fs.existsSync(v.path));
      this.activeVaultId = available ? available.id : (sorted[0]?.id ?? null);
    } else {
      this.activeVaultId = null;
    }
  }

  getActiveVaultId(): string | null {
    return this.activeVaultId;
  }

  setActiveVaultId(id: string | null): void {
    this.activeVaultId = id;
  }

  /**
   * Returns current active vault details, or null if no vault is currently open.
   */
  async getActiveVault(): Promise<Result<VaultInfo | null>> {
    if (!this.activeVaultId) {
      return ok(null);
    }
    const vaults = await this.appDataStore.getVaults();
    const active = vaults.find((v) => v.id === this.activeVaultId);
    if (!active || !fs.existsSync(active.path)) {
      return ok(null);
    }
    return ok({
      vaultId: active.id,
      name: active.name,
      path: active.path
    });
  }

  /**
   * Lists all known vaults, reporting their availability on disk and active state.
   */
  async listVaults(): Promise<Result<readonly VaultListItem[]>> {
    const vaults = await this.appDataStore.getVaults();
    const items: VaultListItem[] = vaults.map((v) => {
      const isAvailable = fs.existsSync(v.path);
      return {
        id: v.id,
        name: v.name,
        path: v.path,
        isAvailable,
        isActive: v.id === this.activeVaultId
      };
    });
    return ok(items);
  }

  /**
   * Opens an existing folder on disk as a vault:
   * 1. Validates path exists and is a directory.
   * 2. Checks containment against other known vaults.
   * 3. Writes .wrriter/vault.json with UUID v4 if not already present.
   * 4. Updates AppDataStore vaults.json without altering any note files.
   */
  async openVault(args: OpenVaultArgs): Promise<Result<VaultInfo>> {
    const normalizedPath = path.resolve(args.path);

    // 1. Verify existence and directory type
    try {
      const stat = await fs.promises.stat(normalizedPath);
      if (!stat.isDirectory()) {
        return err({ kind: 'validation', field: 'path', reason: 'Selected path is not a directory' });
      }
    } catch {
      return err({ kind: 'validation', field: 'path', reason: 'Folder does not exist on disk' });
    }

    // 2. Check containment against existing vaults
    const vaults = await this.appDataStore.getVaults();
    const existingSamePath = vaults.find(
      (v) => path.resolve(v.path).toLowerCase() === normalizedPath.toLowerCase()
    );

    const containmentCheck = checkVaultContainment(
      normalizedPath,
      vaults,
      existingSamePath ? existingSamePath.id : undefined
    );
    if (!containmentCheck.ok) {
      return containmentCheck;
    }

    // 3. Ensure .wrriter/vault.json exists with UUID v4
    const wrriterDir = path.join(normalizedPath, '.wrriter');
    const vaultJsonFile = path.join(wrriterDir, 'vault.json');
    let vaultId: string | null = null;

    if (fs.existsSync(vaultJsonFile)) {
      try {
        const raw = await fs.promises.readFile(vaultJsonFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.vaultId === 'string' && parsed.vaultId.trim().length > 0) {
          vaultId = parsed.vaultId.trim();
        }
      } catch {
        // Corrupted or unreadable, will generate new ID
      }
    }

    if (!vaultId) {
      vaultId = crypto.randomUUID();
      const metaPayload = JSON.stringify({ version: 1, vaultId }, null, 2);
      const writeOutcome = await this.safeWriter.write(normalizedPath, '.wrriter/vault.json', metaPayload);
      if (!writeOutcome.ok) {
        return writeOutcome;
      }
    }

    // 4. Update known vaults in AppDataStore
    const now = Date.now();
    let updatedVaults: KnownVault[];
    let vaultName = path.basename(normalizedPath) || 'Vault';

    if (existingSamePath) {
      vaultName = existingSamePath.name;
      updatedVaults = vaults.map((v) =>
        v.id === existingSamePath.id
          ? { ...v, id: vaultId!, lastOpenedAt: now }
          : v
      );
    } else {
      const existingById = vaults.find((v) => v.id === vaultId);
      if (existingById) {
        vaultName = existingById.name;
        updatedVaults = vaults.map((v) =>
          v.id === vaultId
            ? { ...v, path: normalizedPath, lastOpenedAt: now }
            : v
        );
      } else {
        const newVault: KnownVault = {
          id: vaultId,
          name: vaultName,
          path: normalizedPath,
          createdAt: now,
          lastOpenedAt: now
        };
        updatedVaults = [...vaults, newVault];
      }
    }

    const saveRes = await this.appDataStore.saveVaults(updatedVaults);
    if (!saveRes.ok) {
      return saveRes;
    }

    this.activeVaultId = vaultId;
    const activeVaultRecord = updatedVaults.find((v) => v.id === vaultId)!;
    if (this.onActiveVaultChanged) {
      await this.onActiveVaultChanged(activeVaultRecord);
    }

    return ok({
      vaultId,
      name: vaultName,
      path: normalizedPath
    });
  }

  /**
   * Creates a new vault folder:
   * Defaults to Documents\Wrriter if path not provided.
   */
  async createVault(args: CreateVaultArgs = {}): Promise<Result<VaultInfo>> {
    let targetPath: string;
    if (args.path && args.path.trim().length > 0) {
      targetPath = path.resolve(args.path.trim());
    } else {
      const docsDir = this.suggestedDocsDir ?? path.join(os.homedir(), 'Documents');
      targetPath = path.join(docsDir, 'Wrriter');
    }

    // Create target directory if needed
    try {
      await fs.promises.mkdir(targetPath, { recursive: true });
    } catch (error: any) {
      return err({
        kind: 'unexpected',
        message: `Failed to create folder at ${targetPath}: ${error?.message || String(error)}`
      });
    }

    return this.openVault({ path: targetPath });
  }

  /**
   * Switches the active vault to a different known vault.
   */
  async switchVault(args: SwitchVaultArgs): Promise<Result<VaultInfo>> {
    const vaults = await this.appDataStore.getVaults();
    const vault = vaults.find((v) => v.id === args.vaultId);
    if (!vault) {
      return err({ kind: 'notFound' });
    }

    if (!fs.existsSync(vault.path)) {
      return err({
        kind: 'ruleViolation',
        rule: `Vault "${vault.name}" is unavailable: folder does not exist or drive is unplugged.`
      });
    }

    const now = Date.now();
    const updated = vaults.map((v) => (v.id === vault.id ? { ...v, lastOpenedAt: now } : v));
    await this.appDataStore.saveVaults(updated);

    this.activeVaultId = vault.id;
    if (this.onActiveVaultChanged) {
      await this.onActiveVaultChanged(vault);
    }

    return ok({
      vaultId: vault.id,
      name: vault.name,
      path: vault.path
    });
  }

  /**
   * Renames the display name of a vault in vaults.json only.
   * Never renames the folder on disk.
   */
  async renameVault(args: RenameVaultArgs): Promise<Result<void>> {
    const newName = args.newName.trim();
    if (newName.length === 0) {
      return err({ kind: 'validation', field: 'newName', reason: 'Vault display name cannot be empty' });
    }

    const vaults = await this.appDataStore.getVaults();
    const vault = vaults.find((v) => v.id === args.vaultId);
    if (!vault) {
      return err({ kind: 'notFound' });
    }

    const updated = vaults.map((v) => (v.id === args.vaultId ? { ...v, name: newName } : v));
    return this.appDataStore.saveVaults(updated);
  }

  /**
   * Removes a vault from Wrriter's known vaults list.
   * NEVER deletes any files or directories on disk.
   */
  async removeVault(args: RemoveVaultArgs): Promise<Result<void>> {
    const vaults = await this.appDataStore.getVaults();
    const filtered = vaults.filter((v) => v.id !== args.vaultId);
    const saveRes = await this.appDataStore.saveVaults(filtered);
    if (!saveRes.ok) return saveRes;

    if (this.activeVaultId === args.vaultId) {
      const remainingAvailable = filtered.filter((v) => fs.existsSync(v.path));
      if (remainingAvailable.length > 0) {
        const next = remainingAvailable.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0]!;
        this.activeVaultId = next.id;
        if (this.onActiveVaultChanged) {
          await this.onActiveVaultChanged(next);
        }
      } else {
        this.activeVaultId = null;
        if (this.onActiveVaultChanged) {
          await this.onActiveVaultChanged(null);
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Re-locates an unavailable vault to a new path on disk.
   */
  async locateVault(args: LocateVaultArgs): Promise<Result<void>> {
    const normalizedNewPath = path.resolve(args.newPath);

    // 1. Verify existence
    try {
      const stat = await fs.promises.stat(normalizedNewPath);
      if (!stat.isDirectory()) {
        return err({ kind: 'validation', field: 'newPath', reason: 'Selected path is not a directory' });
      }
    } catch {
      return err({ kind: 'validation', field: 'newPath', reason: 'Folder does not exist on disk' });
    }

    const vaults = await this.appDataStore.getVaults();
    const vault = vaults.find((v) => v.id === args.vaultId);
    if (!vault) {
      return err({ kind: 'notFound' });
    }

    // 2. Containment check
    const containmentCheck = checkVaultContainment(normalizedNewPath, vaults, args.vaultId);
    if (!containmentCheck.ok) {
      return containmentCheck;
    }

    // 3. Ensure .wrriter/vault.json in new location matches or gets created
    const vaultJsonFile = path.join(normalizedNewPath, '.wrriter', 'vault.json');
    if (!fs.existsSync(vaultJsonFile)) {
      await this.safeWriter.write(
        normalizedNewPath,
        '.wrriter/vault.json',
        JSON.stringify({ version: 1, vaultId: vault.id }, null, 2)
      );
    }

    // 4. Update path in vaults.json
    const updated = vaults.map((v) =>
      v.id === args.vaultId ? { ...v, path: normalizedNewPath, lastOpenedAt: Date.now() } : v
    );
    return this.appDataStore.saveVaults(updated);
  }

  /**
   * Reveals the vault folder in Windows File Explorer.
   */
  async showInExplorer(args: ShowInExplorerArgs): Promise<Result<void>> {
    const vaults = await this.appDataStore.getVaults();
    const vault = vaults.find((v) => v.id === args.vaultId);
    if (!vault) {
      return err({ kind: 'notFound' });
    }

    if (!fs.existsSync(vault.path)) {
      return err({ kind: 'ruleViolation', rule: 'Vault path does not exist on disk' });
    }

    try {
      if (this.shellOpenPath) {
        await this.shellOpenPath(vault.path);
      } else if (shell?.openPath) {
        await shell.openPath(vault.path);
      }
      return ok(undefined);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || String(error) });
    }
  }

  /**
   * Prompts native folder selection dialog.
   */
  async selectFolderDialog(args: SelectFolderDialogArgs = {}): Promise<Result<string | null>> {
    try {
      let result: { canceled: boolean; filePaths: string[] };
      const dialogOpts: any = { properties: ['openDirectory'] };
      if (args.defaultPath !== undefined) {
        dialogOpts.defaultPath = args.defaultPath;
      }

      if (this.dialogShowOpenDialog) {
        result = await this.dialogShowOpenDialog(dialogOpts);
      } else if (dialog?.showOpenDialog) {
        result = await dialog.showOpenDialog(dialogOpts);
      } else {
        return ok(null);
      }

      if (result.canceled || result.filePaths.length === 0) {
        return ok(null);
      }
      return ok(result.filePaths[0] ?? null);
    } catch (error: any) {
      return err({ kind: 'unexpected', message: error?.message || String(error) });
    }
  }

  /**
   * Closes active vault without removing it from known vaults.
   */
  async closeVault(): Promise<Result<void>> {
    this.activeVaultId = null;
    if (this.onActiveVaultChanged) {
      await this.onActiveVaultChanged(null);
    }
    return ok(undefined);
  }
}
