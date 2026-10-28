import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronTrayAdapter } from '../../src/main/platform/tray';

vi.mock('electron', () => {
  let listeners = new Map<string, () => void>();
  let isTrayDestroyed = false;

  class MockTray {
    static currentTooltip = '';
    static lastCreatedInstance: MockTray | null = null;
    static listeners = listeners;

    constructor() {
      MockTray.lastCreatedInstance = this;
      MockTray.listeners.clear();
      isTrayDestroyed = false;
    }

    setToolTip(tip: string) {
      MockTray.currentTooltip = tip;
    }
    setContextMenu() {}
    on(event: string, listener: () => void) {
      MockTray.listeners.set(event, listener);
      return this;
    }
    destroy() {
      isTrayDestroyed = true;
    }
    isDestroyed() {
      return isTrayDestroyed;
    }
  }

  return {
    Tray: MockTray,
    Menu: {
      buildFromTemplate: vi.fn((template: any) => template)
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({}))
    }
  };
});

describe('ElectronTrayAdapter (Platform Adapter)', () => {
  let adapter: ElectronTrayAdapter;

  beforeEach(() => {
    adapter = new ElectronTrayAdapter();
  });

  it('creates the tray icon with tooltip and required context menu items', async () => {
    const { Menu, Tray } = await import('electron');
    const handlers = {
      onOpenMainWindow: vi.fn(),
      onNewQuickNote: vi.fn(),
      onQuit: vi.fn()
    };

    adapter.createTray(handlers);

    expect(adapter.isCreated()).toBe(true);
    expect((Tray as any).currentTooltip).toBe('Wrriter');

    // Context menu: New quick note, Open Wrriter, Separator, Quit
    const builtMenuTemplate = vi.mocked(Menu.buildFromTemplate).mock.results[0]?.value;
    expect(builtMenuTemplate.length).toBe(4);
    expect(builtMenuTemplate[0].label).toBe('New quick note');
    expect(builtMenuTemplate[1].label).toBe('Open Wrriter');
    expect(builtMenuTemplate[2].type).toBe('separator');
    expect(builtMenuTemplate[3].label).toBe('Quit');

    // Test menu item clicks
    builtMenuTemplate[0].click();
    expect(handlers.onNewQuickNote).toHaveBeenCalledTimes(1);

    builtMenuTemplate[1].click();
    expect(handlers.onOpenMainWindow).toHaveBeenCalledTimes(1);

    builtMenuTemplate[3].click();
    expect(handlers.onQuit).toHaveBeenCalledTimes(1);
  });

  it('restores main window on single click and double click on tray icon', async () => {
    const { Tray } = await import('electron');
    const handlers = {
      onOpenMainWindow: vi.fn(),
      onNewQuickNote: vi.fn(),
      onQuit: vi.fn()
    };

    adapter.createTray(handlers);

    const clickCb = (Tray as any).listeners.get('click');
    const dblClickCb = (Tray as any).listeners.get('double-click');

    expect(clickCb).toBeDefined();
    expect(dblClickCb).toBeDefined();

    clickCb!();
    expect(handlers.onOpenMainWindow).toHaveBeenCalledTimes(1);

    dblClickCb!();
    expect(handlers.onOpenMainWindow).toHaveBeenCalledTimes(2);
  });

  it('safely destroys tray on shutdown', () => {
    adapter.createTray({
      onOpenMainWindow: vi.fn(),
      onNewQuickNote: vi.fn(),
      onQuit: vi.fn()
    });

    expect(adapter.isCreated()).toBe(true);
    adapter.destroyTray();
    expect(adapter.isCreated()).toBe(false);
  });
});
