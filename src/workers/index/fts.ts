/**
 * The single, authoritative function that escapes and formats search text for SQLite FTS5.
 * FTS5 with prefix indexes on the searched columns only. ftsEscape is the only place search text is escaped.
 * (M3, UTILITIES.md, ARCHITECTURE.md)
 */
export function ftsEscape(rawQuery: string): string {
  if (!rawQuery) {
    return '';
  }

  // Trim and normalize whitespace
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return '';
  }

  // Split on whitespace into tokens
  const tokens = trimmed.split(/\s+/);
  const escapedTokens: string[] = [];

  for (const token of tokens) {
    // Strip leading/trailing double quotes, colons, stars and punctuation that might break FTS5 token syntax
    const cleaned = token.replace(/^["*^:]+|["*^:]+$/g, '');
    if (!cleaned) {
      continue;
    }

    // Escape any remaining internal double-quotes by doubling them per SQLite FTS5 spec
    const escaped = cleaned.replace(/"/g, '""');

    // Wrap token in double quotes and append prefix wildcard '*' for fast prefix matches
    escapedTokens.push(`"${escaped}"*`);
  }

  if (escapedTokens.length === 0) {
    return '';
  }

  // Join tokens with space (implicit AND in FTS5)
  return escapedTokens.join(' ');
}
