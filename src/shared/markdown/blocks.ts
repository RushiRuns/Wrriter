export type MarkdownBlockType =
  | 'frontmatter'
  | 'heading'
  | 'paragraph'
  | 'blockquote'
  | 'code_block'
  | 'list'
  | 'table'
  | 'thematic_break'
  | 'html_block'
  | 'math_block'
  | 'comment_block'
  | 'blank_lines';

export interface MarkdownBlock {
  readonly id: string;
  readonly type: MarkdownBlockType;
  readonly raw: string;
  readonly startLine: number;
  readonly endLine: number;
}

interface LineInfo {
  readonly text: string;
  readonly eol: string;
  readonly full: string;
  readonly lineNum: number;
}

/**
 * Splits text into lines preserving exact line endings (\r\n, \n, or none on final line).
 */
function splitIntoLines(source: string): LineInfo[] {
  if (source.length === 0) return [];

  const lines: LineInfo[] = [];
  let start = 0;
  let lineNum = 1;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\r') {
      if (i + 1 < source.length && source[i + 1] === '\n') {
        const full = source.slice(start, i + 2);
        const text = source.slice(start, i);
        lines.push({ text, eol: '\r\n', full, lineNum: lineNum++ });
        start = i + 2;
        i++;
      } else {
        const full = source.slice(start, i + 1);
        const text = source.slice(start, i);
        lines.push({ text, eol: '\r', full, lineNum: lineNum++ });
        start = i + 1;
      }
    } else if (ch === '\n') {
      const full = source.slice(start, i + 1);
      const text = source.slice(start, i);
      lines.push({ text, eol: '\n', full, lineNum: lineNum++ });
      start = i + 1;
    }
  }

  if (start < source.length) {
    const full = source.slice(start);
    lines.push({ text: full, eol: '', full, lineNum });
  }

  return lines;
}

