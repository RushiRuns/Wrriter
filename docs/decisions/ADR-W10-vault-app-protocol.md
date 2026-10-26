# ADR-W10: Custom App Protocol for Vault Assets and Files

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 5, ARCHITECTURE.md)

## Context
Rendering local attachments (e.g., embedded images, audio, attachments) directly via the `file://` protocol introduces significant Electron security risks, including local path exposure and privilege escalation through malformed DOM injections.

## Decision
1. **Registered Custom Protocol**: Implement a secure custom protocol (`wrriter-vault://`) registered in the main process before app ready.
2. **Strict Vault Boundary Validation**: The protocol handler resolves URLs strictly relative to the root of the currently opened vault.
3. **Escapes Blocked**: Any path attempting directory traversal (`../`) or escaping the boundaries of an open vault is immediately rejected with an HTTP 403 / access denied status.
4. **No Direct `file://` Access**: The `file://` scheme is blocked across all window webContents and CSP policies.

## Consequences
- Clean separation between renderer content and filesystem paths.
- Robust prevention of arbitrary local file disclosure attacks.
- Adherence to the highest tier of the Electron Security Checklist.
