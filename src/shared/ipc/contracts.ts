import { err, ok, type Result } from '../result';
import {
  isObject,
  validateBoolean,
  validateEmptyArgs,
  validateNonEmptyString,
  validateString,
  validateUint8Array,
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
  readonly modified?: number | undefined;
}

export interface SaveOutcome {
  readonly written: boolean;
  readonly modified?: number | undefined;
}

export interface FirstPaintNoteSummary {
  readonly path: string;
  readonly title: string;
  readonly preview: string;
  readonly modified: number;
  readonly pinned?: boolean;
  readonly hasImage?: boolean;
  readonly imageSrc?: string;
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
  readonly openTabs?: readonly string[];
  readonly activeTabPath?: string | null;
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
export interface SetOpenTabsArgs {
  readonly openTabs: readonly string[];
  readonly activeTabPath: string | null;
}
export type GetStartupStateArgs = Record<string, never>;
export type OpenLogFolderArgs = Record<string, never>;


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
  readonly vaultId?: string | undefined;
  readonly path?: string | undefined;
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

export interface ListNotesArgs {
  readonly folder?: string;
  readonly tag?: string;
  readonly sortBy?: 'manual' | 'modified' | 'created' | 'title';
}

export interface NoteListItem {
  readonly path: string;
  readonly title: string;
  readonly preview: string;
  readonly modified: number;
  readonly pinned: boolean;
  readonly hasImage?: boolean | undefined;
  readonly imageSrc?: string | undefined;
  readonly orderKey?: string | undefined;
}

export interface SetNoteOrderArgs {
  readonly path: string;
  readonly folder?: string;
  readonly beforeKey?: string;
  readonly afterKey?: string;
}

export interface RenameNoteArgs {
  readonly oldPath: string;
  readonly newPath: string;
}

export interface MoveNoteArgs {
  readonly oldPath: string;
  readonly newPath: string;
}

export interface DuplicateNoteArgs {
  readonly path: string;
}

export interface DuplicateNoteResult {
  readonly path: string;
  readonly title: string;
}

export interface NoteJobResult {
  readonly jobId?: string | undefined;
  readonly affectedCount: number;
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

export interface FolderNode {
  readonly name: string;
  readonly relPath: string;
  readonly parentPath: string;
  readonly children: readonly FolderNode[];
  readonly noteCount: number;
}

export type ListFoldersArgs = Record<string, never>;

// 5. app.*
export type GetThemeArgs = Record<string, never>;
export interface SetThemeArgs {
  readonly theme: ThemeName;
}

export type GetAccentArgs = Record<string, never>;
export interface SetAccentArgs {
  readonly accent: AccentName;
}

export interface AppSettingsContract {
  readonly theme: 'light' | 'dark' | 'follow-windows';
  readonly accent: 'sky' | 'yellow' | 'coral' | 'mint' | 'lilac';
  readonly motion: 'follow-windows' | 'reduced' | 'full';
  readonly noteMargin: number;
  readonly keepRunningInBackground: boolean;
  readonly startWithWindows: boolean;
  readonly captureHotkey: string;
  readonly captureVault: 'last-active' | string;
  readonly noteList: {
    readonly sortBy: 'manual' | 'modified' | 'created' | 'title';
    readonly showSortIcon: boolean;
    readonly showPreviews: boolean;
    readonly showDates: boolean;
    readonly showImages: boolean;
  };
  readonly dragHintShown: boolean;
}

export type GetSettingsArgs = Record<string, never>;
export type SaveSettingsArgs = Partial<AppSettingsContract>;

export interface GetHotkeyStatusArgs {
  readonly hotkey?: string | undefined;
}

export interface HotkeyStatusResult {
  readonly registered: boolean;
  readonly accelerator: string;
  readonly error?: string | undefined;
}

// 5b. capture.*
export type OpenQuickCaptureArgs = Record<string, never>;

export interface OpenPopOutArgs {
  readonly path: string;
}

export interface OpenInMainWindowArgs {
  readonly path: string;
}

export interface SetAlwaysOnTopArgs {
  readonly alwaysOnTop: boolean;
}

export type GetCaptureStateArgs = Record<string, never>;

export interface CaptureStateResult {
  readonly mode: 'quick-capture' | 'pop-out';
  readonly path?: string | undefined;
  readonly isAlwaysOnTop: boolean;
  readonly title?: string | undefined;
  readonly activeVaultName?: string | undefined;
}

export interface SaveQuickNoteArgs {
  readonly text: string;
  readonly path?: string | undefined;
}

export interface SaveQuickNoteResult {
  readonly path: string;
  readonly title: string;
  readonly written: boolean;
}

// 6. index.*
export interface IndexGetNotesArgs {
  readonly folder?: string | undefined;
  readonly tag?: string | undefined;
  readonly sortBy?: 'manual' | 'modified' | 'created' | 'title' | undefined;
  readonly after?: { readonly path: string; readonly sortVal: string | number } | null | undefined;
  readonly limit?: number | undefined;
}

export type IndexGetFolderCountsArgs = Record<string, never>;
export type IndexGetTitleListArgs = Record<string, never>;

export interface IndexSearchArgs {
  readonly query: string;
  readonly limit?: number | undefined;
}

export type IndexGetStatusArgs = Record<string, never>;
export type IndexGetStatusesArgs = Record<string, never>;
export type IndexGetTagsArgs = Record<string, never>;
export type IndexGetTagCountsArgs = Record<string, never>;

export interface IndexGetBacklinksArgs {
  readonly target: string;
  readonly altTarget?: string | undefined;
}

export interface BacklinkRecord {
  readonly sourcePath: string;
  readonly sourceTitle: string;
  readonly targetName: string;
  readonly lineText: string;
  readonly modified: number;
}

export interface IndexTagCount {
  readonly tag: string;
  readonly count: number;
}

// 7. tag.*
export interface TagRenameArgs {
  readonly oldTag: string;
  readonly newTag: string;
}

export interface TagRenameResult {
  readonly jobId: string;
  readonly affectedCount: number;
}

export interface IndexSearchResultItem {
  readonly path: string;
  readonly title: string;
  readonly folder: string;
  readonly mtime_ms: number;
  readonly preview: string;
  readonly snippet: string;
  readonly rank: number;
}

export interface IndexFolderCount {
  readonly folder: string;
  readonly count: number;
}

export interface IndexTitleItem {
  readonly path: string;
  readonly title: string;
  readonly mtime_ms: number;
}

export interface IndexStatus {
  readonly isIndexing: boolean;
  readonly totalNotes: number;
}

export interface AttachmentSaveArgs {
  readonly notePath: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface AttachmentSaveResult {
  readonly fileName: string;
  readonly relativePath: string;
  readonly encodedPath: string;
  readonly isImage: boolean;
  readonly size: number;
  readonly markdown: string;
}

export interface AttachmentSavePastedImageArgs {
  readonly notePath: string;
  readonly bytes: Uint8Array;
}

export interface AttachmentGetInfoArgs {
  readonly notePath: string;
  readonly path: string;
}

export interface AttachmentGetInfoResult {
  readonly exists: boolean;
  readonly size: number;
  readonly formattedSize: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly absolutePath: string;
}

export interface AttachmentOpenArgs {
  readonly notePath: string;
  readonly path: string;
}

export interface AttachmentShowInExplorerArgs {
  readonly notePath: string;
  readonly path: string;
}

// Fixed Channel Registry
export interface IpcChannelTable {
  'window.minimize': { args: WindowMinimizeArgs; result: void };
  'window.maximize': { args: WindowMaximizeArgs; result: void };
  'window.close': { args: WindowCloseArgs; result: void };
  'window.setPaneWidths': { args: SetPaneWidthsArgs; result: void };
  'window.setOpenTabs': { args: SetOpenTabsArgs; result: void };
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
  'note.list': { args: ListNotesArgs; result: readonly NoteListItem[] };
  'note.setOrder': { args: SetNoteOrderArgs; result: void };
  'note.rename': { args: RenameNoteArgs; result: NoteJobResult };
  'note.move': { args: MoveNoteArgs; result: NoteJobResult };
  'note.duplicate': { args: DuplicateNoteArgs; result: DuplicateNoteResult };
  'folder.create': { args: CreateFolderArgs; result: void };
  'folder.rename': { args: RenameFolderArgs; result: void };
  'folder.delete': { args: DeleteFolderArgs; result: void };
  'folder.list': { args: ListFoldersArgs; result: readonly FolderNode[] };
  'app.getStartupState': { args: GetStartupStateArgs; result: StartupState };
  'app.getTheme': { args: GetThemeArgs; result: ThemeName };
  'app.setTheme': { args: SetThemeArgs; result: void };
  'app.getAccent': { args: GetAccentArgs; result: AccentName };
  'app.setAccent': { args: SetAccentArgs; result: void };
  'app.getSettings': { args: GetSettingsArgs; result: AppSettingsContract };
  'app.saveSettings': { args: SaveSettingsArgs; result: AppSettingsContract };
  'app.getHotkeyStatus': { args: GetHotkeyStatusArgs; result: HotkeyStatusResult };
  'app.openLogFolder': { args: OpenLogFolderArgs; result: void };
  'capture.openQuickCapture': { args: OpenQuickCaptureArgs; result: void };
  'capture.openPopOut': { args: OpenPopOutArgs; result: void };
  'capture.openInMainWindow': { args: OpenInMainWindowArgs; result: void };
  'capture.setAlwaysOnTop': { args: SetAlwaysOnTopArgs; result: void };
  'capture.getCaptureState': { args: GetCaptureStateArgs; result: CaptureStateResult };
  'capture.saveQuickNote': { args: SaveQuickNoteArgs; result: SaveQuickNoteResult };
  'index.getNotes': { args: IndexGetNotesArgs; result: readonly NoteListItem[] };
  'index.getFolderCounts': { args: IndexGetFolderCountsArgs; result: readonly IndexFolderCount[] };
  'index.getTitleList': { args: IndexGetTitleListArgs; result: readonly IndexTitleItem[] };
  'index.search': { args: IndexSearchArgs; result: readonly IndexSearchResultItem[] };
  'index.getStatus': { args: IndexGetStatusArgs; result: IndexStatus };
  'index.getStatuses': { args: IndexGetStatusesArgs; result: readonly string[] };
  'index.getTags': { args: IndexGetTagsArgs; result: readonly string[] };
  'index.getTagCounts': { args: IndexGetTagCountsArgs; result: readonly IndexTagCount[] };
  'index.getBacklinks': { args: IndexGetBacklinksArgs; result: readonly BacklinkRecord[] };
  'tag.rename': { args: TagRenameArgs; result: TagRenameResult };
  'attachment.save': { args: AttachmentSaveArgs; result: AttachmentSaveResult };
  'attachment.savePastedImage': { args: AttachmentSavePastedImageArgs; result: AttachmentSaveResult };
  'attachment.getInfo': { args: AttachmentGetInfoArgs; result: AttachmentGetInfoResult };
  'attachment.open': { args: AttachmentOpenArgs; result: void };
  'attachment.showInExplorer': { args: AttachmentShowInExplorerArgs; result: void };
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

