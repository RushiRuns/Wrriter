/**
 * Link resolution domain models and utilities (SCHEMA.md, M3 Wikilinks and backlinks).
 *
 * Rules:
 * - [[Folder/Note]]: matches exact relative path inside the vault when disambiguated.
 * - Plain link [[Note]]:
 *   1. Resolves to the note in the same folder as the source note.
 *   2. Otherwise, resolves to the most recently modified matching note across the vault.
 * - Missing note: when no candidate note exists, flagged as isMissing (clicking creates note in current folder).
 * - Markdown links [text](other.md) to .md files inside the vault resolve and open in Wrriter.
 */

export interface NoteReference {
  readonly path: string; // Relative path, e.g. "Work/Project.md" or "Note.md"
  readonly title?: string | undefined; // Display title, e.g. "Project"
  readonly modified: number; // File mtimeMs
}

export interface ResolvedLink {
  readonly resolved: boolean;
  readonly path?: string | undefined; // Relative path to resolved note, e.g. "Work/Project.md"
  readonly targetName: string; // The parsed target name, e.g. "Project"
  readonly heading?: string | undefined; // Optional heading section
  readonly isMissing: boolean; // True if note does not exist in vault
}

/**
 * Normalises a file path to unix style without leading slashes.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Extracts folder relative path from a note path.
 * e.g. "Work/Projects/Alpha.md" -> "Work/Projects"
 * e.g. "Note.md" -> ""
 */
function getFolderOfPath(p: string): string {
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}

/**
 * Extracts the file basename without .md extension.
 * e.g. "Work/Project.md" -> "Project"
 */
function getBaseNameOfPath(p: string): string {
  const norm = normalizePath(p);
  const filename = norm.slice(norm.lastIndexOf('/') + 1);
  return filename.replace(/\.md$/i, '');
}

/**
 * Resolves a wikilink target within a vault.
 *
 * If target contains a slash (e.g. "Folder/Note"):
 * - Matches exact folder and note name (case-insensitive).
 *
 * If target is a plain note name (e.g. "Note"):
 * - Candidate notes match basename or title (case-insensitive).
 * - Preference 1: Candidate in the same folder as sourceNotePath.
 * - Preference 2: Most recently modified candidate (highest modified timestamp).
 * - If no candidate matches, marked as isMissing.
 */
export function resolveLink(
  target: string,
  sourceNotePath: string,
  availableNotes: readonly NoteReference[],
  heading?: string
): ResolvedLink {
  const trimmed = target.trim();
  if (!trimmed) {
    return { resolved: false, targetName: '', isMissing: true };
  }

  const normTarget = normalizePath(trimmed).replace(/\.md$/i, '');
  const sourceFolder = getFolderOfPath(sourceNotePath);

  // 1. Path-style link: target contains a slash, e.g. "Folder/Note"
  if (normTarget.includes('/')) {
    const targetWithMd = `${normTarget.toLowerCase()}.md`;
    const exactMatch = availableNotes.find(
      (n) => normalizePath(n.path).toLowerCase() === targetWithMd
    );

    if (exactMatch) {
      return {
        resolved: true,
        path: exactMatch.path,
        targetName: trimmed,
        heading,
        isMissing: false
      };
    }

    return {
      resolved: false,
      targetName: trimmed,
      heading,
      isMissing: true
    };
  }

  // 2. Plain note link: target has no slashes
  const targetLower = normTarget.toLowerCase();
  const candidates: NoteReference[] = [];

  for (const note of availableNotes) {
    const baseName = getBaseNameOfPath(note.path).toLowerCase();
    const titleLower = note.title ? note.title.toLowerCase() : '';

    if (baseName === targetLower || titleLower === targetLower) {
      candidates.push(note);
    }
  }

  if (candidates.length === 0) {
    return {
      resolved: false,
      targetName: trimmed,
      heading,
      isMissing: true
    };
  }

  // Single candidate
  if (candidates.length === 1) {
    return {
      resolved: true,
      path: candidates[0]!.path,
      targetName: trimmed,
      heading,
      isMissing: false
    };
  }

  // Disambiguation Preference 1: Note in the same folder as the source note
  const sameFolderCand = candidates.find(
    (c) => getFolderOfPath(c.path).toLowerCase() === sourceFolder.toLowerCase()
  );
  if (sameFolderCand) {
    return {
      resolved: true,
      path: sameFolderCand.path,
      targetName: trimmed,
      heading,
      isMissing: false
    };
  }

  // Disambiguation Preference 2: Most recently modified candidate
  const sorted = candidates.slice().sort((a, b) => b.modified - a.modified);
  return {
    resolved: true,
    path: sorted[0]!.path,
    targetName: trimmed,
    heading,
    isMissing: false
  };
}

/**
 * Resolves a standard markdown link [text](path.md) within a vault.
 * Returns null if the href is an external web link or not a vault markdown file.
 */
export function resolveMarkdownLink(
  href: string,
  sourceNotePath: string,
  availableNotes: readonly NoteReference[]
): ResolvedLink | null {
  if (!href || typeof href !== 'string') return null;

  const trimmed = href.trim();
  // External web protocols
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  // Clean anchors or queries
  let targetPath = trimmed;
  let heading: string | undefined = undefined;

  const hashIdx = targetPath.indexOf('#');
  if (hashIdx >= 0) {
    heading = decodeURIComponent(targetPath.slice(hashIdx + 1)).trim() || undefined;
    targetPath = targetPath.slice(0, hashIdx);
  }

  if (!targetPath.endsWith('.md')) {
    return null;
  }

  try {
    targetPath = decodeURIComponent(targetPath);
  } catch {}

  const sourceFolder = getFolderOfPath(sourceNotePath);
  // Resolve relative path
  const parts = (sourceFolder ? `${sourceFolder}/${targetPath}` : targetPath).split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  const resolvedRel = stack.join('/');
  const resolvedLower = resolvedRel.toLowerCase();

  const match = availableNotes.find((n) => normalizePath(n.path).toLowerCase() === resolvedLower);
  if (match) {
    return {
      resolved: true,
      path: match.path,
      targetName: getBaseNameOfPath(match.path),
      heading,
      isMissing: false
    };
  }

  return {
    resolved: false,
    path: resolvedRel,
    targetName: getBaseNameOfPath(resolvedRel),
    heading,
    isMissing: true
  };
}
