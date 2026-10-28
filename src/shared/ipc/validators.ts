import { err, ok, type AppError, type Result } from '../result';

export type Validator<T> = (input: unknown) => Result<T>;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function validateString(field: string, value: unknown): Result<string> {
  if (typeof value !== 'string') {
    return err({
      kind: 'validation',
      field,
      reason: `expected string, received ${typeof value}`
    });
  }
  return ok(value);
}

export function validateNonEmptyString(field: string, value: unknown): Result<string> {
  const strResult = validateString(field, value);
  if (!strResult.ok) return strResult;
  if (strResult.value.trim().length === 0) {
    return err({
      kind: 'validation',
      field,
      reason: 'string must not be empty'
    });
  }
  return ok(strResult.value);
}

export function validateBoolean(field: string, value: unknown): Result<boolean> {
  if (typeof value !== 'boolean') {
    return err({
      kind: 'validation',
      field,
      reason: `expected boolean, received ${typeof value}`
    });
  }
  return ok(value);
}

export function validateUint8Array(field: string, value: unknown): Result<Uint8Array> {
  if (value instanceof Uint8Array) {
    return ok(value);
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'buffer' in value &&
    (value as { buffer: unknown }).buffer instanceof ArrayBuffer &&
    'byteOffset' in value &&
    typeof (value as { byteOffset: unknown }).byteOffset === 'number' &&
    'byteLength' in value &&
    typeof (value as { byteLength: unknown }).byteLength === 'number'
  ) {
    const view = value as ArrayBufferView;
    return ok(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  }
  return err({
    kind: 'validation',
    field,
    reason: `expected Uint8Array or Buffer, received ${typeof value}`
  });
}

export function validateEmptyArgs(input: unknown): Result<Record<string, never>> {
  if (input === undefined || input === null) {
    return ok({});
  }
  if (!isObject(input)) {
    return err({
      kind: 'validation',
      field: 'arguments',
      reason: 'expected empty object or undefined'
    });
  }
  return ok({});
}
