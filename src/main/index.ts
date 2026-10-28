import { app } from 'electron';
import { join } from 'path';
import { IpcRouter } from './ipc/router';
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
import { AttachmentService } from './services/attachment-service';
import { registerVaultProtocolPrivileges, setupVaultProtocolHandler } from './platform/vault-protocol';
import { SingleInstanceAdapter } from './platform/single-instance';
import { AppLifecycle } from './app/app-lifecycle';
import { CaptureService } from './services/capture-service';

// 1. Single-instance lock taken first at startup (ARCHITECTURE.md rule 19)
const singleInstance = new SingleInstanceAdapter();
if (!singleInstance.requestLock()) {
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
const attachmentService = new AttachmentService({
  safeWriter
});

const windowService = new WindowService({
  appDataStore,
  ipcRouter,
  vaultService,
  attachmentService,
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

const captureService = new CaptureService({
  appDataStore,
  safeWriter,
  vaultService,
  windowService,
  ipcRouter
});

const appLifecycle = new AppLifecycle({
  appDataStore,
  windowService,
  singleInstanceAdapter: singleInstance,
  onTriggerQuickNote: () => {
    void captureService.openQuickCapture();
  }
});

windowService.setOnSaveSettings((patch) => appLifecycle.handleSaveSettings(patch));
windowService.setGetHotkeyStatus((acc) => appLifecycle.getHotkeyStatus(acc));

app.whenReady().then(async () => {
  if (process.argv.includes('--benchmark-launch')) {
    app.quit();
    return;
  }

  ipcRouter.initialize();
  setupVaultProtocolHandler(vaultService);

  const isQuickNoteStartup = process.argv.includes('--quick-note');
  const isHiddenStartup = process.argv.includes('--hidden') || isQuickNoteStartup;

  await appLifecycle.initialize({ isHiddenStartup });

  if (isQuickNoteStartup) {
    await captureService.openQuickCapture();
  }

  app.on('activate', async () => {
    await appLifecycle.openMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (captureService.getQuickCaptureWindow() || captureService.getPopOutWindows().length > 0) {
    return;
  }
  if (!appLifecycle.shouldKeepRunningInBackground()) {
    app.quit();
  }
});