  'window.setOpenTabs': (input: unknown): Result<SetOpenTabsArgs> => {
    if (!isObject(input) || !Array.isArray(input['openTabs'])) {
      return err({ kind: 'validation', field: 'openTabs', reason: 'expected array of strings' });
    }
    const openTabs = (input['openTabs'] as unknown[]).filter((t): t is string => typeof t === 'string');
    const activeTabPath = typeof input['activeTabPath'] === 'string' ? input['activeTabPath'] : null;
    return ok({ openTabs, activeTabPath });
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
    const vaultId = typeof input['vaultId'] === 'string' && input['vaultId'].length > 0 ? input['vaultId'] : undefined;
    const p = typeof input['path'] === 'string' && input['path'].length > 0 ? input['path'] : undefined;
    if (!vaultId && !p) return err({ kind: 'validation', field: 'vaultId', reason: 'expected vaultId or path' });
    return ok({ vaultId, path: p });
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

  'note.list': (input: unknown): Result<ListNotesArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const res: { folder?: string; tag?: string; sortBy?: 'manual' | 'modified' | 'created' | 'title' } = {};
    if (typeof input['folder'] === 'string') {
      res.folder = input['folder'];
    }
    if (typeof input['tag'] === 'string') {
      res.tag = input['tag'];
    }
    if (typeof input['sortBy'] === 'string') {
      if (input['sortBy'] === 'manual' || input['sortBy'] === 'modified' || input['sortBy'] === 'created' || input['sortBy'] === 'title') {
        res.sortBy = input['sortBy'];
      }
    }
    return ok(res);
  },

