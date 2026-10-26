# ADR-W04: The Vault on Disk as Single Source of Truth

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 1, 6)

## Context
Note-taking applications that use proprietary databases or intermediate cloud syncing layers introduce data lock-in, data loss risks, and complex conflict resolution. Wrriter must work seamlessly alongside standard filesystem tools, git, and sync utilities like Syncthing.

## Decision
1. **Plain Markdown Files**: Notes are standard markdown files (`.md`) residing inside user-specified vault directories on disk.
2. **Disk Authority**: The filesystem on disk is the single source of truth. All search indexes, thumbnails, and first-paint state caches are disposable.
3. **No Hidden State in Notes**: Nothing related to sync or internal application states is injected into note files.
4. **Reserved Metadata**: Wrriter stores vault-level metadata (pins, order) in a `.wrriter` directory inside the vault root. Dot-prefixed folders (`.stfolder`, `.obsidian`, `.git`) are never modified or traversed.

## Consequences
- Total user data portability and zero vendor lock-in.
- Full compatibility with Syncthing and backup systems.
- Any cache corruption is resolved by rebuilding from disk without data loss.
