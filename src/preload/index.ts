import { contextBridge } from 'electron'

// Preload bridge: the fixed IPC request list from src/shared/ipc goes here
const api = {}

contextBridge.exposeInMainWorld('wrriter', api)

export type WrriterApi = typeof api