  'note.setOrder': (input: unknown): Result<SetNoteOrderArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    const res: { path: string; folder?: string; beforeKey?: string; afterKey?: string } = { path: path.value };
    if (typeof input['folder'] === 'string') res.folder = input['folder'];
    if (typeof input['beforeKey'] === 'string') res.beforeKey = input['beforeKey'];
    if (typeof input['afterKey'] === 'string') res.afterKey = input['afterKey'];
    return ok(res);
  },

  'note.rename': (input: unknown): Result<RenameNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const oldPath = validateNonEmptyString('oldPath', input['oldPath']);
    if (!oldPath.ok) return oldPath;
    const newPath = validateNonEmptyString('newPath', input['newPath']);
    if (!newPath.ok) return newPath;
    return ok({ oldPath: oldPath.value, newPath: newPath.value });
  },

  'note.move': (input: unknown): Result<MoveNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const oldPath = validateNonEmptyString('oldPath', input['oldPath']);
    if (!oldPath.ok) return oldPath;
    const newPath = validateNonEmptyString('newPath', input['newPath']);
    if (!newPath.ok) return newPath;
    return ok({ oldPath: oldPath.value, newPath: newPath.value });
  },

  'note.duplicate': (input: unknown): Result<DuplicateNoteArgs> => {
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

  'folder.list': validateEmptyArgs,

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
  },

