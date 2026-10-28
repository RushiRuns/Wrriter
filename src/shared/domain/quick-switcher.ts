/**
 * Domain module for Quick Switcher title matching and candidate generation.
 * Operates entirely on the in-memory title list for sub-30ms responsiveness on 50,000 notes (M3, ADR-W15, PERFORMANCE.md).
 * Follows ARCHITECTURE.md rule 12: all domain matching logic in shared/domain.
 */

export interface QuickSwitcherSourceNote {
  readonly path: string;
  readonly title: string;
  readonly mtime_ms: number;
}

export type QuickSwitcherItemType = 'note' | 'create';

export interface QuickSwitcherItem {
  readonly type: QuickSwitcherItemType;
  readonly path: string;
  readonly title: string;
  readonly folder: string;
  readonly mtime_ms: number;
  readonly score: number;
}

/**
 * Extracts the parent folder display string from a relative note path.
 */
export function getFolderFromPath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const lastSlash = norm.lastIndexOf('/');
  if (lastSlash === -1) {
    return '';
  }
  return norm.substring(0, lastSlash);
}

/**
 * Computes a loose title matching score for a search query against a note's title.
 * Returns score > 0 for a match, 0 for no match.
 * Zero-allocation design for ultra-high-throughput scanning across 50,000 notes.
 */
export function scoreTitleMatch(
  cleanQuery: string,
  title: string,
  skipSubsequence = false,
  requiredChars?: readonly string[],
  requiredUpper?: readonly string[]
): number {
  if (!cleanQuery) return 1;

  const queryLen = cleanQuery.length;
  const titleLen = title.length;

  // Fast rejection: Every non-space character of cleanQuery MUST be present in title
  if (requiredChars && requiredUpper) {
    for (let i = 0; i < requiredChars.length; i++) {
      if (title.indexOf(requiredChars[i]!) === -1 && title.indexOf(requiredUpper[i]!) === -1) {
        return 0;
      }
    }
  } else {
    for (let i = 0; i < queryLen; i++) {
      const ch = cleanQuery[i]!;
      if (ch === ' ') continue;
      if (title.indexOf(ch) === -1 && title.indexOf(ch.toUpperCase()) === -1) {
        return 0;
      }
    }
  }

  const titleLower = title.toLowerCase();

  // 1. Exact match
  if (titleLower === cleanQuery) {
    return 10000;
  }

  // Fast path: V8 SIMD-accelerated substring search
  const subIdx = titleLower.indexOf(cleanQuery);

  if (subIdx === 0) {
    // 2. Starts with query (prefix)
    return 5000 + (queryLen / titleLen) * 100;
  }

  if (subIdx > 0) {
    // 3. Check if occurrence begins at a word boundary
    const prev = titleLower.charCodeAt(subIdx - 1);
    const isAlphanumeric =
      (prev >= 48 && prev <= 57) ||
      (prev >= 97 && prev <= 122);

    if (!isAlphanumeric) {
      // Word starts with query
      return 3000 + (queryLen / (titleLen - subIdx)) * 50;
    }

    // 4. Substring inside a word
    return 2000 - Math.min(subIdx * 2, 500);
  }

  // 5. Acronym match (only when query has no spaces)
  if (!cleanQuery.includes(' ')) {
    let qIdx = 0;
    let inWord = false;

    for (let i = 0; i < titleLen && qIdx < queryLen; i++) {
      const code = titleLower.charCodeAt(i);
      const isAlpha =
        (code >= 48 && code <= 57) ||
        (code >= 97 && code <= 122);

      if (isAlpha) {
        if (!inWord) {
          if (code === cleanQuery.charCodeAt(qIdx)) {
            qIdx++;
          }
          inWord = true;
        }
      } else {
        inWord = false;
      }
    }

    if (qIdx === queryLen) {
      return 1500;
    }
  }

  // 6. Subsequence fuzzy match (all query characters appear in title in order)
  if (skipSubsequence) {
    return 0;
  }

  let qIdx = 0;
  for (let i = 0; i < titleLen && qIdx < queryLen; i++) {
    if (titleLower.charCodeAt(i) === cleanQuery.charCodeAt(qIdx)) {
      qIdx++;
    }
  }

  if (qIdx === queryLen) {
    return 1000 - Math.min(titleLen, 300);
  }

  return 0; // No match
}

