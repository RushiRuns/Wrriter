import type { Result } from '../result';
import type {
  AccentName,
  CreateFolderArgs,
  DeleteFolderArgs,
  DeleteNoteArgs,
  IpcChannel,
  IpcChannelTable,
  NoteContent,
  OpenVaultArgs,
  ReadNoteArgs,
  RenameFolderArgs,
  SaveNoteArgs,
  SaveOutcome,
  SetAccentArgs,
  SetPaneWidthsArgs,
  SetPinnedArgs,
  SetThemeArgs,
  StartupState,
  ThemeName,
  VaultInfo
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
    firstPaintComplete(): Promise<Result<void>>;
  };
  readonly vault: {
    open(args: OpenVaultArgs): Promise<Result<VaultInfo>>;
    close(): Promise<Result<void>>;
    getActive(): Promise<Result<VaultInfo | null>>;
  };
  readonly note: {
    read(args: ReadNoteArgs): Promise<Result<NoteContent>>;
    save(args: SaveNoteArgs): Promise<Result<SaveOutcome>>;
    setPinned(args: SetPinnedArgs): Promise<Result<void>>;
    delete(args: DeleteNoteArgs): Promise<Result<void>>;
  };
  readonly folder: {
    create(args: CreateFolderArgs): Promise<Result<void>>;
    rename(args: RenameFolderArgs): Promise<Result<void>>;
    delete(args: DeleteFolderArgs): Promise<Result<void>>;
  };
  readonly app: {
    getStartupState(): Promise<Result<StartupState>>;
    getTheme(): Promise<Result<ThemeName>>;
    setTheme(args: SetThemeArgs): Promise<Result<void>>;
    getAccent(): Promise<Result<AccentName>>;
    setAccent(args: SetAccentArgs): Promise<Result<void>>;
  };
  readonly invoke: <K extends IpcChannel>(
    channel: K,
    args: IpcChannelTable[K]['args']
  ) => Promise<Result<IpcChannelTable[K]['result']>>;
}
