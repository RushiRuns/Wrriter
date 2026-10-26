import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  IPC_VALIDATORS,
  type IpcChannel,
  type IpcChannelTable
} from '../../shared/ipc';
import { err, ok, type Result } from '../../shared/result';

export type IpcHandler<K extends IpcChannel> = (
  args: IpcChannelTable[K]['args'],
  event: IpcMainInvokeEvent
) => Promise<Result<IpcChannelTable[K]['result']>> | Result<IpcChannelTable[K]['result']>;

export class IpcRouter {
  private readonly handlers = new Map<IpcChannel, IpcHandler<any>>();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Registers a typed handler for a specific fixed channel.
   */
  register<K extends IpcChannel>(channel: K, handler: IpcHandler<K>): void {
    this.handlers.set(channel, handler);
  }

  /**
   * Validates sender authenticity: must be a known, non-destroyed application window.
   */
  validateSender(sender: WebContents): Result<BrowserWindow> {
    const window = BrowserWindow.fromWebContents(sender);
    if (!window || window.isDestroyed()) {
      return err({
        kind: 'ruleViolation',
        rule: 'IPC message received from unknown or destroyed window sender'
      });
    }
    return ok(window);
  }

  /**
   * Initializes all IPC channel listeners in Electron's ipcMain.
   */
  initialize(): void {
    const channels = Object.keys(IPC_VALIDATORS) as IpcChannel[];

    for (const channel of channels) {
      ipcMain.handle(channel, async (event, rawArgs: unknown) => {
        // 1. Verify sender
        const senderResult = this.validateSender(event.sender);
        if (!senderResult.ok) {
          return senderResult;
        }

        // 2. Validate arguments
        const validator = IPC_VALIDATORS[channel];
        const validationResult = validator(rawArgs);
        if (!validationResult.ok) {
          return validationResult;
        }

        // 3. Find registered handler
        const handler = this.handlers.get(channel);
        if (!handler) {
          return err({
            kind: 'ruleViolation',
            rule: `No service handler registered for channel ${channel}`
          });
        }

        // 4. Safely execute handler without throwing across process boundaries
        try {
          return await handler(validationResult.value, event);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return err({
            kind: 'unexpected',
            message: `Internal handler error on channel ${channel}: ${message}`
          });
        }
      });
    }
  }

  private registerDefaultHandlers(): void {
    // Baseline window management handlers
    this.register('window.minimize', (_args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.minimize();
      return ok(undefined);
    });

    this.register('window.maximize', (_args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
      return ok(undefined);
    });

    this.register('window.close', (_args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.close();
      return ok(undefined);
    });

    // Default app settings fallbacks
    this.register('app.getTheme', () => ok('system'));
    this.register('app.setTheme', () => ok(undefined));
    this.register('app.getAccent', () => ok('yellow'));
    this.register('app.setAccent', () => ok(undefined));
  }
}
