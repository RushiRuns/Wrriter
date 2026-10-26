import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { IpcRouter } from './ipc/router';
import { startMainLagMonitor } from './platform/lag-monitor';
import { createSecureWindow } from './windows/window-factory';

// 1. Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const ipcRouter = new IpcRouter();

function createMainWindow(): void {
  mainWindow = createSecureWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    htmlPath: join(__dirname, '../renderer/windows/main/index.html')
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.argv.includes('--benchmark-launch')) {
    app.quit();
    return;
  }
  startMainLagMonitor();
  ipcRouter.initialize();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
