import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { IpcRouter } from './ipc/router';
import { startMainLagMonitor } from './platform/lag-monitor';
import { AppDataStore } from './store/app-data-store';
import { WindowService } from './services/window-service';
import { VaultReader } from './services/vault-reader';
import { WatcherAdapter } from './services/watcher-adapter';
import { SafeWriter } from './services/safe-writer';
import { JobsStore } from './store/jobs-store';
import { JobService } from './services/job-service';

// 1. Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const appDataDir = app.getPath('userData');
const safeWriter = new SafeWriter();
const appDataStore = new AppDataStore(appDataDir, safeWriter);
const ipcRouter = new IpcRouter();
const vaultReader = new VaultReader();
const jobsStore = new JobsStore(appDataDir, safeWriter);
const jobService = new JobService(jobsStore);

const windowService = new WindowService({
  appDataStore,
  ipcRouter,
  vaultReader,
  watcherFactory: (vaultPath: string) =>
    new WatcherAdapter(vaultPath, safeWriter, {
      onEvents: () => {},
      onRescanNeeded: () => {}
    }),
  jobService,
  htmlPath: join(__dirname, '../renderer/windows/main/index.html')
});

app.whenReady().then(async () => {
  if (process.argv.includes('--benchmark-launch')) {
    app.quit();
    return;
  }
  startMainLagMonitor();
  ipcRouter.initialize();

  // Create main window with settings pre-read and hidden in theme background color
  await windowService.createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await windowService.createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

