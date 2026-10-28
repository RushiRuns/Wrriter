import { globalShortcut } from 'electron';

export interface HotkeyRegistrationOutcome {
  registered: boolean;
  accelerator: string;
  error?: string;
}

export interface HotkeyAdapter {
  register(accelerator: string, callback: () => void): HotkeyRegistrationOutcome;
  unregister(): void;
  isRegistered(accelerator: string): boolean;
  getCurrentAccelerator(): string | null;
}

/**
 * Platform adapter managing global system hotkeys via Electron globalShortcut.
 * ARCHITECTURE.md: "Ctrl+Alt+N by default, changeable without a restart, confirms it was registered,
 * and says plainly when the combination is taken."
 */
export class ElectronHotkeyAdapter implements HotkeyAdapter {
  private currentAccelerator: string | null = null;
  private currentCallback: (() => void) | null = null;

  register(accelerator: string, callback: () => void): HotkeyRegistrationOutcome {
    const trimmed = accelerator.trim();
    if (!trimmed) {
      return {
        registered: false,
        accelerator: trimmed,
        error: 'Shortcut combination cannot be empty.'
      };
    }

    const previousAccelerator = this.currentAccelerator;
    const previousCallback = this.currentCallback;

    // Unregister previous hotkey before registering the new one
    if (previousAccelerator) {
      try {
        globalShortcut.unregister(previousAccelerator);
      } catch {
        // Safe skip on unregister
      }
    }

    let success = false;
    try {
      success = globalShortcut.register(trimmed, callback);
    } catch {
      success = false;
    }

    // Verify registration was actually accepted by Windows
    if (!success || !globalShortcut.isRegistered(trimmed)) {
      // Combination is taken by another app or OS; restore previous shortcut if one existed
      if (previousAccelerator && previousCallback) {
        try {
          globalShortcut.register(previousAccelerator, previousCallback);
          this.currentAccelerator = previousAccelerator;
          this.currentCallback = previousCallback;
        } catch {
          this.currentAccelerator = null;
          this.currentCallback = null;
        }
      } else {
        this.currentAccelerator = null;
        this.currentCallback = null;
      }

      return {
        registered: false,
        accelerator: trimmed,
        error: `The shortcut "${trimmed}" is already in use by another application or Windows.`
      };
    }

    this.currentAccelerator = trimmed;
    this.currentCallback = callback;

    return {
      registered: true,
      accelerator: trimmed
    };
  }

  unregister(): void {
    if (this.currentAccelerator) {
      try {
        globalShortcut.unregister(this.currentAccelerator);
      } catch {
        // Safe skip
      }
      this.currentAccelerator = null;
      this.currentCallback = null;
    }
  }

  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  getCurrentAccelerator(): string | null {
    return this.currentAccelerator;
  }
}
