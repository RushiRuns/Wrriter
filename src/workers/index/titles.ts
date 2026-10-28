export interface TitleItem {
  readonly path: string;
  readonly title: string;
  readonly mtime_ms: number;
}

/**
 * In-memory registry of every note's title, path, and modified time.
 * Maintained in the index worker for sub-30ms Quick Switcher matching (ADR-W15, M3).
 */
export class TitleList {
  private readonly itemsByPath = new Map<string, TitleItem>();
  private arrayCache: TitleItem[] | null = null;

  /**
   * Initializes or bulk loads titles into memory.
   */
  init(entries: readonly TitleItem[]): void {
    this.itemsByPath.clear();
    for (const entry of entries) {
      this.itemsByPath.set(entry.path, entry);
    }
    this.arrayCache = null;
  }

  /**
   * Sets or updates a single note title entry.
   */
  set(entry: TitleItem): void {
    this.itemsByPath.set(entry.path, entry);
    this.arrayCache = null;
  }

  /**
   * Removes a note path from memory.
   */
  remove(path: string): void {
    if (this.itemsByPath.delete(path)) {
      this.arrayCache = null;
    }
  }

  /**
   * Retrieves a single entry by relative path.
   */
  get(path: string): TitleItem | null {
    return this.itemsByPath.get(path) ?? null;
  }

  /**
   * Returns all title items in memory (cached until next mutation).
   */
  getAll(): readonly TitleItem[] {
    if (!this.arrayCache) {
      this.arrayCache = Array.from(this.itemsByPath.values());
    }
    return this.arrayCache;
  }

  /**
   * Returns total count of notes currently held in memory.
   */
  size(): number {
    return this.itemsByPath.size;
  }
}
