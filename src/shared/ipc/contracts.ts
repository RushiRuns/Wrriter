import { err, ok, type Result } from '../result';
import {
  isObject,
  validateBoolean,
  validateEmptyArgs,
  validateNonEmptyString,
  validateString,
  type Validator
} from './validators';

export type ThemeName = 'light' | 'dark' | 'system';
export type AccentName = 'sky' | 'yellow' | 'coral' | 'mint' | 'lilac';

export interface VaultInfo {
  readonly vaultId: string;
  readonly name: string;
  readonly path: string;
}

export interface NoteContent {
  readonly path: string;
  readonly text: string;
}

export interface SaveOutcome {
  readonly written: boolean;
}

export interface FirstPaintNoteSummary {
  readonly path: string;
  readonly title: string;
  readonly preview: string;
  readonly modified: number;
  readonly pinned?: boolean;
  readonly hasImage?: boolean;
}

export interface StartupState {
  readonly theme: 'light' | 'dark';
  readonly accent: AccentName;
  readonly windowState: {
    readonly width: number;
    readonly height: number;
    readonly isMaximized: boolean;
    readonly sidebarWidth: number;
    readonly listWidth: number;
  };
  readonly activeVault: VaultInfo | null;
  readonly firstPaintNotes: readonly FirstPaintNoteSummary[];
}

// 1. window.*
export type WindowMinimizeArgs = Record<string, never>;
export type WindowMaximizeArgs = Record<string, never>;
export type WindowCloseArgs = Record<string, never>;
export type FirstPaintCompleteArgs = Record<string, never>;
export interface SetPaneWidthsArgs {
  readonly sidebarWidth: number;
  readonly listWidth: number;
}
export type GetStartupStateArgs = Record<string, never>;


// 2. vault.*
export interface VaultListItem {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly isAvailable: boolean;
  readonly isActive: boolean;
}

export interface OpenVaultArgs {
  readonly path: string;
}

export interface CreateVaultArgs {
  readonly path?: string;
}

export type CloseVaultArgs = Record<string, never>;
export type GetActiveVaultArgs = Record<string, never>;
export type ListVaultsArgs = Record<string, never>;

export interface SwitchVaultArgs {
  readonly vaultId: string;
}

export interface RenameVaultArgs {
  readonly vaultId: string;
  readonly newName: string;
}

export interface RemoveVaultArgs {
  readonly vaultId: string;
}

export interface LocateVaultArgs {
  readonly vaultId: string;
  readonly newPath: string;
}

export interface ShowInExplorerArgs {
  readonly vaultId: string;
}

export interface SelectFolderDialogArgs {
  readonly defaultPath?: string;
}

// 3. note.*
export interface ReadNoteArgs {
  readonly path: string;
}

export interface SaveNoteArgs {
  readonly path: string;
  readonly text: string;
}

export interface SetPinnedArgs {
  readonly path: string;
  readonly pinned: boolean;
}

export interface DeleteNoteArgs {
  readonly path: string;
}

// 4. folder.*
export interface CreateFolderArgs {
  readonly path: string;
}

export interface RenameFolderArgs {
  readonly oldPath: string;
  readonly newPath: string;
}

export interface DeleteFolderArgs {
  readonly path: string;
}

// 5. app.*
export type GetThemeArgs = Record<string, never>;
export interface SetThemeArgs {
  readonly theme: ThemeName;
}

export type GetAccentArgs = Record<string, never>;
export interface SetAccentArgs {
  readonly accent: AccentName;
}

// Fixed Channel Registry
export interface IpcChannelTable {
  'window.minimize': { args: WindowMinimizeArgs; result: void };
  'window.maximize': { args: WindowMaximizeArgs; result: void };
  'window.close': { args: WindowCloseArgs; result: void };
  'window.setPaneWidths': { args: SetPaneWidthsArgs; result: void };
  'window.firstPaintComplete': { args: FirstPaintCompleteArgs; result: void };
  'vault.open': { args: OpenVaultArgs; result: VaultInfo };
  'vault.create': { args: CreateVaultArgs; result: VaultInfo };
  'vault.close': { args: CloseVaultArgs; result: void };
  'vault.getActive': { args: GetActiveVaultArgs; result: VaultInfo | null };
  'vault.list': { args: ListVaultsArgs; result: readonly VaultListItem[] };
  'vault.switch': { args: SwitchVaultArgs; result: VaultInfo };
  'vault.rename': { args: RenameVaultArgs; result: void };
  'vault.remove': { args: RemoveVaultArgs; result: void };
  'vault.locate': { args: LocateVaultArgs; result: void };
  'vault.showInExplorer': { args: ShowInExplorerArgs; result: void };
  'vault.selectFolderDialog': { args: SelectFolderDialogArgs; result: string | null };
  'note.read': { args: ReadNoteArgs; result: NoteContent };
  'note.save': { args: SaveNoteArgs; result: SaveOutcome };
  'note.setPinned': { args: SetPinnedArgs; result: void };
  'note.delete': { args: DeleteNoteArgs; result: void };
  'folder.create': { args: CreateFolderArgs; result: void };
  'folder.rename': { args: RenameFolderArgs; result: void };
  'folder.delete': { args: DeleteFolderArgs; result: void };
  'app.getStartupState': { args: GetStartupStateArgs; result: StartupState };
  'app.getTheme': { args: GetThemeArgs; result: ThemeName };
  'app.setTheme': { args: SetThemeArgs; result: void };
  'app.getAccent': { args: GetAccentArgs; result: AccentName };
  'app.setAccent': { args: SetAccentArgs; result: void };
}

