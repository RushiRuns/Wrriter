import { protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { resolveInsideVault } from '../services/vault-reader';
import type { VaultService } from '../services/vault-service';

export const VAULT_PROTOCOL_SCHEME = 'wrriter-vault';

/**
 * Registers wrriter-vault as a secure privileged scheme before app ready.
 * Must be called before app.whenReady().
 */
export function registerVaultProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: VAULT_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

/**
 * Handles wrriter-vault:// requests:
 * Resolves paths strictly inside the currently active vault root.
 * Directory traversal or escaping vault returns 403 Forbidden.
 */
export function setupVaultProtocolHandler(vaultService: VaultService): void {
  protocol.handle(VAULT_PROTOCOL_SCHEME, async (request) => {
    try {
      const activeRes = await vaultService.getActiveVault();
      if (!activeRes.ok || !activeRes.value) {
        return new Response('Vault not available', { status: 404 });
      }

      const vaultRoot = activeRes.value.path;
      const url = new URL(request.url);

      // Decoded path inside vault (e.g. /attachments/photo.png or wrriter-vault://attachments/photo.png)
      const rawPath = url.host ? `${url.host}${url.pathname}` : url.pathname;
      let relativePath = decodeURIComponent(rawPath);
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }

      const resolved = resolveInsideVault(vaultRoot, relativePath);
      if (!resolved.ok) {
        return new Response('Access Denied: Path escapes vault boundary', { status: 403 });
      }

      const filePath = resolved.value;
      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Internal error serving vault file', { status: 500 });
    }
  });
}
