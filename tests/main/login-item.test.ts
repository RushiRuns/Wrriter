import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from 'electron';
import { ElectronLoginItemAdapter } from '../../src/main/platform/login-item';

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false }))
  }
}));

describe('ElectronLoginItemAdapter (Platform Adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables Start with Windows with hidden startup flag', () => {
    const adapter = new ElectronLoginItemAdapter();

    adapter.setStartWithWindows(true);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: true,
        args: expect.arrayContaining(['--hidden'])
      })
    );
  });

  it('disables Start with Windows when disabled', () => {
    const adapter = new ElectronLoginItemAdapter();

    adapter.setStartWithWindows(false);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: false,
        openAsHidden: true
      })
    );
  });

  it('reads current login item status accurately from OS', () => {
    const adapter = new ElectronLoginItemAdapter();
    vi.mocked(app.getLoginItemSettings).mockReturnValue({
      openAtLogin: true,
      openAsHidden: true,
      wasOpenedAtLogin: false,
      wasOpenedAsHidden: false,
      restoreState: false,
      status: 'not-registered',
      executableWillLaunchAtLogin: true
    } as any);

    expect(adapter.getStartWithWindows()).toBe(true);
  });
});
