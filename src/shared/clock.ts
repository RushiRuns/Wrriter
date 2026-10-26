export interface Clock {
  now(): Date;
  nowIso(): string;
  today(): string;
}

/**
 * SystemClock implements Clock using system local and UTC time.
 * This is the ONLY approved place in the application where Date.now() / new Date() without arguments is called.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  today(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * TestClock provides deterministic, controllable time for unit and integration testing.
 */
export class TestClock implements Clock {
  private current: Date;

  constructor(initial: Date | string = '2026-10-26T10:00:00.000Z') {
    this.current = typeof initial === 'string' ? new Date(initial) : new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  nowIso(): string {
    return this.current.toISOString();
  }

  today(): string {
    const d = this.current;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setTime(time: Date | string): void {
    this.current = typeof time === 'string' ? new Date(time) : new Date(time.getTime());
  }

  advanceByMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
