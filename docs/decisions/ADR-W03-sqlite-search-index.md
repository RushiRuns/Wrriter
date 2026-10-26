# ADR-W03: SQLite FTS5 Search Index in a Worker as a Rebuildable Cache

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 4, 9)

## Context
Full-text search, wikilink tracking, tag listings, and note listing queries must operate sub-50ms across vaults containing 50,000 notes without blocking UI frame delivery or main process message handling.

## Decision
1. **Engine**: SQLite with FTS5 via `better-sqlite3`.
2. **Execution Boundary**: `better-sqlite3` runs synchronously strictly inside the Index Worker (`utilityProcess`, ADR-W11). It is never imported or called in the main process or any renderer window.
3. **Rebuildable Cache**: The index is treated strictly as a rebuildable cache stored in the local app data folder. No note content exists exclusively in the index.
4. **Schema Evolution**: Any change to the index schema bumps its version and triggers a clean deletion and rebuild. There are zero SQL database migrations.
5. **Paged Cursor Queries**: Note lists query the index using continuation keys ("continue after row"), never `OFFSET` queries.

## Consequences
- Fast full-text search and metadata queries without UI stutters.
- A corrupted or deleted index file never results in note data loss.
- Main process thread remains unblocked (< 50ms budget enforced).
