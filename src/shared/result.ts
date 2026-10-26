export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError };

export type AppError =
  | { readonly kind: 'validation'; readonly field: string; readonly reason: string }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'outsideVault' }
  | { readonly kind: 'locked'; readonly path: string }
  | { readonly kind: 'diskFull' }
  | { readonly kind: 'vaultUnavailable' }
  | { readonly kind: 'ruleViolation'; readonly rule: string }
  | { readonly kind: 'unexpected'; readonly message: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: AppError): Result<T> {
  return { ok: false, error };
}

export function toMessage(error: AppError): string {
  switch (error.kind) {
    case 'validation':
      return `Validation failed on ${error.field}: ${error.reason}`;
    case 'notFound':
      return 'File or item not found';
    case 'outsideVault':
      return 'The requested path is outside the vault';
    case 'locked':
      return `File is locked by another program: ${error.path}`;
    case 'diskFull':
      return 'Disk is full. Free up space and try again';
    case 'vaultUnavailable':
      return 'The vault folder is currently unavailable';
    case 'ruleViolation':
      return `Rule violation: ${error.rule}`;
    case 'unexpected':
      return `Unexpected error: ${error.message}`;
  }
}
