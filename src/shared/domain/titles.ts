import { sanitizeFileName } from './names';

/**
 * Extracts a note title from its first line:
 * - Removes leading ATX heading markers (# to ######) and surrounding whitespace.
 * - If the line is empty or whitespace-only, returns empty string.
 */
export function extractTitleFromFirstLine(firstLine: string | undefined): string {
  if (!firstLine) return '';
  const trimmed = firstLine.trim();
  // Strip 1-6 leading hashes followed by optional whitespace
  const match = trimmed.match(/^#{1,6}\s*(.*)$/);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Computes default Untitled, Untitled 2, Untitled 3... based on existing note titles.
 */
export function formatDefaultTitle(existingTitles: readonly string[]): string {
  const titlesSet = new Set(existingTitles.map((t) => t.toLowerCase()));
  if (!titlesSet.has('untitled')) {
    return 'Untitled';
  }

  let counter = 2;
  while (titlesSet.has(`untitled ${counter}`)) {
    counter++;
  }
  return `Untitled ${counter}`;
}

export interface TitleRenameCheckParams {
  readonly initialFileName: string;
  readonly initialTitle: string;
  readonly currentTitle: string;
  readonly isJournal?: boolean | undefined;
  readonly isManualRenamed?: boolean | undefined;
}

/**
 * Determines whether a file should automatically follow its first line title when leaving the note:
 * - File follows first line only if initial file name matched initial title when note opened.
 * - Does not rename if note was renamed by hand.
 * - Does not rename journal notes (YYYY-MM-DD.md).
 * - Does not rename if title is empty.
 */
export function shouldRenameFileOnLeave(params: TitleRenameCheckParams): boolean {
  if (params.isJournal || params.isManualRenamed) {
    return false;
  }

  const currentTrimmed = params.currentTitle.trim();
  if (!currentTrimmed) {
    return false;
  }

  // Strip .md extension from initial file name for comparison
  const initialBase = params.initialFileName.replace(/\.md$/i, '');
  const sanitizedInitial = sanitizeFileName(params.initialTitle);

  // Names must have matched when opened (case-insensitive)
  if (initialBase.toLowerCase() !== sanitizedInitial.toLowerCase()) {
    return false;
  }

  // New sanitized title must differ from initial
  const sanitizedCurrent = sanitizeFileName(currentTrimmed);
  return sanitizedCurrent.toLowerCase() !== initialBase.toLowerCase();
}

/**
 * Derives a valid Windows file name from title with .md extension, capped at 100 characters.
 */
export function deriveFileNameFromTitle(title: string): string {
  const sanitized = sanitizeFileName(title);
  const base = sanitized || 'Untitled';
  return `${base}.md`;
}
