import { contextBridge, ipcRenderer } from 'electron';

declare const window: any;

import type {
  CreateFolderArgs,
  CreateVaultArgs,
  DeleteFolderArgs,
  DeleteNoteArgs,
  IpcChannel,
  IpcChannelTable,
  ListNotesArgs,
  LocateVaultArgs,
  OpenVaultArgs,
  ReadNoteArgs,
  RemoveVaultArgs,
  RenameFolderArgs,
  RenameVaultArgs,
  SaveNoteArgs,
  SaveSettingsArgs,
  SelectFolderDialogArgs,
  SetAccentArgs,
  SetNoteOrderArgs,
  SetPaneWidthsArgs,
  SetPinnedArgs,
  SetThemeArgs,
  ShowInExplorerArgs,
  SwitchVaultArgs,
  WrriterApi
} from '../shared/ipc';
import type { Result } from '../shared/result';

function invoke<K extends IpcChannel>(
  channel: K,
  args: IpcChannelTable[K]['args']
): Promise<Result<IpcChannelTable[K]['result']>> {
  return ipcRenderer.invoke(channel, args);
}

const api: WrriterApi = {
  window: {
    minimize: () => invoke('window.minimize', {}),
    maximize: () => invoke('window.maximize', {}),
    close: () => invoke('window.close', {}),
    setPaneWidths: (args: SetPaneWidthsArgs) => invoke('window.setPaneWidths', args),
    setOpenTabs: (args) => invoke('window.setOpenTabs', args),
    firstPaintComplete: () => invoke('window.firstPaintComplete', {})
  },
  vault: {
    open: (args: OpenVaultArgs) => invoke('vault.open', args),
    create: (args: CreateVaultArgs = {}) => invoke('vault.create', args),
    close: () => invoke('vault.close', {}),
    getActive: () => invoke('vault.getActive', {}),
    list: () => invoke('vault.list', {}),
    switch: (args: SwitchVaultArgs) => invoke('vault.switch', args),
    rename: (args: RenameVaultArgs) => invoke('vault.rename', args),
    remove: (args: RemoveVaultArgs) => invoke('vault.remove', args),
    locate: (args: LocateVaultArgs) => invoke('vault.locate', args),
    showInExplorer: (args: ShowInExplorerArgs) => invoke('vault.showInExplorer', args),
    selectFolderDialog: (args: SelectFolderDialogArgs = {}) => invoke('vault.selectFolderDialog', args)
  },
  note: {
    read: (args: ReadNoteArgs) => invoke('note.read', args),
    save: (args: SaveNoteArgs) => invoke('note.save', args),
    rename: (args: import('../shared/ipc/contracts').RenameNoteArgs) => invoke('note.rename', args),
    move: (args: import('../shared/ipc/contracts').MoveNoteArgs) => invoke('note.move', args),
    duplicate: (args: import('../shared/ipc/contracts').DuplicateNoteArgs) => invoke('note.duplicate', args),
    setPinned: (args: SetPinnedArgs) => invoke('note.setPinned', args),
    delete: (args: DeleteNoteArgs) => invoke('note.delete', args),
    list: (args: ListNotesArgs = {}) => invoke('note.list', args),
    setOrder: (args: SetNoteOrderArgs) => invoke('note.setOrder', args)
  },
  folder: {
    create: (args: CreateFolderArgs) => invoke('folder.create', args),
    rename: (args: RenameFolderArgs) => invoke('folder.rename', args),
    delete: (args: DeleteFolderArgs) => invoke('folder.delete', args),
    list: () => invoke('folder.list', {})
  },
  app: {
    getStartupState: () => invoke('app.getStartupState', {}),
    getTheme: () => invoke('app.getTheme', {}),
    setTheme: (args: SetThemeArgs) => invoke('app.setTheme', args),
    getAccent: () => invoke('app.getAccent', {}),
    setAccent: (args: SetAccentArgs) => invoke('app.setAccent', args),
    getSettings: () => invoke('app.getSettings', {}),
    saveSettings: (args: SaveSettingsArgs) => invoke('app.saveSettings', args),
    getHotkeyStatus: (args = {}) => invoke('app.getHotkeyStatus', args),
    openLogFolder: () => invoke('app.openLogFolder', {})
  },
  index: {
    getNotes: (args = {}) => invoke('index.getNotes', args),
    getFolderCounts: () => invoke('index.getFolderCounts', {}),
    getTitleList: () => invoke('index.getTitleList', {}),
    search: (args) => invoke('index.search', args),
    getStatus: () => invoke('index.getStatus', {}),
    getStatuses: () => invoke('index.getStatuses', {}),
    getTags: () => invoke('index.getTags', {}),
    getTagCounts: () => invoke('index.getTagCounts', {}),
    getBacklinks: (args) => invoke('index.getBacklinks', args)
  },
  tag: {
    rename: (args) => invoke('tag.rename', args)
  },
  capture: {
    openQuickCapture: () => invoke('capture.openQuickCapture', {}),
    openPopOut: (args) => invoke('capture.openPopOut', args),
    openInMainWindow: (args) => invoke('capture.openInMainWindow', args),
    setAlwaysOnTop: (args) => invoke('capture.setAlwaysOnTop', args),
    getCaptureState: () => invoke('capture.getCaptureState', {}),
    saveQuickNote: (args) => invoke('capture.saveQuickNote', args)
  },
  showItemInFolder: (path: string) => invoke('vault.showInExplorer', { path }),
  invoke
};

ipcRenderer.on('capture:re-enter', () => {
  window.dispatchEvent(new CustomEvent('wrriter:capture-reenter'));
});

ipcRenderer.on('note:opened-in-main', (_event, data) => {
  window.dispatchEvent(new CustomEvent('wrriter:note-opened-in-main', { detail: data }));
});

ipcRenderer.on('note:saved', (_event, data) => {
  window.dispatchEvent(new CustomEvent('wrriter:note-saved', { detail: data }));
});

contextBridge.exposeInMainWorld('wrriter', api);

export type { WrriterApi };
