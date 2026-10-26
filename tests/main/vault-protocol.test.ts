import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { resolveInsideVault } from '../../src/main/services/vault-reader';
import { VAULT_PROTOCOL_SCHEME } from '../../src/main/platform/vault-protocol';

describe('VaultProtocol', () => {
  const fakeVault = path.resolve('C:/TestVault');

  it('uses wrriter-vault custom scheme', () => {
    expect(VAULT_PROTOCOL_SCHEME).toBe('wrriter-vault');
  });

  it('resolves valid relative paths inside the vault root', () => {
    const res = resolveInsideVault(fakeVault, 'attachments/photo.png');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(path.join(fakeVault, 'attachments', 'photo.png'));
    }
  });

  it('blocks path traversal escaping vault boundary with escapesVault error', () => {
    const res = resolveInsideVault(fakeVault, '../secret.txt');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('outsideVault');
    }
  });

  it('blocks deep traversal attempts', () => {
    const res = resolveInsideVault(fakeVault, 'folder/../../windows/system32/cmd.exe');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('outsideVault');
    }
  });
});
