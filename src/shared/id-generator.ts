export interface IdGenerator {
  nextId(): string;
}

/**
 * Deterministic IdGenerator for unit tests and reproducible sequences.
 */
export class TestIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix: string = 'test-id') {}

  nextId(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}

export class SystemIdGenerator implements IdGenerator {
  nextId(): string {
    const cryptoObj = typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
    return 'id-' + Math.random().toString(36).slice(2, 10);
  }
}

