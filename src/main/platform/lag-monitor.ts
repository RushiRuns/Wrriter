import { app } from 'electron';

export interface LagMonitorOptions {
  thresholdMs?: number; // default 50ms
  checkIntervalMs?: number; // default 10ms
}

let activeInterval: NodeJS.Timeout | null = null;

/**
 * Starts the Main Process Event Loop Lag Monitor.
 * Active in development builds only (!app.isPackaged) per PERFORMANCE.md.
 * Detects and logs any main process synchronous block longer than 50 ms.
 */
export function startMainLagMonitor(options?: LagMonitorOptions): void {
  // Only run in development builds
  if (app.isPackaged && !process.env['FORCE_LAG_MONITOR']) {
    return;
  }

  if (activeInterval) return;

  const thresholdMs = options?.thresholdMs ?? 50;
  const intervalMs = options?.checkIntervalMs ?? 10;

  let lastTime = Date.now();

  activeInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastTime;
    const delay = elapsed - intervalMs;

    if (delay > thresholdMs) {
      console.warn(
        `[LAG-MONITOR][MAIN] Main process blocked for ${delay} ms! (Total elapsed: ${elapsed} ms, threshold: ${thresholdMs} ms)`
      );
    }

    lastTime = now;
  }, intervalMs);

  // Unref so the timer does not prevent graceful application shutdown
  activeInterval.unref();
}

export function stopMainLagMonitor(): void {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}
