import { app } from 'electron';

export interface LoginItemAdapter {
  setStartWithWindows(enabled: boolean): void;
  getStartWithWindows(): boolean;
}

/**
 * Platform adapter managing Windows startup (LoginItem) integration.
 * ARCHITECTURE.md: "Start with Windows is off by default, starts Wrriter hidden,
 * and is offered only while keep running in the background is on."
 */
export class ElectronLoginItemAdapter implements LoginItemAdapter {
  setStartWithWindows(enabled: boolean): void {
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
        args: ['--hidden']
      });
    } else {
      // In development mode, configure with execPath and development args
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
        path: process.execPath,
        args: [process.cwd(), '--hidden']
      });
    }
  }

  getStartWithWindows(): boolean {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }
}
