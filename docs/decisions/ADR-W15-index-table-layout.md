# ADR-W15: Search Index SQLite Table Layout and FTS5 Configuration

Status: Proposed (SCHEMA.md proposal)  
Decided: M1 Files on disk and safety

## Context
Wrriter maintains a local SQLite database file per vault (`AppData/index/<vault-id>.sqlite`) solely as a fast, rebuildable cache. It must support sub-30ms query latency for quick switcher title matches, tag filtering, backlink discovery, and full-text search across 50,000 notes.

## Table Layout Design

### 1. `notes` Table (Core Metadata)
```sql
CREATE TABLE IF NOT EXISTS notes (
  path TEXT PRIMARY KEY,               -- Relative path from vault root (e.g. "Work/Project.md")
  title TEXT NOT NULL,                -- Note title (from first line or file name)
  folder TEXT NOT NULL,               -- Relative folder path (e.g. "Work")
  mtime_ms INTEGER NOT NULL,          -- File modified time in milliseconds
  size INTEGER NOT NULL,              -- File size in bytes
  created TEXT,                       -- Frontmatter created timestamp
  status TEXT,                        -- Frontmatter status
  preview TEXT,                       -- First paragraph snippet for list view
  cover_path TEXT,                    -- Path to first image or cover image
  has_frontmatter INTEGER DEFAULT 0   -- 1 if frontmatter exists
);

CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder, mtime_ms DESC);
CREATE INDEX IF NOT EXISTS idx_notes_mtime ON notes(mtime_ms DESC);
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title COLLATE NOCASE);
```

### 2. `tags` Table (Normalized Note Tags)
```sql
CREATE TABLE IF NOT EXISTS note_tags (
  note_path TEXT NOT NULL,
  tag TEXT NOT NULL,                  -- Lowercase normalized tag (e.g. "work/project")
  PRIMARY KEY (note_path, tag),
  FOREIGN KEY (note_path) REFERENCES notes(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON note_tags(tag, note_path);
```

### 3. `links` Table (Wikilinks and Backlinks)
```sql
CREATE TABLE IF NOT EXISTS note_links (
  source_path TEXT NOT NULL,          -- Note containing the link
  target_name TEXT NOT NULL,          -- Linked target name or path (e.g. "Meeting Notes")
  PRIMARY KEY (source_path, target_name),
  FOREIGN KEY (source_path) REFERENCES notes(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_links_target ON note_links(target_name COLLATE NOCASE);
```

### 4. `fts_notes` Table (FTS5 Prefix Search)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
  path UNINDEXED,
  title,
  body,
  prefix='2 3 4',                     -- Substring/prefix indexing for instantaneous matches
  tokenize='unicode61 remove_diacritics 2'
);
```

## Performance & Cache Characteristics
- **WAL Mode**: `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -32000;`
- **Rebuildable**: If the SQLite file is missing, damaged, or bumped to a newer version, it is simply deleted and rebuilt via full rescan without asking the user.
- **Titles in Memory**: The worker loads `title`, `path`, and `mtime_ms` into a JS memory array on startup for 0ms Quick Switcher results without SQL overhead.

## Consequences
- Guarantees sub-30ms search queries on 50,000 files.
- Zero risk of data loss as SQLite is strictly an ephemeral cache.
