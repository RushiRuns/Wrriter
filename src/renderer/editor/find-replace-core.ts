import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { findPassThroughSpans } from '../../shared/markdown/pass-through';

export interface FindOptions {
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
}

export interface FindMatch {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly isProtected: boolean;
}

export interface FindResult {
  readonly matches: readonly FindMatch[];
  readonly totalMatches: number;
  readonly skippedMatches: number;
}

export interface ReplaceAllResult {
  readonly replacedCount: number;
  readonly skippedCount: number;
  readonly changed: boolean;
}

/**
 * Escapes regex special characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Additional protected patterns: wikilinks, script/style blocks, raw HTML tags, math blocks/inlines
const WIKILINK_REGEX = /\[\[[\s\S]*?\]\]/g;
const SCRIPT_TAG_REGEX = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_TAG_REGEX = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const HTML_TAG_REGEX = /<[a-zA-Z/][^>]*>/g;
const MATH_BLOCK_REGEX = /\$\$[\s\S]*?\$\$|\$[^\$\n\r]+\$/g;

export interface ProtectedSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * Collects all protected spans (wikilinks and pass-through syntax) in a block text.
 */
export function getProtectedSpansInText(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];

  // 1. Pass-through spans from SCHEMA.md
  const passThroughs = findPassThroughSpans(text);
  for (const pt of passThroughs) {
    spans.push({ start: pt.start, end: pt.end });
  }

  // 2. Wikilinks [[...]]
  WIKILINK_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_REGEX.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }

  // 3. Script and style full blocks
  SCRIPT_TAG_REGEX.lastIndex = 0;
  while ((m = SCRIPT_TAG_REGEX.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  STYLE_TAG_REGEX.lastIndex = 0;
  while ((m = STYLE_TAG_REGEX.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }

  // 4. Raw HTML tags <...>
  HTML_TAG_REGEX.lastIndex = 0;
  while ((m = HTML_TAG_REGEX.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }

  // 5. Math blocks / inlines $$...$$ or $...$
  MATH_BLOCK_REGEX.lastIndex = 0;
  while ((m = MATH_BLOCK_REGEX.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }

  return spans;
}

/**
 * Checks whether range [start, end] intersects any protected span.
 */
export function isRangeProtected(spans: readonly ProtectedSpan[], start: number, end: number): boolean {
  for (const span of spans) {
    if (start < span.end && end > span.start) {
      return true;
    }
  }
  return false;
}

/**
 * Finds all occurrences of searchTerm in a ProseMirror document.
 * Matches text as shown, searches code blocks, ignores properties,
 * and identifies protected wikilinks and pass-through spans.
 */
export function findMatchesInDoc(
  doc: PMNode,
  searchTerm: string,
  options: FindOptions
): FindResult {
  if (!searchTerm) {
    return { matches: [], totalMatches: 0, skippedMatches: 0 };
  }

  const matches: FindMatch[] = [];
  let skippedMatches = 0;

  let regexSource = escapeRegex(searchTerm);
  if (options.wholeWord) {
    regexSource = `\\b${regexSource}\\b`;
  }
  const regexFlags = options.matchCase ? 'g' : 'gi';

  let regex: RegExp;
  try {
    regex = new RegExp(regexSource, regexFlags);
  } catch {
    return { matches: [], totalMatches: 0, skippedMatches: 0 };
  }

  // Traverse block textblocks to accurately compute protected spans relative to the block
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    const blockText = node.textContent;
    if (!blockText) return true;

    const protectedSpans = getProtectedSpansInText(blockText);

    // Scan each text child within this textblock
    let currentOffsetInBlock = 0;
    node.forEach((child, _offset, _index) => {
      if (!child.isText || !child.text) {
        currentOffsetInBlock += child.nodeSize;
        return;
      }

      const text = child.text;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const matchLen = match[0].length;
        if (matchLen === 0) {
          regex.lastIndex++;
          continue;
        }

        const matchStartInChild = match.index;
        const matchEndInChild = match.index + matchLen;
        const matchStartInBlock = currentOffsetInBlock + matchStartInChild;
        const matchEndInBlock = currentOffsetInBlock + matchEndInChild;

        const isProtected = isRangeProtected(protectedSpans, matchStartInBlock, matchEndInBlock);
        if (isProtected) {
          skippedMatches++;
        }

        // pos + 1 accounts for entering the block node
        const absoluteFrom = pos + 1 + currentOffsetInBlock + matchStartInChild;
        const absoluteTo = absoluteFrom + matchLen;

        matches.push({
          from: absoluteFrom,
          to: absoluteTo,
          text: match[0],
          isProtected
        });
      }

      currentOffsetInBlock += child.nodeSize;
    });

    return false; // Skip traversing children again since we handled node.forEach
  });

  return {
    matches,
    totalMatches: matches.length,
    skippedMatches
  };
}

/**
 * Replaces a single match in the document.
 * Takes the formatting marks of the first replaced character.
 * Refuses replacement if the match is protected.
 */
export function replaceOneMatch(
  tr: any,
  schema: Schema,
  match: FindMatch,
  replacementText: string
): boolean {
  if (match.isProtected) {
    return false;
  }

  const marks = tr.doc.resolve(match.from).marks();

  if (replacementText) {
    const newNode = schema.text(replacementText, marks);
    tr.replaceWith(match.from, match.to, newNode);
  } else {
    tr.delete(match.from, match.to);
  }

  return true;
}

/**
 * Replaces all non-protected matches in a single ProseMirror transaction.
 * Takes the formatting marks of the first replaced character for each match.
 * If all replacements result in identical text or nothing changes, returns changed: false.
 */
export function replaceAllMatches(
  tr: any,
  schema: Schema,
  matches: readonly FindMatch[],
  replacementText: string
): ReplaceAllResult {
  const eligible = matches.filter((m) => !m.isProtected);
  const skippedCount = matches.length - eligible.length;

  if (eligible.length === 0) {
    return { replacedCount: 0, skippedCount, changed: false };
  }

  // Check if anything would actually change
  const anyDiffers = eligible.some((m) => m.text !== replacementText);
  if (!anyDiffers) {
    return { replacedCount: 0, skippedCount, changed: false };
  }

  // Process in descending order of 'from' so earlier positions are unaffected
  const sorted = [...eligible].sort((a, b) => b.from - a.from);

  for (const match of sorted) {
    const marks = tr.doc.resolve(match.from).marks();
    if (replacementText) {
      const newNode = schema.text(replacementText, marks);
      tr.replaceWith(match.from, match.to, newNode);
    } else {
      tr.delete(match.from, match.to);
    }
  }

  return {
    replacedCount: eligible.length,
    skippedCount,
    changed: true
  };
}
