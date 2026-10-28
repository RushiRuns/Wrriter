/**
 * Tag domain models and utilities (SCHEMA.md, Features 4, M3).
 *
 * Rules:
 * - Allowed characters: letters, numbers, hyphens, underscores, slashes.
 * - No spaces (a space while typing starts the next tag).
 * - Not case sensitive, with the first spelling shown.
 * - Nesting by slash: e.g. "Work/Projects/Alpha".
 * - A #word in markdown body text remains plain text; tags come only from frontmatter tags:.
 */

export interface TagNode {
  readonly name: string;
  readonly tag: string;
  readonly normalizedTag: string;
  readonly count: number;
  readonly totalCount: number;
  readonly children: TagNode[];
}

export interface TagCountItem {
  readonly tag: string;
  readonly count: number;
}

/**
 * Validates a single tag or nested tag path.
 * Must consist of 1+ non-empty segments separated by single slashes.
 * Each segment contains only Unicode letters, numbers, hyphens, or underscores.
 */
export function isValidTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  const trimmed = tag.trim();
  if (trimmed.length === 0 || trimmed.startsWith('/') || trimmed.endsWith('/')) {
    return false;
  }
  if (trimmed.includes('//') || /\s/.test(trimmed)) {
    return false;
  }

  const segments = trimmed.split('/');
  // Segment regex: Unicode letters, numbers, hyphens, underscores
  const segmentPattern = /^[\p{L}\p{N}_\-]+$/u;
  return segments.every((seg) => segmentPattern.test(seg));
}

/**
 * Cleans raw user input into a tag candidate:
 * - Trims whitespace
 * - Strips leading '#' symbol (if user typed '#tag')
 * - Strips leading and trailing slashes
 * - Replaces consecutive slashes with single slash
 */
export function cleanTag(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  // Strip leading '#'
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.replace(/^#+/, '');
  }
  // Strip leading and trailing slashes
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');
  // Collapse duplicate slashes
  cleaned = cleaned.replace(/\/+/g, '/');
  return cleaned;
}

/**
 * Normalizes a tag for case-insensitive comparisons and indexing.
 */
export function normalizeTag(tag: string): string {
  return cleanTag(tag).toLowerCase();
}

/**
 * Compares two tags for case-insensitive equality.
 */
export function tagEquals(a: string, b: string): boolean {
  return normalizeTag(a) === normalizeTag(b);
}

/**
 * Checks if a note tag matches a filter tag.
 * Exact match (case-insensitive).
 */
export function tagMatches(noteTag: string, filterTag: string): boolean {
  return tagEquals(noteTag, filterTag);
}

/**
 * Splits a nested tag into its segment components.
 * e.g. "Work/Project/V1" -> ["Work", "Project", "V1"]
 */
export function splitTagSegments(tag: string): string[] {
  const cleaned = cleanTag(tag);
  if (!cleaned) return [];
  return cleaned.split('/');
}

/**
 * Parses user tag input (e.g. from the Add Tag dialog or command).
 * Splits on whitespace or commas: "A space while adding a tag starts the next one".
 * Strips '#' prefixes, validates, and deduplicates case-insensitively preserving first spelling.
 */
export function parseTagsInput(input: string): string[] {
  if (!input || typeof input !== 'string') return [];

  // Split on whitespace or commas
  const tokens = input.split(/[,\s]+/);
  const result: string[] = [];
  const seenNormalized = new Set<string>();

  for (const token of tokens) {
    const cleaned = cleanTag(token);
    if (isValidTag(cleaned)) {
      const normalized = normalizeTag(cleaned);
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        result.push(cleaned);
      }
    }
  }

  return result;
}

/**
 * Builds a hierarchical tag tree from a list of tags with counts.
 * - Slashes nest into parent/child nodes.
 * - Preserves the first spelling seen for each tag segment.
 * - Computes direct note count (`count`) and recursive total count (`totalCount`).
 * - Sorts nodes alphabetically case-insensitively at each tree level.
 */
export function buildTagTree(tagsWithCounts: readonly TagCountItem[]): TagNode[] {
  interface MutableNode {
    name: string;
    tag: string;
    normalizedTag: string;
    count: number;
    totalCount: number;
    childrenMap: Map<string, MutableNode>;
  }

  const rootChildrenMap = new Map<string, MutableNode>();

  for (const item of tagsWithCounts) {
    const rawTag = cleanTag(item.tag);
    if (!isValidTag(rawTag)) continue;

    const segments = splitTagSegments(rawTag);
    let currentMap = rootChildrenMap;
    let accumulatedPathSegments: string[] = [];
    let accumulatedNormalizedSegments: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      accumulatedPathSegments.push(seg);
      accumulatedNormalizedSegments.push(seg.toLowerCase());

      const segNormalized = seg.toLowerCase();
      const currentFullTag = accumulatedPathSegments.join('/');
      const currentFullNormalized = accumulatedNormalizedSegments.join('/');
      const isLeaf = i === segments.length - 1;

      let node = currentMap.get(segNormalized);
      if (!node) {
        node = {
          name: seg, // Preserve first spelling seen
          tag: currentFullTag,
          normalizedTag: currentFullNormalized,
          count: isLeaf ? item.count : 0,
          totalCount: 0,
          childrenMap: new Map()
        };
        currentMap.set(segNormalized, node);
      } else if (isLeaf) {
        node.count += item.count;
      }

      currentMap = node.childrenMap;
    }
  }

  function finalizeNode(mNode: MutableNode): TagNode {
    const children: TagNode[] = Array.from(mNode.childrenMap.values())
      .map(finalizeNode)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const childrenTotal = children.reduce((acc, c) => acc + c.totalCount, 0);
    const totalCount = mNode.count + childrenTotal;

    return {
      name: mNode.name,
      tag: mNode.tag,
      normalizedTag: mNode.normalizedTag,
      count: mNode.count,
      totalCount,
      children
    };
  }

  return Array.from(rootChildrenMap.values())
    .map(finalizeNode)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * Renames or merges a tag in a list of tags.
 * If oldTag is a parent namespace, child tags (oldTag/...) are renamed under newTag.
 * Deduplicates case-insensitively and preserves other tags untouched.
 */
export function renameTagInList(
  tags: readonly string[],
  oldTag: string,
  newTag: string
): string[] {
  const normOld = normalizeTag(oldTag);
  const normNew = normalizeTag(newTag);
  const cleanNew = cleanTag(newTag);

  const result: string[] = [];
  const seenNormalized = new Set<string>();

  for (const tag of tags) {
    const norm = normalizeTag(tag);

    if (norm === normOld) {
      // Direct match
      if (!seenNormalized.has(normNew)) {
        seenNormalized.add(normNew);
        result.push(cleanNew);
      }
    } else if (norm.startsWith(`${normOld}/`)) {
      // Child namespace match
      const subPath = tag.slice(oldTag.length + 1);
      const replaced = `${cleanNew}/${subPath}`;
      const replacedNorm = normalizeTag(replaced);
      if (!seenNormalized.has(replacedNorm)) {
        seenNormalized.add(replacedNorm);
        result.push(replaced);
      }
    } else {
      // Unrelated tag
      if (!seenNormalized.has(norm)) {
        seenNormalized.add(norm);
        result.push(tag);
      }
    }
  }

  return result;
}
