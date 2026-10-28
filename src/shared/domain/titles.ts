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

export interface NotePreviewAndImage {
  readonly preview: string;
  readonly imageSrc?: string | undefined;
  readonly hasImage: boolean;
}

/**
 * Extracts preview text (excluding title and markdown formatting) and the first image
 * from a note's raw markdown text.
 */
export function extractNotePreviewAndImage(markdown: string | undefined): NotePreviewAndImage {
  if (!markdown || !markdown.trim()) {
    return { preview: '', imageSrc: undefined, hasImage: false };
  }

  let content = markdown;

  // 1. Skip YAML Frontmatter if present
  if (content.startsWith('---')) {
    const endFmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (endFmMatch) {
      content = content.slice(endFmMatch[0].length);
    }
  }

  // 2. Find the first image across the entire content
  let imageSrc: string | undefined = undefined;

  // Check markdown image: ![alt](src) or ![alt|400|center](src)
  const mdImgRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const mdMatch = mdImgRegex.exec(content);

  // Check HTML image: <img ... src="..." ...>
  const htmlImgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const htmlMatch = htmlImgRegex.exec(content);

  // Check wikilink image: ![[attachments/photo.png]]
  const wikiImgRegex = /!\[\[([^\]]+)\]\]/g;
  const wikiMatch = wikiImgRegex.exec(content);

  const candidates: { index: number; src: string }[] = [];
  if (mdMatch && mdMatch[1]) candidates.push({ index: mdMatch.index, src: mdMatch[1].trim() });
  if (htmlMatch && htmlMatch[1]) candidates.push({ index: htmlMatch.index, src: htmlMatch[1].trim() });
  if (wikiMatch && wikiMatch[1]) candidates.push({ index: wikiMatch.index, src: wikiMatch[1].trim() });

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.index - b.index);
    imageSrc = candidates[0]?.src;
  }

  // 3. Extract preview text by skipping the first non-empty line (the title)
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  let titleFound = false;
  let preview = '';

  for (const line of lines) {
    if (!line) continue;
    if (!titleFound) {
      // First non-empty line is the title, skip it
      titleFound = true;
      continue;
    }

    // Skip pure horizontal rules and empty headings
    if (/^(?:---|\*\*\*|___)$/.test(line)) continue;
    if (/^#{1,6}\s*$/.test(line)) continue;

    // Strip markdown formatting to produce clean preview text
    const cleaned = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s*/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^-\s*\[[ xX]\]\s*/, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/!\[\[[^\]]+\]\]/g, '')
      .replace(/<img[^>]*>/gi, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned) {
      preview = cleaned.length > 150 ? `${cleaned.slice(0, 147)}...` : cleaned;
      break;
    }
  }

  return {
    preview,
    imageSrc,
    hasImage: Boolean(imageSrc)
  };
}

