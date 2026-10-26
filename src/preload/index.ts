import { contextBridge, ipcRenderer } from 'electron';
import type {
  CreateFolderArgs,
  DeleteFolderArgs,
  DeleteNoteArgs,
  IpcChannel,
  IpcChannelTable,
  OpenVaultArgs,
  ReadNoteArgs,
  RenameFolderArgs,
  SaveNoteArgs,
  SetAccentArgs,
  SetPinnedArgs,
  SetThemeArgs,
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
    close: () => invoke('window.close', {})
  },
  vault: {
    open: (args: OpenVaultArgs) => invoke('vault.open', args),
    close: () => invoke('vault.close', {}),
    getActive: () => invoke('vault.getActive', {})
  },
  note: {
    read: (args: ReadNoteArgs) => invoke('note.read', args),
    save: (args: SaveNoteArgs) => invoke('note.save', args),
    setPinned: (args: SetPinnedArgs) => invoke('note.setPinned', args),
    delete: (args: DeleteNoteArgs) => invoke('note.delete', args)
  },
  folder: {
    create: (args: CreateFolderArgs) => invoke('folder.create', args),
    rename: (args: RenameFolderArgs) => invoke('folder.rename', args),
    delete: (args: DeleteFolderArgs) => invoke('folder.delete', args)
  },
  app: {
    getTheme: () => invoke('app.getTheme', {}),
    setTheme: (args: SetThemeArgs) => invoke('app.setTheme', args),
    getAccent: () => invoke('app.getAccent', {}),
    setAccent: (args: SetAccentArgs) => invoke('app.setAccent', args)
  },
  invoke
};

contextBridge.exposeInMainWorld('wrriter', api);

export type { WrriterApi };
