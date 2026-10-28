import { parseFrontmatter } from '../domain/frontmatter';
import { extractNotePreviewAndImage, extractTitleFromFirstLine } from '../domain/titles';
import { cleanTag, isValidTag, normalizeTag } from '../domain/tags';
import { extractWikilinksWithLines } from '../domain/wikilinks';

export interface LightIndexResult {
  readonly title: string;
  readonly folder: string;
  readonly tags: readonly string[];
  readonly wikilinks: readonly string[];
  readonly linkItems: readonly { target: string; lineText: string }[];
  readonly preview: string;
  readonly coverPath: string | null;
  readonly created: string | null;
  readonly status: string | null;
  readonly hasFrontmatter: boolean;
  readonly bodyForSearch: string;
}

/**
 * Extracts a normalized folder path from a relative note path (forward slashes).
 * e.g. "Work/Projects/Note.md" -> "Work/Projects"
 * e.g. "Note.md" -> ""
 */
function extractFolderFromPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return '';
  }
  return normalized.slice(0, lastSlash);
}

/**
 * Extracts the fallback title from the relative file path.
 * e.g. "Work/Project.md" -> "Project"
 */
function extractFallbackTitle(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  return base.replace(/\.md$/i, '') || 'Untitled';
}

/**
 * Light pattern-matching indexer:
 * Extracts frontmatter, tags, wikilinks, the first lines and the first image.
 * Never the editor, never a full parse (M3, UTILITIES.md).
 */
export function lightIndexNote(relPath: string, text: string): LightIndexResult {
  const normalizedRelPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const folder = extractFolderFromPath(normalizedRelPath);
  const fallbackTitle = extractFallbackTitle(normalizedRelPath);

  // 1. Frontmatter parsing
  const fm = parseFrontmatter(text);
  const hasValidFrontmatter = fm.hasFrontmatter && !fm.isBroken;

  // Tags: not case sensitive, first spelling preserved, deduplicated
  const tags: string[] = [];
  const seenTagNormalized = new Set<string>();
  if (hasValidFrontmatter && fm.tags.length > 0) {
    for (const rawTag of fm.tags) {
      const cleaned = cleanTag(rawTag);
      if (cleaned && isValidTag(cleaned)) {
        const norm = normalizeTag(cleaned);
        if (!seenTagNormalized.has(norm)) {
          seenTagNormalized.add(norm);
          tags.push(cleaned);
        }
      }
    }
  }

  const status = hasValidFrontmatter ? fm.status : null;
  const created = hasValidFrontmatter ? fm.created : null;

  // Content for title, preview, and wikilinks: use fm.body if frontmatter lines exist, otherwise raw text
  const body = fm.hasFrontmatter && fm.body ? fm.body : (fm.hasFrontmatter ? '' : text);

  // 2. Title from first non-empty line without ATX heading hashes
  let title = fallbackTitle;
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const extracted = extractTitleFromFirstLine(trimmed);
      if (extracted) {
        title = extracted;
      }
      break;
    }
  }

  // 3. Preview and cover image
  const previewInfo = extractNotePreviewAndImage(body);
  const preview = previewInfo.preview;
  const coverPath = previewInfo.imageSrc ?? null;

  // 4. Wikilinks extraction: [[Target]], [[Target|Alias]], [[Target#Heading]], [[Folder/Target]]
  // Captures target and snippet line while ignoring embeds like ![[pic.png]] and block links [[Note#^id]]
  const extracted = extractWikilinksWithLines(body);
  const linkSet = new Set<string>();
  const linkItems: { target: string; lineText: string }[] = [];

  for (const item of extracted) {
    linkSet.add(item.link.target);
    linkItems.push({ target: item.link.target, lineText: item.lineText });
  }
  const wikilinks = Array.from(linkSet);

  return {
    title,
    folder,
    tags,
    wikilinks,
    linkItems,
    preview,
    coverPath,
    created,
    status,
    hasFrontmatter: fm.hasFrontmatter,
    bodyForSearch: body
  };
}
