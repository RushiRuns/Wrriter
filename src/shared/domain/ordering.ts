/**
 * Fractional Indexing for Manual Reordering
 * Pure domain logic (shared/domain/ordering.ts).
 * Enables O(1) manual drag & drop without renumbering adjacent items.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const MID_CHAR = 'a';
const FIRST_CHAR = '0';
const LAST_CHAR = 'z';

/**
 * Generates a fractional key lexicographically strictly between `before` and `after`.
 * If `before` is null, generates a key before `after`.
 * If `after` is null, generates a key after `before`.
 * If both are null, returns initial key 'a0'.
 */
export function generateKeyBetween(before: string | null, after: string | null): string {
  if (!before && !after) {
    return 'a0';
  }

  if (!before && after) {
    // Generate key strictly smaller than `after`
    return generateKeyBefore(after);
  }

  if (before && !after) {
    // Generate key strictly greater than `before`
    return generateKeyAfter(before);
  }

  // Both before and after exist. Ensure before < after
  const a = before!;
  const b = after!;
  if (a >= b) {
    throw new Error(`Invalid fractional index order: before ("${a}") must be < after ("${b}")`);
  }

  let i = 0;
  let prefix = '';

  while (true) {
    const charA = i < a.length ? a[i]! : FIRST_CHAR;
    const charB = i < b.length ? b[i]! : LAST_CHAR;

    if (charA === charB) {
      prefix += charA;
      i++;
      continue;
    }

    const indexA = DIGITS.indexOf(charA);
    const indexB = DIGITS.indexOf(charB);

    if (indexB - indexA > 1) {
      // Pick the midpoint digit
      const midIndex = Math.floor((indexA + indexB) / 2);
      return prefix + DIGITS[midIndex];
    } else {
      // Adjacent digits: append charA and continue to next position
      prefix += charA;
      i++;
      while (i < a.length && a[i] === LAST_CHAR) {
        prefix += LAST_CHAR;
        i++;
      }
      return prefix + generateKeyAfter(i < a.length ? a.slice(i) : '');
    }
  }
}

function generateKeyBefore(s: string): string {
  // Find a character smaller than the first character of s
  const firstIndex = DIGITS.indexOf(s[0]!);
  if (firstIndex > 1) {
    return DIGITS.charAt(Math.floor(firstIndex / 2));
  }
  // Otherwise prefix with '0'
  return FIRST_CHAR + (s.length > 1 ? generateKeyBefore(s.slice(1)) : 'V');
}

function generateKeyAfter(s: string): string {
  if (!s) return 'V';
  const lastIndex = DIGITS.indexOf(s[0]!);
  if (lastIndex < BASE - 2) {
    return DIGITS.charAt(lastIndex + 1);
  }
  return s + 'V';
}

/**
 * Sorts items per SCHEMA.md rule:
 * Notes with no order key appear at the top sorted by modified time descending.
 * Notes with order keys sort by fractional key ascending.
 */
export function sortNotesWithManualOrder<T extends { path: string; modified: number }>(
  notes: T[],
  orderMap: Record<string, string>
): T[] {
  return [...notes].sort((a, b) => {
    const keyA = orderMap[a.path];
    const keyB = orderMap[b.path];

    if (keyA && keyB) {
      return keyA.localeCompare(keyB);
    }
    if (!keyA && !keyB) {
      // Both unranked: newer modified time first
      return b.modified - a.modified;
    }
    // Unranked notes appear at the top
    return keyA ? 1 : -1;
  });
}