interface InternalMatch {
  note: QuickSwitcherSourceNote;
  score: number;
}

/**
 * Matches candidate notes from the in-memory TitleList against the user's query.
 * - When query is empty: returns recent notes ordered by modified time descending.
 * - When query is non-empty: loose title matching, sorted by score DESC then modified time DESC.
 * - When nothing matches: returns a single "create" item offering to create the note.
 */
export function matchQuickSwitcher(
  items: readonly QuickSwitcherSourceNote[],
  rawQuery: string,
  limit = 30
): readonly QuickSwitcherItem[] {
  const cleanQuery = rawQuery.trim().toLowerCase();

  // 1. Empty query: return recent notes sorted by mtime_ms descending
  if (!cleanQuery) {
    const recent = items.slice().sort((a, b) => b.mtime_ms - a.mtime_ms);
    return recent.slice(0, limit).map((n) => ({
      type: 'note' as const,
      path: n.path,
      title: n.title,
      folder: getFolderFromPath(n.path),
      mtime_ms: n.mtime_ms,
      score: 1
    }));
  }

  // 2. Query non-empty: scan in memory and score into tiered buckets for sub-30ms performance on 50,000 notes
  const requiredChars: string[] = [];
  const requiredUpper: string[] = [];
  for (let c = 0; c < cleanQuery.length; c++) {
    const ch = cleanQuery[c]!;
    if (ch !== ' ') {
      requiredChars.push(ch);
      requiredUpper.push(ch.toUpperCase());
    }
  }

  const tier1: InternalMatch[] = []; // >= 5000 (exact, prefix)
  const tier2: InternalMatch[] = []; // >= 3000 (word boundary)
  const tier3: InternalMatch[] = []; // >= 2000 (substring)
  const tier4: InternalMatch[] = []; // < 2000 (fuzzy, acronym)

  let skipSubsequence = false;
  for (let i = 0; i < items.length; i++) {
    const note = items[i]!;
    const score = scoreTitleMatch(cleanQuery, note.title, skipSubsequence, requiredChars, requiredUpper);
    if (score >= 5000) {
      tier1.push({ note, score });
      if (tier1.length >= limit) {
        skipSubsequence = true;
      }
    } else if (score >= 3000) {
      tier2.push({ note, score });
    } else if (score >= 2000) {
      tier3.push({ note, score });
    } else if (score > 0) {
      tier4.push({ note, score });
    }
  }

  const sortTier = (arr: InternalMatch[]) => {
    arr.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.note.mtime_ms - a.note.mtime_ms;
    });
  };

  const matches: InternalMatch[] = [];
  sortTier(tier1);
  matches.push(...tier1);

  if (matches.length < limit && tier2.length > 0) {
    sortTier(tier2);
    matches.push(...tier2);
  }
  if (matches.length < limit && tier3.length > 0) {
    sortTier(tier3);
    matches.push(...tier3);
  }
  if (matches.length < limit && tier4.length > 0) {
    sortTier(tier4);
    matches.push(...tier4);
  }

  const sliced = matches.slice(0, limit);

  // 4. If nothing matches, offer to create "what you typed"
  if (sliced.length === 0 && rawQuery.trim().length > 0) {
    const trimmedTitle = rawQuery.trim();
    const suggestedPath = trimmedTitle.toLowerCase().endsWith('.md')
      ? trimmedTitle
      : `${trimmedTitle}.md`;

    return [
      {
        type: 'create',
        path: suggestedPath,
        title: trimmedTitle,
        folder: '',
        mtime_ms: Date.now(),
        score: 0
      }
    ];
  }

  // 5. Extract folders only for the visible top N matches
  return sliced.map((m) => ({
    type: 'note' as const,
    path: m.note.path,
    title: m.note.title,
    folder: getFolderFromPath(m.note.path),
    mtime_ms: m.note.mtime_ms,
    score: m.score
  }));
}
