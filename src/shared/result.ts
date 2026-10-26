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
