import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalShortcut } from 'electron';
import { ElectronHotkeyAdapter } from '../../src/main/platform/hotkey';

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    isRegistered: vi.fn()
  }
}));

describe('ElectronHotkeyAdapter (Platform Adapter)', () => {
  let adapter: ElectronHotkeyAdapter;
  let registeredShortcuts: Map<string, () => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredShortcuts = new Map();
    adapter = new ElectronHotkeyAdapter();

    vi.mocked(globalShortcut.register).mockImplementation((acc: string, cb: () => void) => {
      registeredShortcuts.set(acc, cb);
      return true;
    });

    vi.mocked(globalShortcut.unregister).mockImplementation((acc: string) => {
      registeredShortcuts.delete(acc);
    });

    vi.mocked(globalShortcut.isRegistered).mockImplementation((acc: string) => {
      return registeredShortcuts.has(acc);
    });
  });

  it('registers default hotkey and invokes callback on trigger', () => {
    const callbackSpy = vi.fn();
    const outcome = adapter.register('Ctrl+Alt+N', callbackSpy);

    expect(outcome.registered).toBe(true);
    expect(outcome.accelerator).toBe('Ctrl+Alt+N');
    expect(adapter.isRegistered('Ctrl+Alt+N')).toBe(true);

    // Simulate global hotkey press
    const registeredCb = registeredShortcuts.get('Ctrl+Alt+N');
    expect(registeredCb).toBeDefined();
    registeredCb!();
    expect(callbackSpy).toHaveBeenCalledTimes(1);
  });

  it('changes hotkey live without application restart', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    adapter.register('Ctrl+Alt+N', cb1);
    expect(adapter.getCurrentAccelerator()).toBe('Ctrl+Alt+N');

    const updateOutcome = adapter.register('Ctrl+Shift+Space', cb2);
    expect(updateOutcome.registered).toBe(true);
    expect(updateOutcome.accelerator).toBe('Ctrl+Shift+Space');
    expect(adapter.getCurrentAccelerator()).toBe('Ctrl+Shift+Space');

    // Old shortcut is unregistered, new shortcut is registered
    expect(adapter.isRegistered('Ctrl+Alt+N')).toBe(false);
    expect(adapter.isRegistered('Ctrl+Shift+Space')).toBe(true);

    registeredShortcuts.get('Ctrl+Shift+Space')!();
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('says plainly when the combination is taken and keeps previous shortcut intact', () => {
    const originalCb = vi.fn();
    adapter.register('Ctrl+Alt+N', originalCb);

    // Simulate shortcut conflict: system reports registration failure for the new combination
    vi.mocked(globalShortcut.register).mockImplementationOnce((acc) => {
      if (acc === 'Ctrl+Alt+Taken') return false;
      return true;
    });

    const takenOutcome = adapter.register('Ctrl+Alt+Taken', vi.fn());

    expect(takenOutcome.registered).toBe(false);
    expect(takenOutcome.error).toBe(
      'The shortcut "Ctrl+Alt+Taken" is already in use by another application or Windows.'
    );

    // Previous shortcut restored
    expect(adapter.getCurrentAccelerator()).toBe('Ctrl+Alt+N');
    expect(adapter.isRegistered('Ctrl+Alt+N')).toBe(true);
  });

  it('rejects empty shortcut strings with clear error', () => {
    const outcome = adapter.register('   ', vi.fn());
    expect(outcome.registered).toBe(false);
    expect(outcome.error).toBe('Shortcut combination cannot be empty.');
  });
});
