/**
 * Starts the Window Long Task Lag Monitor.
 * Active in development builds only (process.env.NODE_ENV !== 'production') per PERFORMANCE.md.
 * Detects and logs any UI thread long task exceeding 50 ms.
 */
export function startWindowLagMonitor(thresholdMs = 50): void {
  // Active only in development mode unless query parameter override is present
  if (!import.meta.env.DEV && !window.location.search.includes('lagMonitor=1')) {
    return;
  }

  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= thresholdMs) {
          console.warn(
            `[LAG-MONITOR][RENDERER] Long task detected: ${entry.duration.toFixed(1)} ms (name: ${entry.name}, start: ${entry.startTime.toFixed(1)} ms)`
          );
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (err) {
    // If longtask is not supported by the environment, ignore gracefully
    console.debug('[LAG-MONITOR] PerformanceObserver longtask not supported:', err);
  }
}
