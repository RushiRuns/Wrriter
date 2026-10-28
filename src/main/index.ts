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
import { VaultService } from './services/vault-service';
import { TagService } from './services/tag-service';
import { LinkService } from './services/link-service';
import { IndexClient } from './services/index-client';
import { registerVaultProtocolPrivileges, setupVaultProtocolHandler } from './platform/vault-protocol';

// 1. Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Register privileged schemes before app ready
registerVaultProtocolPrivileges();

const appDataDir = app.getPath('userData');
const safeWriter = new SafeWriter();
const appDataStore = new AppDataStore(appDataDir, safeWriter);
const ipcRouter = new IpcRouter();
const vaultReader = new VaultReader();
const indexClient = new IndexClient({
  workerScriptPath: join(__dirname, '../workers/index.js')
});
const jobsStore = new JobsStore(appDataDir, safeWriter);
const jobService = new JobService(jobsStore);
const tagService = new TagService({
  jobService,
  indexClient,
  vaultReader,
  safeWriter
});
const linkService = new LinkService({
  jobService,
  indexClient,
  vaultReader,
  safeWriter
});
const vaultService = new VaultService({
  appDataStore,
  safeWriter
});

const windowService = new WindowService({
  appDataStore,
  ipcRouter,
  vaultService,
  vaultReader,
  indexClient,
  tagService,
  linkService,
  watcherFactory: (vaultPath: string) =>
    new WatcherAdapter(vaultPath, safeWriter, {
      onEvents: (events) => {
        const mdPaths = events.map((e) => e.path).filter((p) => p.endsWith('.md'));
        if (mdPaths.length > 0) {
          void indexClient.notesBatchChanged(mdPaths);
        }
      },
      onRescanNeeded: () => {
        void indexClient.reindex('');
      }
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
  setupVaultProtocolHandler(vaultService);

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

