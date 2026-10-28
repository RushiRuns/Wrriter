import type { Result } from '../result';
import type {
  AccentName,
  AppSettingsContract,
  CloseVaultArgs,
  CreateFolderArgs,
  CreateVaultArgs,
  DeleteFolderArgs,
  DeleteNoteArgs,
  FolderNode,
  GetActiveVaultArgs,
  GetStartupStateArgs,
  IpcChannel,
  IpcChannelTable,
  ListNotesArgs,
  ListVaultsArgs,
  LocateVaultArgs,
  NoteContent,
  NoteListItem,
  OpenVaultArgs,
  ReadNoteArgs,
  RemoveVaultArgs,
  RenameFolderArgs,
  RenameVaultArgs,
  SaveNoteArgs,
  SaveOutcome,
  SaveSettingsArgs,
  SelectFolderDialogArgs,
  SetAccentArgs,
  SetNoteOrderArgs,
  SetOpenTabsArgs,
  SetPaneWidthsArgs,
  SetPinnedArgs,
  SetThemeArgs,
  ShowInExplorerArgs,
  StartupState,
  SwitchVaultArgs,
  ThemeName,
  VaultInfo,
  VaultListItem
} from './contracts';

export * from './contracts';
export * from './validators';

/**
 * The fixed contract exposed on `window.wrriter` to renderer windows.
 * Contains only domain namespaces and explicit methods backed by the fixed IPC request list.
 */
export interface WrriterApi {
  readonly window: {
    minimize(): Promise<Result<void>>;
    maximize(): Promise<Result<void>>;
    close(): Promise<Result<void>>;
    setPaneWidths(args: SetPaneWidthsArgs): Promise<Result<void>>;
    setOpenTabs(args: SetOpenTabsArgs): Promise<Result<void>>;
    firstPaintComplete(): Promise<Result<void>>;
  };
  readonly vault: {
    open(args: OpenVaultArgs): Promise<Result<VaultInfo>>;
    create(args?: CreateVaultArgs): Promise<Result<VaultInfo>>;
    close(): Promise<Result<void>>;
    getActive(): Promise<Result<VaultInfo | null>>;
    list(): Promise<Result<readonly VaultListItem[]>>;
    switch(args: SwitchVaultArgs): Promise<Result<VaultInfo>>;
    rename(args: RenameVaultArgs): Promise<Result<void>>;
    remove(args: RemoveVaultArgs): Promise<Result<void>>;
    locate(args: LocateVaultArgs): Promise<Result<void>>;
    showInExplorer(args: ShowInExplorerArgs): Promise<Result<void>>;
    selectFolderDialog(args?: SelectFolderDialogArgs): Promise<Result<string | null>>;
  };
  readonly note: {
    read(args: ReadNoteArgs): Promise<Result<NoteContent>>;
    save(args: SaveNoteArgs): Promise<Result<SaveOutcome>>;
    rename(args: import('./contracts').RenameNoteArgs): Promise<Result<import('./contracts').NoteJobResult>>;
    move(args: import('./contracts').MoveNoteArgs): Promise<Result<import('./contracts').NoteJobResult>>;
    setPinned(args: SetPinnedArgs): Promise<Result<void>>;
    delete(args: DeleteNoteArgs): Promise<Result<void>>;
    list(args?: ListNotesArgs): Promise<Result<readonly NoteListItem[]>>;
    setOrder(args: SetNoteOrderArgs): Promise<Result<void>>;
  };
  readonly folder: {
    create(args: CreateFolderArgs): Promise<Result<void>>;
    rename(args: RenameFolderArgs): Promise<Result<void>>;
    delete(args: DeleteFolderArgs): Promise<Result<void>>;
    list(): Promise<Result<readonly FolderNode[]>>;
  };
  readonly app: {
    getStartupState(): Promise<Result<StartupState>>;
    getTheme(): Promise<Result<ThemeName>>;
    setTheme(args: SetThemeArgs): Promise<Result<void>>;
    getAccent(): Promise<Result<AccentName>>;
    setAccent(args: SetAccentArgs): Promise<Result<void>>;
    getSettings(): Promise<Result<AppSettingsContract>>;
    saveSettings(args: SaveSettingsArgs): Promise<Result<AppSettingsContract>>;
    openLogFolder(): Promise<Result<void>>;
  };
  readonly index: {
    getNotes(args?: import('./contracts').IndexGetNotesArgs): Promise<Result<readonly NoteListItem[]>>;
    getFolderCounts(): Promise<Result<readonly import('./contracts').IndexFolderCount[]>>;
    getTitleList(): Promise<Result<readonly import('./contracts').IndexTitleItem[]>>;
    search(args: import('./contracts').IndexSearchArgs): Promise<Result<readonly import('./contracts').IndexSearchResultItem[]>>;
    getStatus(): Promise<Result<import('./contracts').IndexStatus>>;
    getStatuses(): Promise<Result<readonly string[]>>;
    getTags(): Promise<Result<readonly string[]>>;
    getTagCounts(): Promise<Result<readonly import('./contracts').IndexTagCount[]>>;
    getBacklinks(args: import('./contracts').IndexGetBacklinksArgs): Promise<Result<readonly import('./contracts').BacklinkRecord[]>>;
  };
  readonly tag: {
    rename(args: import('./contracts').TagRenameArgs): Promise<Result<import('./contracts').TagRenameResult>>;
  };
  readonly showItemInFolder?: (path: string) => Promise<Result<void>>;
  readonly invoke: <K extends IpcChannel>(
    channel: K,
    args: IpcChannelTable[K]['args']
  ) => Promise<Result<IpcChannelTable[K]['result']>>;
}
