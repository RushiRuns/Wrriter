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
export type AccentName = 'yellow' | 'red' | 'blue' | 'green' | 'purple';

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

// 1. window.*
export type WindowMinimizeArgs = Record<string, never>;
export type WindowMaximizeArgs = Record<string, never>;
export type WindowCloseArgs = Record<string, never>;

// 2. vault.*
export interface OpenVaultArgs {
  readonly path: string;
}

export type CloseVaultArgs = Record<string, never>;
export type GetActiveVaultArgs = Record<string, never>;

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
  'vault.open': { args: OpenVaultArgs; result: VaultInfo };
  'vault.close': { args: CloseVaultArgs; result: void };
  'vault.getActive': { args: GetActiveVaultArgs; result: VaultInfo | null };
  'note.read': { args: ReadNoteArgs; result: NoteContent };
  'note.save': { args: SaveNoteArgs; result: SaveOutcome };
  'note.setPinned': { args: SetPinnedArgs; result: void };
  'note.delete': { args: DeleteNoteArgs; result: void };
  'folder.create': { args: CreateFolderArgs; result: void };
  'folder.rename': { args: RenameFolderArgs; result: void };
  'folder.delete': { args: DeleteFolderArgs; result: void };
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

  'vault.open': (input: unknown): Result<OpenVaultArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'vault.close': validateEmptyArgs,
  'vault.getActive': validateEmptyArgs,

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
    if (accent !== 'yellow' && accent !== 'red' && accent !== 'blue' && accent !== 'green' && accent !== 'purple') {
      return err({ kind: 'validation', field: 'accent', reason: 'expected yellow, red, blue, green, or purple' });
    }
    return ok({ accent });
  }
};
