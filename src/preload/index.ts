import { contextBridge, ipcRenderer } from 'electron'

// Preload bridge exposes window.wrriter with fixed request list only
const api = {
  window: {
    minimize: (): void => {
      ipcRenderer.send('window.minimize')
    },
    maximize: (): void => {
      ipcRenderer.send('window.maximize')
    },
    close: (): void => {
      ipcRenderer.send('window.close')
    },
    isMaximized: (): Promise<boolean> => {
      return ipcRenderer.invoke('window.isMaximized')
    }
  }
} as const

contextBridge.exposeInMainWorld('wrriter', api)

export type WrriterApi = typeof api
