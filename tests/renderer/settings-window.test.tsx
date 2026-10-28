import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsWindow } from '../../src/renderer/components/SettingsWindow';
import { SHORTCUTS } from '../../src/shared/shortcuts';
import type { AppSettingsContract } from '../../src/shared/ipc/contracts';
import {
  crossFadeTransition,
  broadcastThemeChange,
  subscribeThemeSync
} from '../../src/renderer/motion';

describe('M2 Settings: SettingsWindow and Theme Transitions', () => {
  const defaultTestSettings: AppSettingsContract = {
    theme: 'follow-windows',
    accent: 'yellow',
    motion: 'follow-windows',
    noteMargin: 24,
    keepRunningInBackground: true,
    startWithWindows: false,
    captureHotkey: 'Ctrl+Alt+N',
    captureVault: 'last-active',
    noteList: {
      sortBy: 'manual',
      showSortIcon: false,
      showPreviews: true,
      showDates: true,
      showImages: true
    },
    dragHintShown: false
  };

  describe('Modal Rendering and Visibility', () => {
    it('returns empty string when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={false}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders dialog structure with header, all 4 tabs, and appearance content when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
        />
      );

      expect(html).toContain('wr-settings-dialog');
      expect(html).toContain('Settings');
      expect(html).toContain('Appearance');
      expect(html).toContain('System');
      expect(html).toContain('Sync');
      expect(html).toContain('Shortcuts');
    });

    it('renders all Appearance controls by default (Theme, Accent, Motion, Note margin)', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
        />
      );

      // 1. Theme options
      expect(html).toContain('Follow Windows');
      expect(html).toContain('Light');
      expect(html).toContain('Dark');

      // 2. Accent buttons for all 5 accents
      expect(html).toContain('wr-settings-accent-dot yellow');
      expect(html).toContain('wr-settings-accent-dot sky');
      expect(html).toContain('wr-settings-accent-dot coral');
      expect(html).toContain('wr-settings-accent-dot mint');
      expect(html).toContain('wr-settings-accent-dot lilac');

      // 3. Motion options
      expect(html).toContain('Reduced');
      expect(html).toContain('Full');

      // 4. Note margin slider and reset button
      expect(html).toContain('min="16"');
      expect(html).toContain('max="96"');
      expect(html).toContain('step="4"');
      expect(html).toContain('24 px');
      expect(html).toContain('Reset');
    });

    it('renders System tab with background running and start with Windows controls', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
          defaultTab="system"
        />
      );

      expect(html).toContain('Keep running in the background');
      expect(html).toContain('Start with Windows');
      expect(html).toContain('Quick capture global shortcut');
      expect(html).toContain('Windows notification area');
    });

    it('renders Sync tab with Syncthing guidance and link to syncthing.net', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
          defaultTab="sync"
        />
      );

      expect(html).toContain('Vault synchronization');
      expect(html).toContain('Syncthing');
      expect(html).toContain('https://syncthing.net');
      expect(html).toContain('Syncthing conflict copies show as ordinary notes');
    });

    it('renders Shortcuts tab with all shortcuts from code and keyboard badges', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
          defaultTab="shortcuts"
        />
      );

      expect(html).toContain('Search shortcuts...');
      expect(html).toContain(`Read-only list of all ${SHORTCUTS.length} keyboard shortcuts`);
      expect(html).toContain('Ctrl+N');
      expect(html).toContain('Ctrl+,');
      expect(html).toContain('Ctrl+Shift+P');
      expect(html).toContain('F2');
    });

    it('does not contain any removed settings like Pin the top and bottom bars', () => {
      const html = renderToStaticMarkup(
        <SettingsWindow
          isOpen={true}
          onClose={() => {}}
          currentSettings={defaultTestSettings}
          onSaveSettings={async () => {}}
        />
      );

      expect(html).not.toContain('Pin the bars');
      expect(html).not.toContain('Pin the top and bottom bars');
    });

  });

  describe('Theme Cross-Fade Transitions and Fallback', () => {
    let originalDocument: any;

    beforeEach(() => {
      originalDocument = (globalThis as any).document;
    });

    afterEach(() => {
      (globalThis as any).document = originalDocument;
      vi.restoreAllMocks();
    });

    it('uses document.startViewTransition when supported by engine', async () => {
      let callbackRan = false;
      const dummyTransition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve()
      };

      const startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return dummyTransition;
      });

      (globalThis as any).document = {
        startViewTransition,
        documentElement: {
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn()
          }
        }
      };

      await crossFadeTransition(() => {
        callbackRan = true;
      });

      expect(callbackRan).toBe(true);
      expect(startViewTransition).toHaveBeenCalled();
    });

    it('falls back to Fast (100 ms) fade when startViewTransition is absent', async () => {
      let callbackRan = false;
      const addedClasses: string[] = [];
      const removedClasses: string[] = [];

      (globalThis as any).document = {
        documentElement: {
          classList: {
            add: (cls: string) => addedClasses.push(cls),
            remove: (cls: string) => removedClasses.push(cls)
          }
        }
      };

      const promise = crossFadeTransition(() => {
        callbackRan = true;
      });

      expect(callbackRan).toBe(true);
      expect(addedClasses).toContain('wr-theme-fade-fallback');

      await promise;
      expect(removedClasses).toContain('wr-theme-fade-fallback');
    });

    it('broadcasts and receives theme changes across windows via BroadcastChannel', () => {
      let channelMessage: any = null;
      let registeredListener: ((e: any) => void) | null = null;

      class MockBroadcastChannel {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(data: any) {
          channelMessage = data;
        }
        set onmessage(fn: (e: any) => void) {
          registeredListener = fn;
        }
        close() {}
      }

      (globalThis as any).BroadcastChannel = MockBroadcastChannel;

      const received: any[] = [];
      const unsubscribe = subscribeThemeSync((msg) => {
        received.push(msg);
      });

      broadcastThemeChange('theme', 'dark');
      expect(channelMessage).toEqual({ type: 'theme', value: 'dark' });

      // Simulate incoming message from another window
      const listener = registeredListener as ((e: any) => void) | null;
      if (listener) {
        listener({ data: { type: 'accent', value: 'mint' } });
      }
      expect(received).toEqual([{ type: 'accent', value: 'mint' }]);

      unsubscribe();
      delete (globalThis as any).BroadcastChannel;
    });
  });

  describe('Master Shortcuts Registry Integrity', () => {
    it('guarantees SHORTCUTS contains every shortcut for the read-only list', () => {
      expect(SHORTCUTS.length).toBeGreaterThanOrEqual(13);

      const openSettings = SHORTCUTS.find((s) => s.id === 'settings:open');
      expect(openSettings).toBeDefined();
      expect(openSettings?.key).toBe('Ctrl+,');
      expect(openSettings?.title).toBe('Open settings');
    });
  });
});
