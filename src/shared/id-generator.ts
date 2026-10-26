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
