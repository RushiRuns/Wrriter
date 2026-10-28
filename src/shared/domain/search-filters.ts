/**
 * Domain module for parsing and formatting search queries with filters.
 * Supports tag:, status:, and folder: filters combined with free-text search words (M3).
 * Follows ARCHITECTURE.md rule 12: all domain search filtering logic in shared/domain.
 */

export interface ParsedSearchQuery {
  readonly rawQuery: string;
  readonly tags: readonly string[];
  readonly statuses: readonly string[];
  readonly folders: readonly string[];
  readonly textQuery: string;
  readonly words: readonly string[];
}

/**
 * Normalizes a folder filter path (e.g., replaces backslashes with forward slashes and trims leading/trailing slashes).
 */
function normalizeFolderPath(folder: string): string {
  return folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
}

/**
 * Normalizes a tag filter (removes leading '#' if user typed tag:#work).
 */
function normalizeTag(tag: string): string {
  return tag.replace(/^#+/, '').trim();
}

/**
 * Parses a raw search query string into structured filters (tag:, status:, folder:)
 * and remaining free-text words.
 * Handles quoted values like tag:"deep work" or folder:"Work/2026 Projects".
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  if (!rawQuery || !rawQuery.trim()) {
    return {
      rawQuery: rawQuery ?? '',
      tags: [],
      statuses: [],
      folders: [],
      textQuery: '',
      words: []
    };
  }

  const tags: string[] = [];
  const statuses: string[] = [];
  const folders: string[] = [];
  const words: string[] = [];

  // Match either key:"quoted value" or key:unquoted_value or "quoted text" or plain words
  // Regex matches:
  // 1) (tag|status|folder):"([^"]+)"
  // 2) (tag|status|folder):(\S+)
  // 3) "([^"]+)"
  // 4) \S+
  const tokenRegex = /(?:(tag|status|folder):(?:"([^"]+)"|(\S+)))|(?:"([^"]+)")|(\S+)/gi;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(rawQuery)) !== null) {
    const key = match[1]?.toLowerCase();
    const quotedFilterVal = match[2];
    const unquotedFilterVal = match[3];
    const filterVal = quotedFilterVal ?? unquotedFilterVal;

    if (key && filterVal !== undefined) {
      if (key === 'tag') {
        const cleanTag = normalizeTag(filterVal);
        if (cleanTag && !tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
          tags.push(cleanTag);
        }
      } else if (key === 'status') {
        const cleanStatus = filterVal.trim();
        if (cleanStatus && !statuses.some((s) => s.toLowerCase() === cleanStatus.toLowerCase())) {
          statuses.push(cleanStatus);
        }
      } else if (key === 'folder') {
        const cleanFolder = normalizeFolderPath(filterVal);
        if (cleanFolder && !folders.some((f) => f.toLowerCase() === cleanFolder.toLowerCase())) {
          folders.push(cleanFolder);
        }
      }
    } else {
      // Plain text word or quoted phrase
      const quotedText = match[4];
      const plainWord = match[5];
      const text = quotedText ?? plainWord;
      if (text) {
        words.push(text.trim());
      }
    }
  }

  const textQuery = words.join(' ').trim();

  return {
    rawQuery,
    tags,
    statuses,
    folders,
    textQuery,
    words
  };
}

/**
 * Returns true if the query has any active tag, status, or folder filters.
 */
export function hasFilters(parsed: ParsedSearchQuery): boolean {
  return parsed.tags.length > 0 || parsed.statuses.length > 0 || parsed.folders.length > 0;
}

/**
 * Returns true if the query has no text and no filters.
 */
export function isEmptyQuery(parsed: ParsedSearchQuery): boolean {
  return !parsed.textQuery && !hasFilters(parsed);
}

/**
 * Formats structured search filters and text into a canonical search string.
 */
export function formatSearchQuery(options: {
  textQuery?: string;
  tags?: readonly string[];
  statuses?: readonly string[];
  folders?: readonly string[];
}): string {
  const parts: string[] = [];

  if (options.folders) {
    for (const f of options.folders) {
      if (!f) continue;
      const clean = normalizeFolderPath(f);
      parts.push(clean.includes(' ') ? `folder:"${clean}"` : `folder:${clean}`);
    }
  }

  if (options.tags) {
    for (const t of options.tags) {
      if (!t) continue;
      const clean = normalizeTag(t);
      parts.push(clean.includes(' ') ? `tag:"${clean}"` : `tag:${clean}`);
    }
  }

  if (options.statuses) {
    for (const s of options.statuses) {
      if (!s) continue;
      const clean = s.trim();
      parts.push(clean.includes(' ') ? `status:"${clean}"` : `status:${clean}`);
    }
  }

  if (options.textQuery && options.textQuery.trim()) {
    parts.push(options.textQuery.trim());
  }

  return parts.join(' ');
}