const ATX_HEADING_REGEX = /^[ ]{0,3}#{1,6}(?:[ \t]+.*)?$/;
const FENCE_START_REGEX = /^[ ]{0,3}(`{3,}|~{3,})(.*)$/;
const THEMATIC_BREAK_REGEX = /^[ ]{0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LIST_ITEM_REGEX = /^[ ]{0,3}(?:[-*+]|\d+[.)])[ \t]+/;
const HTML_BLOCK_OPEN_REGEX = /^[ ]{0,3}<(?:div|p|script|table|pre|blockquote|form|section|article|header|footer|aside|nav)[ >]/i;

function isBlankLine(line: LineInfo): boolean {
  return /^[ \t]*$/.test(line.text);
}

/**
 * Splits markdown note content into top-level blocks with exact source slices.
 * Invariant: blocks.map(b => b.raw).join('') === source
 */
export function blockSplitter(source: string): MarkdownBlock[] {
  if (source.length === 0) return [];

  const lines = splitIntoLines(source);
  if (lines.length === 0) return [];

  const blocks: MarkdownBlock[] = [];
  let idx = 0;
  let blockCounter = 0;

  // 1. Frontmatter check (must start on line 1)
  const firstLine = lines[0];
  if (firstLine && firstLine.text === '---') {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && (line.text === '---' || line.text === '...')) {
        endIdx = i;
        break;
      }
    }
    if (endIdx !== -1) {
      const slice = lines.slice(0, endIdx + 1);
      const raw = slice.map((l) => l.full).join('');
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'frontmatter',
        raw,
        startLine: 1,
        endLine: endIdx + 1
      });
      idx = endIdx + 1;
    }
  }

  // 2. Iterate through remaining lines
  while (idx < lines.length) {
    const line = lines[idx];
    if (!line) break;

    // Blank line(s)
    if (isBlankLine(line)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      while (idx < lines.length) {
        const next = lines[idx];
        if (next && isBlankLine(next)) {
          idx++;
        } else {
          break;
        }
      }
      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'blank_lines',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // Fenced code block (``` or ~~~)
    const fenceMatch = line.text.match(FENCE_START_REGEX);
    if (fenceMatch) {
      const fenceStr = fenceMatch[1] ?? '```';
      const fenceChar = fenceStr[0];
      const fenceLen = fenceStr.length;
      const startLine = line.lineNum;
      const startIdx = idx;
      idx++;

      while (idx < lines.length) {
        const curr = lines[idx];
        if (curr) {
          const closeMatch = curr.text.match(/^[ ]{0,3}(`{3,}|~{3,})[ \t]*$/);
          if (closeMatch && closeMatch[1] && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLen) {
            idx++;
            break;
          }
        }
        idx++;
      }

      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'code_block',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // Math block ($$ ... $$)
    if (/^[ ]{0,3}\$\$/.test(line.text)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      if (line.text.slice(2).includes('$$') && line.text.trim() !== '$$') {
        // Single-line math block
        idx++;
      } else {
        idx++;
        while (idx < lines.length) {
          const curr = lines[idx];
          if (curr && /^[ ]{0,3}\$\$/.test(curr.text)) {
            idx++;
            break;
          }
          idx++;
        }
      }
      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'math_block',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // Comment block (%% ... %%)
    if (/^[ ]{0,3}%%/.test(line.text)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      if (line.text.slice(2).includes('%%') && line.text.trim() !== '%%') {
        idx++;
      } else {
        idx++;
        while (idx < lines.length) {
          const curr = lines[idx];
          if (curr && /%%/.test(curr.text)) {
            idx++;
            break;
          }
          idx++;
        }
      }
      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'comment_block',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // ATX Heading
    if (ATX_HEADING_REGEX.test(line.text)) {
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'heading',
        raw: line.full,
        startLine: line.lineNum,
        endLine: line.lineNum
      });
      idx++;
      continue;
    }

    // Thematic break (hr)
    if (THEMATIC_BREAK_REGEX.test(line.text)) {
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'thematic_break',
        raw: line.full,
        startLine: line.lineNum,
        endLine: line.lineNum
      });
      idx++;
      continue;
    }

    // Blockquote / Callout (> ...)
    if (/^[ ]{0,3}>/.test(line.text)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      idx++;
      while (idx < lines.length) {
        const curr = lines[idx];
        if (!curr) break;
        if (/^[ ]{0,3}>/.test(curr.text)) {
          idx++;
        } else if (isBlankLine(curr)) {
          // Empty line might separate quotes
          break;
        } else if (
          ATX_HEADING_REGEX.test(curr.text) ||
          FENCE_START_REGEX.test(curr.text) ||
          THEMATIC_BREAK_REGEX.test(curr.text)
        ) {
          break;
        } else {
          // Lazy continuation line
          idx++;
        }
      }
      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'blockquote',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // Table (| col | col | followed by delimiter line)
    if (/^[ ]{0,3}\|/.test(line.text) && idx + 1 < lines.length) {
      const nextLine = lines[idx + 1];
      if (nextLine && /^[ ]{0,3}\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/.test(nextLine.text)) {
        const startLine = line.lineNum;
        const startIdx = idx;
        idx += 2;
        while (idx < lines.length) {
          const curr = lines[idx];
          if (curr && /^[ ]{0,3}\|/.test(curr.text)) {
            idx++;
          } else {
            break;
          }
        }
        const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
        const endLine = lines[idx - 1]?.lineNum ?? startLine;
        blocks.push({
          id: `block-${blockCounter++}`,
          type: 'table',
          raw,
          startLine,
          endLine
        });
        continue;
      }
    }

    // List item (- , * , + , 1. , 1) , - [ ] , etc.)
    if (LIST_ITEM_REGEX.test(line.text)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      idx++;

      while (idx < lines.length) {
        const curr = lines[idx];
        if (!curr) break;

        if (LIST_ITEM_REGEX.test(curr.text)) {
          idx++;
        } else if (/^[ ]{2,}|\t/.test(curr.text)) {
          // Indented list content
          idx++;
        } else if (isBlankLine(curr)) {
          // Check if followed by an indented line or another list item
          if (idx + 1 < lines.length) {
            const lookahead = lines[idx + 1];
            if (lookahead && (LIST_ITEM_REGEX.test(lookahead.text) || /^[ ]{2,}|\t/.test(lookahead.text))) {
              idx += 2;
              continue;
            }
          }
          break;
        } else {
          break;
        }
      }

      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'list',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // HTML Block
    if (HTML_BLOCK_OPEN_REGEX.test(line.text)) {
      const startLine = line.lineNum;
      const startIdx = idx;
      idx++;
      while (idx < lines.length) {
        const curr = lines[idx];
        if (!curr || isBlankLine(curr)) break;
        idx++;
      }
      const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
      const endLine = lines[idx - 1]?.lineNum ?? startLine;
      blocks.push({
        id: `block-${blockCounter++}`,
        type: 'html_block',
        raw,
        startLine,
        endLine
      });
      continue;
    }

    // Paragraph (default)
    const startLine = line.lineNum;
    const startIdx = idx;
    idx++;

    while (idx < lines.length) {
      const curr = lines[idx];
      if (!curr) break;

      if (isBlankLine(curr)) break;

      // Check if line starts a new block
      if (
        ATX_HEADING_REGEX.test(curr.text) ||
        FENCE_START_REGEX.test(curr.text) ||
        THEMATIC_BREAK_REGEX.test(curr.text) ||
        /^[ ]{0,3}>/.test(curr.text) ||
        /^[ ]{0,3}\$\$/.test(curr.text) ||
        /^[ ]{0,3}%%/.test(curr.text) ||
        LIST_ITEM_REGEX.test(curr.text) ||
        HTML_BLOCK_OPEN_REGEX.test(curr.text)
      ) {
        break;
      }

      idx++;
    }

    const raw = lines.slice(startIdx, idx).map((l) => l.full).join('');
    const endLine = lines[idx - 1]?.lineNum ?? startLine;
    blocks.push({
      id: `block-${blockCounter++}`,
      type: 'paragraph',
      raw,
      startLine,
      endLine
    });
  }

  return blocks;
}
