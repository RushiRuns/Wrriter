import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export const INDEX_SCHEMA_VERSION = '1';

export interface NoteRecord {
  readonly path: string;
  readonly title: string;
  readonly folder: string;
  readonly mtime_ms: number;
  readonly size: number;
  readonly created: string | null;
  readonly status: string | null;
  readonly preview: string;
  readonly cover_path: string | null;
  readonly has_frontmatter: number;
}

export interface SearchResultItem {
  readonly path: string;
  readonly title: string;
  readonly folder: string;
  readonly mtime_ms: number;
  readonly preview: string;
  readonly snippet: string;
  readonly rank: number;
}

export interface FolderCountItem {
  readonly folder: string;
  readonly count: number;
}

export interface FileStatItem {
  readonly path: string;
  readonly mtime_ms: number;
  readonly size: number;
}

export interface KeysetCursor {
  readonly path: string;
  readonly sortVal: string | number;
}

export class IndexDb {
  private db: DatabaseType;
  private readonly dbPath: string;

  // Prepared statements
  private stmtInsertNote!: Statement;
  private stmtDeleteNote!: Statement;
  private stmtGetNote!: Statement;
  private stmtGetAllStats!: Statement;
  private stmtGetFolderCounts!: Statement;

  private stmtInsertTag!: Statement;
  private stmtDeleteTags!: Statement;
  private stmtInsertLink!: Statement;
  private stmtDeleteLinks!: Statement;

  private stmtGetStatuses!: Statement;
  private stmtGetTags!: Statement;
  private stmtGetTagCounts!: Statement;
  private stmtGetNotePathsWithTag!: Statement;
  private stmtGetTagNotesCount!: Statement;

  private stmtInsertFts!: Statement;
  private stmtDeleteFts!: Statement;
  private stmtSearchFts!: Statement;

