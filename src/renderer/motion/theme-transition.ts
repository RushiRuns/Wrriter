import { DURATION_FAST } from './index';

/**
 * Cross-fade transition helper for theme and accent changes across the window at Slow.
 * Strictly adheres to M2 specification:
 * - Checks whether Electron's engine supports View Transitions.
 * - Falls back to a Fast fade (100 ms) if View Transitions API is not available.
 * - Broadcasts theme/accent changes to all open windows via BroadcastChannel.
 */

export type ThemeSyncMessage = {
  type: 'theme' | 'accent';
  value: string;
};

const THEME_SYNC_CHANNEL_NAME = 'wrriter:theme-sync';

/**
 * Executes a cross-fade transition using View Transitions API when supported,
 * or falls back to a Fast (100 ms) CSS opacity cross-fade.
 */
export async function crossFadeTransition(updateFn: () => void | Promise<void>): Promise<void> {
  if (typeof document === 'undefined') {
    await updateFn();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => {
      finished: Promise<void>;
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
    };
  };

  // 1. View Transitions API path (Chromium 111+ / Electron)
  if (typeof doc.startViewTransition === 'function') {
    try {
      const transition = doc.startViewTransition(async () => {
        await updateFn();
      });
      await transition.finished;
      return;
    } catch {
      // If View Transition fails, proceed to fallback
    }
  }

  // 2. Fallback path: Fast (100 ms) transition
  const root = document.documentElement;
  root.classList.add('wr-theme-fade-fallback');
  try {
    await updateFn();
  } finally {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        root.classList.remove('wr-theme-fade-fallback');
        resolve();
      }, DURATION_FAST);
    });
  }
}

/**
 * Broadcasts a theme or accent change to all open windows so every window
 * fades simultaneously.
 */
export function broadcastThemeChange(type: 'theme' | 'accent', value: string): void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(THEME_SYNC_CHANNEL_NAME);
      channel.postMessage({ type, value } satisfies ThemeSyncMessage);
      channel.close();
    } catch {
      // Safe skip if BroadcastChannel is unavailable in test environment
    }
  }
}

/**
 * Subscribes to theme and accent changes broadcast from other windows.
 */
export function subscribeThemeSync(
  callback: (message: ThemeSyncMessage) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  try {
    const channel = new BroadcastChannel(THEME_SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<ThemeSyncMessage>) => {
      if (event.data && (event.data.type === 'theme' || event.data.type === 'accent')) {
        callback(event.data);
      }
    };

    return () => {
      channel.close();
    };
  } catch {
    return () => {};
  }
}
