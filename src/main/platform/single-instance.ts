import { app } from 'electron';

export interface SingleInstanceHandlers {
  onSecondInstance: (argv: string[], workingDirectory: string) => void;
}

/**
 * Platform adapter managing the single-instance lock and second-instance handoff.
 * ARCHITECTURE.md: "The lock is taken first at startup. A second launch from the Start menu,
 * a shortcut or login hands its request to the running copy and starts no second engine."
 */
export class SingleInstanceAdapter {
  private hasLockAcquired = false;

  /**
   * Attempts to acquire the primary single-instance lock.
   */
  requestLock(): boolean {
    this.hasLockAcquired = app.requestSingleInstanceLock();
    return this.hasLockAcquired;
  }

  /**
   * Returns whether this process currently owns the single-instance lock.
   */
  hasLock(): boolean {
    return this.hasLockAcquired;
  }

  /**
   * Registers callback to handle when a second instance is launched with arguments.
   */
  registerSecondInstance(handlers: SingleInstanceHandlers): void {
    app.on('second-instance', (_event, argv, workingDirectory) => {
      handlers.onSecondInstance(argv, workingDirectory);
    });
  }
}