  // Keyset queries for note listing
  private stmtListNotesByMtime!: Statement;
  private stmtListNotesByMtimeFolder!: Statement;
  private stmtListNotesByMtimeTag!: Statement;
  private stmtListNotesByCreated!: Statement;
  private stmtListNotesByCreatedFolder!: Statement;
  private stmtListNotesByCreatedTag!: Statement;
  private stmtListNotesByTitle!: Statement;
  private stmtListNotesByTitleFolder!: Statement;
  private stmtListNotesByTitleTag!: Statement;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = this.openAndInitialize();
  }

  /**
   * Opens the SQLite database, validating integrity and format version.
   * If missing, damaged, or of an older version, deletes and rebuilds cleanly (ADR-W15, SCHEMA.md).
   */
  private openAndInitialize(): DatabaseType {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    try {
      const db = new Database(this.dbPath);
      if (!this.validateDatabase(db)) {
        db.close();
        this.destroyDatabaseFiles();
        const freshDb = new Database(this.dbPath);
        this.setupPragmas(freshDb);
        this.createSchema(freshDb);
        this.prepareStatements(freshDb);
        return freshDb;
      }

      this.setupPragmas(db);
      this.createSchema(db);
      this.prepareStatements(db);
      return db;
    } catch {
      this.destroyDatabaseFiles();
      const freshDb = new Database(this.dbPath);
      this.setupPragmas(freshDb);
      this.createSchema(freshDb);
      this.prepareStatements(freshDb);
      return freshDb;
    }
  }

  /**
   * Deletes the SQLite file and associated WAL/SHM artifacts.
   */
  private destroyDatabaseFiles(): void {
    if (this.dbPath === ':memory:') return;
    try {
      if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);
      if (fs.existsSync(`${this.dbPath}-wal`)) fs.unlinkSync(`${this.dbPath}-wal`);
      if (fs.existsSync(`${this.dbPath}-shm`)) fs.unlinkSync(`${this.dbPath}-shm`);
    } catch {
      // Safe skip
    }
  }

  /**
   * Validates DB integrity and schema version.
   */
  private validateDatabase(db: DatabaseType): boolean {
    try {
      const quickCheck = db.pragma('quick_check') as { quick_check: string }[];
      if (!quickCheck || quickCheck[0]?.quick_check !== 'ok') {
        return false;
      }

      // Check version table
      const metaTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='index_meta'")
        .get();
      if (metaTable) {
        const row = db.prepare("SELECT value FROM index_meta WHERE key = 'version'").get() as
          | { value: string }
          | undefined;
        if (row && row.value !== INDEX_SCHEMA_VERSION) {
          return false; // older version -> rebuild
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Configures SQLite pragmas for maximum performance and relaxed durability:
   * WAL mode, NORMAL synchronous, -32000 cache size (-32MB), in-memory temp store, foreign keys.
   */
  private setupPragmas(db: DatabaseType): void {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -32000');
    db.pragma('temp_store = MEMORY');
    db.pragma('foreign_keys = ON');
  }

  /**
   * Creates the schema tables, virtual tables, and indexes defined in ADR-W15.
   */
  private createSchema(db: DatabaseType): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS index_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        folder TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        size INTEGER NOT NULL,
        created TEXT,
        status TEXT,
        preview TEXT,
        cover_path TEXT,
        has_frontmatter INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder, mtime_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_mtime ON notes(mtime_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS note_tags (
        note_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (note_path, tag),
        FOREIGN KEY (note_path) REFERENCES notes(path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tags_tag ON note_tags(tag, note_path);

      CREATE TABLE IF NOT EXISTS note_links (
        source_path TEXT NOT NULL,
        target_name TEXT NOT NULL,
        PRIMARY KEY (source_path, target_name),
        FOREIGN KEY (source_path) REFERENCES notes(path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_links_target ON note_links(target_name COLLATE NOCASE);

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
        path UNINDEXED,
        title,
        body,
        prefix='2 3 4',
        tokenize='unicode61 remove_diacritics 2'
      );
    `);

    // Ensure version record exists
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES ('version', ?)").run(
      INDEX_SCHEMA_VERSION
    );
  }

  /**
   * Prepares all parameterized statements.
   */
  private prepareStatements(db: DatabaseType): void {
    this.stmtInsertNote = db.prepare(`
      INSERT OR REPLACE INTO notes (
        path, title, folder, mtime_ms, size, created, status, preview, cover_path, has_frontmatter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtDeleteNote = db.prepare(`DELETE FROM notes WHERE path = ?`);
    this.stmtGetNote = db.prepare(`SELECT * FROM notes WHERE path = ?`);
    this.stmtGetAllStats = db.prepare(`SELECT path, mtime_ms, size FROM notes`);
    this.stmtGetFolderCounts = db.prepare(`SELECT folder, COUNT(*) as count FROM notes GROUP BY folder`);

    this.stmtInsertTag = db.prepare(`INSERT OR REPLACE INTO note_tags (note_path, tag) VALUES (?, ?)`);
    this.stmtDeleteTags = db.prepare(`DELETE FROM note_tags WHERE note_path = ?`);

    this.stmtInsertLink = db.prepare(`INSERT OR REPLACE INTO note_links (source_path, target_name) VALUES (?, ?)`);
    this.stmtDeleteLinks = db.prepare(`DELETE FROM note_links WHERE source_path = ?`);

    this.stmtGetStatuses = db.prepare(`
      SELECT DISTINCT status FROM notes
      WHERE status IS NOT NULL AND status != ''
      ORDER BY status COLLATE NOCASE ASC
    `);
    this.stmtGetTags = db.prepare(`
      SELECT DISTINCT tag FROM note_tags
      ORDER BY tag COLLATE NOCASE ASC
    `);
    this.stmtGetTagCounts = db.prepare(`
      SELECT tag, COUNT(*) as count
      FROM note_tags
      GROUP BY tag COLLATE NOCASE
      ORDER BY tag COLLATE NOCASE ASC
    `);
    this.stmtGetNotePathsWithTag = db.prepare(`
      SELECT DISTINCT note_path FROM note_tags
      WHERE tag = ? COLLATE NOCASE OR tag LIKE (? || '/%')
      ORDER BY note_path ASC
    `);
    this.stmtGetTagNotesCount = db.prepare(`
      SELECT COUNT(DISTINCT note_path) as count FROM note_tags
      WHERE tag = ? COLLATE NOCASE OR tag LIKE (? || '/%')
    `);

    this.stmtInsertFts = db.prepare(`INSERT INTO fts_notes (path, title, body) VALUES (?, ?, ?)`);
    this.stmtDeleteFts = db.prepare(`DELETE FROM fts_notes WHERE path = ?`);

    this.stmtSearchFts = db.prepare(`
      SELECT
        n.path,
        n.title,
        n.folder,
        n.mtime_ms,
        n.preview,
        snippet(fts_notes, 2, '<b>', '</b>', '...', 10) as snippet,
        rank
      FROM fts_notes
      JOIN notes n ON fts_notes.path = n.path
      WHERE fts_notes MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    // Keyset pagination statements ("continue after this row", never OFFSET)
    // Modified:
    this.stmtListNotesByMtime = db.prepare(`
      SELECT * FROM notes
      WHERE (? IS NULL OR mtime_ms < ? OR (mtime_ms = ? AND path > ?))
      ORDER BY mtime_ms DESC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByMtimeFolder = db.prepare(`
      SELECT * FROM notes
      WHERE folder = ?
        AND (? IS NULL OR mtime_ms < ? OR (mtime_ms = ? AND path > ?))
      ORDER BY mtime_ms DESC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByMtimeTag = db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.path = nt.note_path
      WHERE nt.tag = ? COLLATE NOCASE
        AND (? IS NULL OR n.mtime_ms < ? OR (n.mtime_ms = ? AND n.path > ?))
      ORDER BY n.mtime_ms DESC, n.path ASC
      LIMIT ?
    `);

    // Created:
    this.stmtListNotesByCreated = db.prepare(`
      SELECT * FROM notes
      WHERE (? IS NULL OR created < ? OR (created = ? AND path > ?))
      ORDER BY created DESC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByCreatedFolder = db.prepare(`
      SELECT * FROM notes
      WHERE folder = ?
        AND (? IS NULL OR created < ? OR (created = ? AND path > ?))
      ORDER BY created DESC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByCreatedTag = db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.path = nt.note_path
      WHERE nt.tag = ? COLLATE NOCASE
        AND (? IS NULL OR n.created < ? OR (n.created = ? AND n.path > ?))
      ORDER BY n.created DESC, n.path ASC
      LIMIT ?
    `);

    // Title:
    this.stmtListNotesByTitle = db.prepare(`
      SELECT * FROM notes
      WHERE (? IS NULL OR title COLLATE NOCASE > ? OR (title COLLATE NOCASE = ? AND path > ?))
      ORDER BY title COLLATE NOCASE ASC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByTitleFolder = db.prepare(`
      SELECT * FROM notes
      WHERE folder = ?
        AND (? IS NULL OR title COLLATE NOCASE > ? OR (title COLLATE NOCASE = ? AND path > ?))
      ORDER BY title COLLATE NOCASE ASC, path ASC
      LIMIT ?
    `);
    this.stmtListNotesByTitleTag = db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.path = nt.note_path
      WHERE nt.tag = ? COLLATE NOCASE
        AND (? IS NULL OR n.title COLLATE NOCASE > ? OR (n.title COLLATE NOCASE = ? AND n.path > ?))
      ORDER BY n.title COLLATE NOCASE ASC, n.path ASC
      LIMIT ?
    `);
  }

  /**
   * Executes a callback within a SQLite transaction.
   */
  runInTransaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  /**
   * Upserts a note with its tags, links, and searchable FTS body.
   */
  upsertNote(
    note: NoteRecord,
    tags: readonly string[],
    links: readonly string[],
    bodyForSearch: string
  ): void {
    // 1. Upsert core note
    this.stmtInsertNote.run(
      note.path,
      note.title,
      note.folder,
      note.mtime_ms,
      note.size,
      note.created,
      note.status,
      note.preview,
      note.cover_path,
      note.has_frontmatter
    );

    // 2. Update tags
    this.stmtDeleteTags.run(note.path);
    for (const tag of tags) {
      this.stmtInsertTag.run(note.path, tag);
    }

    // 3. Update links
    this.stmtDeleteLinks.run(note.path);
    for (const target of links) {
      this.stmtInsertLink.run(note.path, target);
    }

    // 4. Update FTS
    this.stmtDeleteFts.run(note.path);
    this.stmtInsertFts.run(note.path, note.title, bodyForSearch);
  }

  /**
   * Deletes a note and its corresponding tags, links, and FTS records.
   */
  deleteNote(path: string): void {
    this.stmtDeleteNote.run(path);
    this.stmtDeleteTags.run(path);
    this.stmtDeleteLinks.run(path);
    this.stmtDeleteFts.run(path);
  }

  /**
   * Retrieves a single note record by relative path.
   */
  getNote(path: string): NoteRecord | null {
    const row = this.stmtGetNote.get(path);
    return (row as NoteRecord) ?? null;
  }

  /**
   * Returns path, modified time, and size for all indexed notes (used for incremental scan check).
   */
  getAllFileStats(): FileStatItem[] {
    return this.stmtGetAllStats.all() as FileStatItem[];
  }

  /**
   * Retrieves note count per folder via COUNT(*) GROUP BY folder (M3 item 9).
   */
  getFolderCounts(): FolderCountItem[] {
    return this.stmtGetFolderCounts.all() as FolderCountItem[];
  }

  /**
   * Retrieves all unique non-empty status words used in the vault (M3 Properties).
   */
  getStatuses(): string[] {
    const rows = this.stmtGetStatuses.all() as { status: string }[];
    return rows.map((r) => r.status);
  }

  /**
   * Retrieves all unique tags across notes in the vault.
   */
  getTags(): string[] {
    const rows = this.stmtGetTags.all() as { tag: string }[];
    return rows.map((r) => r.tag);
  }

  /**
   * Retrieves all unique tags with their exact note count from the index.
   * Preserves the first spelling used, grouped case-insensitively.
   */
  getTagCounts(): { tag: string; count: number }[] {
    const rows = this.stmtGetTagCounts.all() as { tag: string; count: number }[];
    return rows;
  }

  /**
   * Retrieves all relative note paths tagged with a given tag (exact or child namespace).
   */
  getNotePathsWithTag(tag: string): string[] {
    const rows = this.stmtGetNotePathsWithTag.all(tag, tag) as { note_path: string }[];
    return rows.map((r) => r.note_path);
  }

  /**
   * Retrieves the number of distinct notes tagged with a given tag (exact or child namespace).
   */
  getTagNotesCount(tag: string): number {
    const row = this.stmtGetTagNotesCount.get(tag, tag) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Performs an FTS5 search.
   */
  search(escapedQuery: string, limit = 50): SearchResultItem[] {
    if (!escapedQuery) return [];
    return this.stmtSearchFts.all(escapedQuery, limit) as SearchResultItem[];
  }

  /**
   * Lists notes with keyset pagination ("continue after this row").
   */
  listNotes(options: {
    folder?: string | undefined;
    tag?: string | undefined;
    sortBy?: 'modified' | 'created' | 'title' | undefined;
    after?: KeysetCursor | null | undefined;
    limit?: number | undefined;
  } = {}): NoteRecord[] {
    const limit = options.limit ?? 100;
    const folder = options.folder !== undefined && options.folder !== '' ? options.folder : null;
    const tag = options.tag !== undefined && options.tag !== '' ? options.tag : null;
    const sortBy = options.sortBy ?? 'modified';
    const after = options.after ?? null;

    if (sortBy === 'title') {
      const sortVal = after ? String(after.sortVal) : null;
      const pathVal = after ? after.path : null;
      if (tag !== null) {
        return this.stmtListNotesByTitleTag.all(tag, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
      }
      if (folder !== null) {
        return this.stmtListNotesByTitleFolder.all(folder, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
      }
      return this.stmtListNotesByTitle.all(sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
    }

    if (sortBy === 'created') {
      const sortVal = after ? String(after.sortVal) : null;
      const pathVal = after ? after.path : null;
      if (tag !== null) {
        return this.stmtListNotesByCreatedTag.all(tag, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
      }
      if (folder !== null) {
        return this.stmtListNotesByCreatedFolder.all(folder, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
      }
      return this.stmtListNotesByCreated.all(sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
    }

    // Default: modified descending
    const sortVal = after ? Number(after.sortVal) : null;
    const pathVal = after ? after.path : null;
    if (tag !== null) {
      return this.stmtListNotesByMtimeTag.all(tag, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
    }
    if (folder !== null) {
      return this.stmtListNotesByMtimeFolder.all(folder, sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
    }
    return this.stmtListNotesByMtime.all(sortVal, sortVal, sortVal, pathVal, limit) as NoteRecord[];
  }

  /**
   * Returns total number of indexed notes.
   */
  totalNotes(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number };
    return row.count;
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    try {
      this.db.close();
    } catch {
      // Safe skip
    }
  }
}