export type IpcChannel = keyof IpcChannelTable;

// Validators for each channel's arguments
export const IPC_VALIDATORS: { readonly [K in IpcChannel]: Validator<IpcChannelTable[K]['args']> } = {
  'window.minimize': validateEmptyArgs,
  'window.maximize': validateEmptyArgs,
  'window.close': validateEmptyArgs,
  'window.firstPaintComplete': validateEmptyArgs,

  'window.setPaneWidths': (input: unknown): Result<SetPaneWidthsArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const sidebarWidth = typeof input['sidebarWidth'] === 'number' && !isNaN(input['sidebarWidth']) ? input['sidebarWidth'] : null;
    const listWidth = typeof input['listWidth'] === 'number' && !isNaN(input['listWidth']) ? input['listWidth'] : null;
    if (sidebarWidth === null) return err({ kind: 'validation', field: 'sidebarWidth', reason: 'expected number' });
    if (listWidth === null) return err({ kind: 'validation', field: 'listWidth', reason: 'expected number' });
    return ok({ sidebarWidth, listWidth });
  },

  'vault.open': (input: unknown): Result<OpenVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'vault.create': (input: unknown): Result<CreateVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    if (input['path'] !== undefined) {
      const p = validateNonEmptyString('path', input['path']);
      if (!p.ok) return p;
      return ok({ path: p.value });
    }
    return ok({});
  },

  'vault.close': validateEmptyArgs,
  'vault.getActive': validateEmptyArgs,
  'vault.list': validateEmptyArgs,

  'vault.switch': (input: unknown): Result<SwitchVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const vaultId = validateNonEmptyString('vaultId', input['vaultId']);
    if (!vaultId.ok) return vaultId;
    return ok({ vaultId: vaultId.value });
  },

  'vault.rename': (input: unknown): Result<RenameVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const vaultId = validateNonEmptyString('vaultId', input['vaultId']);
    if (!vaultId.ok) return vaultId;
    const newName = validateNonEmptyString('newName', input['newName']);
    if (!newName.ok) return newName;
    return ok({ vaultId: vaultId.value, newName: newName.value });
  },

  'vault.remove': (input: unknown): Result<RemoveVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const vaultId = validateNonEmptyString('vaultId', input['vaultId']);
    if (!vaultId.ok) return vaultId;
    return ok({ vaultId: vaultId.value });
  },

  'vault.locate': (input: unknown): Result<LocateVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const vaultId = validateNonEmptyString('vaultId', input['vaultId']);
    if (!vaultId.ok) return vaultId;
    const newPath = validateNonEmptyString('newPath', input['newPath']);
    if (!newPath.ok) return newPath;
    return ok({ vaultId: vaultId.value, newPath: newPath.value });
  },

  'vault.showInExplorer': (input: unknown): Result<ShowInExplorerArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const vaultId = validateNonEmptyString('vaultId', input['vaultId']);
    if (!vaultId.ok) return vaultId;
    return ok({ vaultId: vaultId.value });
  },

  'vault.selectFolderDialog': (input: unknown): Result<SelectFolderDialogArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    if (input['defaultPath'] !== undefined) {
      const p = validateNonEmptyString('defaultPath', input['defaultPath']);
      if (!p.ok) return p;
      return ok({ defaultPath: p.value });
    }
    return ok({});
  },

  'note.read': (input: unknown): Result<ReadNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'note.save': (input: unknown): Result<SaveNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    const text = validateString('text', input['text']);
    if (!text.ok) return text;
    return ok({ path: path.value, text: text.value });
  },

  'note.setPinned': (input: unknown): Result<SetPinnedArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    const pinned = validateBoolean('pinned', input['pinned']);
    if (!pinned.ok) return pinned;
    return ok({ path: path.value, pinned: pinned.value });
  },

  'note.delete': (input: unknown): Result<DeleteNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'folder.create': (input: unknown): Result<CreateFolderArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'folder.rename': (input: unknown): Result<RenameFolderArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const oldPath = validateNonEmptyString('oldPath', input['oldPath']);
    if (!oldPath.ok) return oldPath;
    const newPath = validateNonEmptyString('newPath', input['newPath']);
    if (!newPath.ok) return newPath;
    return ok({ oldPath: oldPath.value, newPath: newPath.value });
  },

  'folder.delete': (input: unknown): Result<DeleteFolderArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'app.getStartupState': validateEmptyArgs,

  'app.getTheme': validateEmptyArgs,

  'app.setTheme': (input: unknown): Result<SetThemeArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const theme = input['theme'];
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      return err({ kind: 'validation', field: 'theme', reason: 'expected light, dark, or system' });
    }
    return ok({ theme });
  },

  'app.getAccent': validateEmptyArgs,

  'app.setAccent': (input: unknown): Result<SetAccentArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const accent = input['accent'];
    if (accent !== 'sky' && accent !== 'yellow' && accent !== 'coral' && accent !== 'mint' && accent !== 'lilac') {
      return err({ kind: 'validation', field: 'accent', reason: 'expected sky, yellow, coral, mint, or lilac' });
    }
    return ok({ accent });
  }
};

