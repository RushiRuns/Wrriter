/**
 * Wikilink domain models and utilities (SCHEMA.md, M3 Wikilinks and backlinks).
 *
 * Supported forms:
 * - [[Note]]
 * - [[Note|text]]
 * - [[Note#Heading]]
 * - [[Note#Heading|text]]
 * - [[Folder/Note]] (used when disambiguating notes that share a name)
 *
 * Unknown forms:
 * - Block links [[Note#^id]] stay as plain text, byte for byte.
 * - Embeds ![[pic.png]] or ![[Note]] are NOT wikilinks.
 */

export interface ParsedWikilink {
  readonly raw: string; // e.g. "[[Folder/Note#Heading|Custom Text]]"
  readonly target: string; // "Folder/Note"
  readonly noteName: string; // "Note"
  readonly folder?: string | undefined; // "Folder"
  readonly heading?: string | undefined; // "Heading"
  readonly alias?: string | undefined; // "Custom Text"
  readonly displayText: string; // alias || noteName
}

export interface ExtractedWikilink {
  readonly link: ParsedWikilink;
  readonly lineText: string;
  readonly lineIndex: number;
}

/**
 * Checks if a wikilink inner string contains an unknown form such as block ID (^id).
 * These must stay as plain text, byte for byte.
 */
export function isUnknownWikilink(inner: string): boolean {
  if (!inner || typeof inner !== 'string') return true;
  // Block link ID syntax: #^id
  if (/#\^/.test(inner)) {
    return true;
  }
  return false;
}

/**
 * Parses the inner content of a `[[...]]` wikilink (excluding the enclosing brackets).
 * Returns null if the link is an unknown form (e.g. block link) or invalid.
 */
export function parseWikilinkContent(inner: string, fullRaw = `[[${inner}]]`): ParsedWikilink | null {
  if (!inner || typeof inner !== 'string') return null;
  const trimmed = inner.trim();
  if (!trimmed || isUnknownWikilink(trimmed)) {
    return null;
  }

  // Split alias by '|'
  let targetPart = trimmed;
  let alias: string | undefined = undefined;

  const pipeIdx = trimmed.indexOf('|');
  if (pipeIdx >= 0) {
    targetPart = trimmed.slice(0, pipeIdx).trim();
    alias = trimmed.slice(pipeIdx + 1).trim() || undefined;
  }

  if (!targetPart) return null;

  // Split heading by '#'
  let target = targetPart;
  let heading: string | undefined = undefined;

  const hashIdx = targetPart.indexOf('#');
  if (hashIdx >= 0) {
    target = targetPart.slice(0, hashIdx).trim();
    heading = targetPart.slice(hashIdx + 1).trim() || undefined;
  }

  if (!target) return null;

  // Normalise target slashes
  const normTarget = target.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const lastSlash = normTarget.lastIndexOf('/');
  const folder = lastSlash >= 0 ? normTarget.slice(0, lastSlash) : undefined;
  const noteName = lastSlash >= 0 ? normTarget.slice(lastSlash + 1) : normTarget;

  const displayText = alias || (heading ? `${noteName} > ${heading}` : noteName);

  return {
    raw: fullRaw,
    target: normTarget,
    noteName,
    folder,
    heading,
    alias,
    displayText
  };
}

/**
 * Extracts all valid wikilinks from markdown text line by line, capturing each link's line text.
 * Embeds (`![[...]]`) and unknown forms (`[[Note#^id]]`) are ignored.
 */
export function extractWikilinksWithLines(text: string): ExtractedWikilink[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const results: ExtractedWikilink[] = [];

  // Match [[...]] that is NOT preceded by '!'
  const wikiRegex = /(?:^|[^!])\[\[([^\]\n]+)\]\]/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    // Skip frontmatter delimiters if at first lines
    wikiRegex.lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = wikiRegex.exec(line)) !== null) {
      const fullMatch = match[0]!;
      const inner = match[1]!;

      // Determine raw string starting from '[['
      const openBracketIdx = fullMatch.indexOf('[[');
      const raw = fullMatch.slice(openBracketIdx);

      const parsed = parseWikilinkContent(inner, raw);
      if (parsed) {
        results.push({
          link: parsed,
          lineText: line.trim(),
          lineIndex
        });
      }
    }
  }

  return results;
}

/**
 * Formats a wikilink from its component parts.
 */
export function formatWikilink(
  target: string,
  options?: { heading?: string | undefined; alias?: string | undefined }
): string {
  let content = target.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (options?.heading) {
    content += `#${options.heading.trim()}`;
  }
  if (options?.alias) {
    content += `|${options.alias.trim()}`;
  }
  return `[[${content}]]`;
}

/**
 * Rewrites a wikilink's target while preserving its heading and alias parts.
 * e.g. "[[OldNote#Heading|Display]]" with newTarget "NewNote" -> "[[NewNote#Heading|Display]]"
 */
export function rewriteWikilinkTarget(rawLink: string, newTarget: string): string {
  const match = rawLink.match(/^\[\[([^\]]+)\]\]$/);
  if (!match || !match[1]) return rawLink;

  const inner = match[1];
  const parsed = parseWikilinkContent(inner, rawLink);
  if (!parsed) return rawLink;

  return formatWikilink(newTarget, {
    heading: parsed.heading,
    alias: parsed.alias
  });
}
