import { describe, expect, it } from 'vitest';
import { err, ok, toMessage, type AppError } from '../../src/shared/result';

describe('Result and AppError', () => {
  it('constructs an ok result with value', () => {
    const res = ok(42);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(42);
    }
  });

  it('constructs an err result with AppError', () => {
    const error: AppError = { kind: 'notFound' };
    const res = err(error);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('notFound');
    }
  });

  it('formats human-readable messages for all error kinds without stack traces or apologies', () => {
    expect(toMessage({ kind: 'validation', field: 'title', reason: 'cannot be empty' })).toBe(
      'Invalid title: cannot be empty.'
    );
    expect(toMessage({ kind: 'notFound' })).toBe('Note or folder not found.');
    expect(toMessage({ kind: 'outsideVault' })).toBe('Target is outside the vault.');
    expect(toMessage({ kind: 'locked', path: 'notes/test.md' })).toBe(
      'File is locked by another program: notes/test.md.'
    );
    expect(toMessage({ kind: 'diskFull' })).toBe('Disk is full. Free up space and try again.');
    expect(toMessage({ kind: 'vaultUnavailable' })).toBe(
      'Vault folder is not accessible. Check the connection or drive.'
    );
    expect(toMessage({ kind: 'ruleViolation', rule: 'singleWriter' })).toBe(
      'Action not permitted: singleWriter.'
    );
    expect(toMessage({ kind: 'unexpected', message: 'Something broke' })).toBe('Something broke');
  });
});
