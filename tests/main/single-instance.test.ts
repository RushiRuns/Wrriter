import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from 'electron';
import { SingleInstanceAdapter } from '../../src/main/platform/single-instance';

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: vi.fn(),
    on: vi.fn(),
    quit: vi.fn()
  }
}));

describe('SingleInstanceAdapter (Platform Adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires the single-instance lock and reports ownership', () => {
    const adapter = new SingleInstanceAdapter();
    expect(adapter.hasLock()).toBe(false);

    vi.mocked(app.requestSingleInstanceLock).mockReturnValue(true);
    const result = adapter.requestLock();

    expect(result).toBe(true);
    expect(adapter.hasLock()).toBe(true);
  });

  it('fails to acquire lock when secondary instance launches', () => {
    const adapter = new SingleInstanceAdapter();
    vi.mocked(app.requestSingleInstanceLock).mockReturnValue(false);

    const result = adapter.requestLock();
    expect(result).toBe(false);
    expect(adapter.hasLock()).toBe(false);
  });

  it('hands second-instance launch arguments over to running copy', () => {
    const adapter = new SingleInstanceAdapter();
    let secondInstanceCallback: ((e: any, argv: string[], workingDir: string) => void) | null = null;

    vi.mocked(app.on).mockImplementation((event: string, handler: any) => {
      if (event === 'second-instance') {
        secondInstanceCallback = handler;
      }
      return app;
    });

    const onSecondInstanceSpy = vi.fn();
    adapter.registerSecondInstance({ onSecondInstance: onSecondInstanceSpy });

    expect(secondInstanceCallback).toBeDefined();

    // Simulate second instance launching with --quick-note flag
    secondInstanceCallback!({}, ['wrriter.exe', '--quick-note'], 'C:\\Users');
    expect(onSecondInstanceSpy).toHaveBeenCalledWith(['wrriter.exe', '--quick-note'], 'C:\\Users');
  });
});
