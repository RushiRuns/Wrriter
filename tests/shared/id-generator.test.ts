import { describe, expect, it } from 'vitest';
import { TestIdGenerator } from '../../src/shared/id-generator';

describe('IdGenerator', () => {
  it('generates deterministic sequential IDs', () => {
    const generator = new TestIdGenerator('vault');
    expect(generator.nextId()).toBe('vault-1');
    expect(generator.nextId()).toBe('vault-2');
    expect(generator.nextId()).toBe('vault-3');

    generator.reset();
    expect(generator.nextId()).toBe('vault-1');
  });
});