  'app.getSettings': validateEmptyArgs,

  'app.saveSettings': (input: unknown): Result<SaveSettingsArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    return ok(input as SaveSettingsArgs);
  },

  'app.getHotkeyStatus': (input: unknown): Result<GetHotkeyStatusArgs> => {
    if (!isObject(input)) return ok({});
    const hotkey = typeof input['hotkey'] === 'string' ? input['hotkey'] : undefined;
    return ok({ hotkey });
  },

  'app.openLogFolder': validateEmptyArgs,

  'capture.openQuickCapture': validateEmptyArgs,

  'capture.openPopOut': (input: unknown): Result<OpenPopOutArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'capture.openInMainWindow': (input: unknown): Result<OpenInMainWindowArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const path = validateNonEmptyString('path', input['path']);
    if (!path.ok) return path;
    return ok({ path: path.value });
  },

  'capture.setAlwaysOnTop': (input: unknown): Result<SetAlwaysOnTopArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const alwaysOnTop = validateBoolean('alwaysOnTop', input['alwaysOnTop']);
    if (!alwaysOnTop.ok) return alwaysOnTop;
    return ok({ alwaysOnTop: alwaysOnTop.value });
  },

  'capture.getCaptureState': validateEmptyArgs,

  'capture.saveQuickNote': (input: unknown): Result<SaveQuickNoteArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const text = validateString('text', input['text']);
    if (!text.ok) return text;
    const path = typeof input['path'] === 'string' && input['path'].trim() ? input['path'].trim() : undefined;
    return ok({ text: text.value, path });
  },

  'index.getNotes': (input: unknown): Result<IndexGetNotesArgs> => {
    if (!isObject(input)) return ok({});
    const res: {
      folder?: string | undefined;
      tag?: string | undefined;
      sortBy?: 'manual' | 'modified' | 'created' | 'title' | undefined;
      after?: { path: string; sortVal: string | number } | null | undefined;
      limit?: number | undefined;
    } = {};
    if (typeof input['folder'] === 'string') res.folder = input['folder'];
    if (typeof input['tag'] === 'string') res.tag = input['tag'];
    if (
      typeof input['sortBy'] === 'string' &&
      (input['sortBy'] === 'manual' || input['sortBy'] === 'modified' || input['sortBy'] === 'created' || input['sortBy'] === 'title')
    ) {
      res.sortBy = input['sortBy'];
    }
    if (isObject(input['after'])) {
      const p = input['after']['path'];
      const sv = input['after']['sortVal'];
      if (typeof p === 'string' && (typeof sv === 'string' || typeof sv === 'number')) {
        res.after = { path: p, sortVal: sv };
      }
    } else if (input['after'] === null) {
      res.after = null;
    }
    if (typeof input['limit'] === 'number' && !isNaN(input['limit'])) {
      res.limit = input['limit'];
    }
    return ok(res);
  },

  'index.getFolderCounts': validateEmptyArgs,
  'index.getTitleList': validateEmptyArgs,

  'index.search': (input: unknown): Result<IndexSearchArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const query = validateString('query', input['query']);
    if (!query.ok) return query;
    const limit = typeof input['limit'] === 'number' && !isNaN(input['limit']) ? input['limit'] : undefined;
    return ok({ query: query.value, limit });
  },

  'index.getStatus': validateEmptyArgs,
  'index.getStatuses': validateEmptyArgs,
  'index.getTags': validateEmptyArgs,
  'index.getTagCounts': validateEmptyArgs,
  'index.getBacklinks': (input: unknown): Result<IndexGetBacklinksArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const target = validateNonEmptyString('target', input['target']);
    if (!target.ok) return target;
    const altTarget = typeof input['altTarget'] === 'string' ? input['altTarget'] : undefined;
    return ok({ target: target.value, altTarget });
  },

  'tag.rename': (input: unknown): Result<TagRenameArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const oldTag = validateNonEmptyString('oldTag', input['oldTag']);
    if (!oldTag.ok) return oldTag;
    const newTag = validateNonEmptyString('newTag', input['newTag']);
    if (!newTag.ok) return newTag;
    return ok({ oldTag: oldTag.value, newTag: newTag.value });
  },

  'attachment.save': (input: unknown): Result<AttachmentSaveArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const notePath = validateString('notePath', input['notePath'] ?? '');
    if (!notePath.ok) return notePath;
    const fileName = validateNonEmptyString('fileName', input['fileName']);
    if (!fileName.ok) return fileName;
    const bytes = validateUint8Array('bytes', input['bytes']);
    if (!bytes.ok) return bytes;
    return ok({ notePath: notePath.value, fileName: fileName.value, bytes: bytes.value });
  },

  'attachment.savePastedImage': (input: unknown): Result<AttachmentSavePastedImageArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const notePath = validateString('notePath', input['notePath'] ?? '');
    if (!notePath.ok) return notePath;
    const bytes = validateUint8Array('bytes', input['bytes']);
    if (!bytes.ok) return bytes;
    return ok({ notePath: notePath.value, bytes: bytes.value });
  },

  'attachment.getInfo': (input: unknown): Result<AttachmentGetInfoArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const notePath = validateString('notePath', input['notePath'] ?? '');
    if (!notePath.ok) return notePath;
    const pathVal = validateNonEmptyString('path', input['path']);
    if (!pathVal.ok) return pathVal;
    return ok({ notePath: notePath.value, path: pathVal.value });
  },

  'attachment.open': (input: unknown): Result<AttachmentOpenArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const notePath = validateString('notePath', input['notePath'] ?? '');
    if (!notePath.ok) return notePath;
    const pathVal = validateNonEmptyString('path', input['path']);
    if (!pathVal.ok) return pathVal;
    return ok({ notePath: notePath.value, path: pathVal.value });
  },

  'attachment.showInExplorer': (input: unknown): Result<AttachmentShowInExplorerArgs> => {
    if (!isObject(input)) return err({ kind: 'validation', field: 'args', reason: 'expected object' });
    const notePath = validateString('notePath', input['notePath'] ?? '');
    if (!notePath.ok) return notePath;
    const pathVal = validateNonEmptyString('path', input['path']);
    if (!pathVal.ok) return pathVal;
    return ok({ notePath: notePath.value, path: pathVal.value });
  }
};

