import { blockSplitter, type MarkdownBlock } from '../../shared/markdown/blocks';
import { parseFrontmatter } from '../../shared/domain/frontmatter';
import { parseWikilinkContent, formatWikilink } from '../../shared/domain/wikilinks';
import { isInlineImageExtension, getFileExtension, getFileTypeBadge } from '../../shared/domain/attachments';

export interface TipTapNodeJSON {
  type: string;
  attrs?: Record<string, unknown> | undefined;
  content?: TipTapNodeJSON[] | undefined;
  text?: string | undefined;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }> | undefined;
}

export interface TipTapDocJSON {
  type: 'doc';
  content: TipTapNodeJSON[];
}

/**
 * Parses inline markdown tokens (bold, italic, strike, code, wikilinks, web links) into TipTap inline text nodes.
 */
export function parseInlineMarkdown(text: string): TipTapNodeJSON[] {
  if (!text) return [];

  // Regex matching inline formatting tokens
  // 1: Wikilink [[target|alias]]
  // 2: Link [text](url) (web url or vault markdown note)
  // 3: Code `code`
  // 4: Bold **text**
  // 5: Strike ~~text~~
  // 6: Italic *text*
  const TOKEN_REGEX = /(\[\[([^\]\n]+)\]\])|(\[([^\]]+)\]\(([^\s\)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(\*([^*]+)\*)/g;

  const result: TipTapNodeJSON[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        text: text.slice(lastIndex, match.index)
      });
    }

    if (match[1]) {
      // Wikilink [[inner]]
      const inner = match[2] ?? '';
      const parsed = parseWikilinkContent(inner, match[1]);
      if (!parsed) {
        // Unknown form (e.g. [[Note#^id]]) or empty: keep as plain text byte for byte
        result.push({
          type: 'text',
          text: match[1]
        });
      } else {
        result.push({
          type: 'text',
          text: parsed.displayText,
          marks: [
            {
              type: 'wikilink',
              attrs: {
                target: parsed.target,
                alias: parsed.alias ?? '',
                heading: parsed.heading ?? ''
              }
            }
          ]
        });
      }
    } else if (match[3]) {
      // Link [text](url)
      const linkText = match[4] ?? '';
      const href = match[5] ?? '';
      result.push({
        type: 'text',
        text: linkText,
        marks: [{ type: 'webLink', attrs: { href, title: linkText } }]
      });
    } else if (match[6]) {
      // Code `code`
      result.push({
        type: 'text',
        text: match[7] ?? '',
        marks: [{ type: 'code' }]
      });
    } else if (match[8]) {
      // Bold **text**
      result.push({
        type: 'text',
        text: match[9] ?? '',
        marks: [{ type: 'bold' }]
      });
    } else if (match[10]) {
      // Strike ~~text~~
      result.push({
        type: 'text',
        text: match[11] ?? '',
        marks: [{ type: 'strike' }]
      });
    } else if (match[12]) {
      // Italic *text*
      result.push({
        type: 'text',
        text: match[13] ?? '',
        marks: [{ type: 'italic' }]
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      text: text.slice(lastIndex)
    });
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/**
 * Serializes inline text nodes with marks back to standard markdown.
 */
export function serializeInlineNodes(nodes: TipTapNodeJSON[] | undefined): string {
  if (!nodes || nodes.length === 0) return '';

  return nodes
    .map((node) => {
      let t = node.text || '';
      if (!t && node.content) {
        t = serializeInlineNodes(node.content);
      }
      if (!node.marks || node.marks.length === 0) return t;

      for (const mark of node.marks) {
        if (mark.type === 'bold') {
          t = `**${t}**`;
        } else if (mark.type === 'italic') {
          t = `*${t}*`;
        } else if (mark.type === 'strike') {
          t = `~~${t}~~`;
        } else if (mark.type === 'code') {
          t = `\`${t}\``;
        } else if (mark.type === 'wikilink') {
          const target = (mark.attrs?.['target'] as string) || t;
          const heading = (mark.attrs?.['heading'] as string) || '';
          const alias = (mark.attrs?.['alias'] as string) || '';
          const defaultText = heading ? `${target} > ${heading}` : (target.includes('/') ? target.slice(target.lastIndexOf('/') + 1) : target);
          t = formatWikilink(target, {
            heading: heading || undefined,
            alias: alias || (t !== defaultText && t !== target ? t : undefined)
          });
        } else if (mark.type === 'webLink') {
          const href = (mark.attrs?.['href'] as string) || '';
          t = `[${t}](${href})`;
        }
      }
      return t;
    })
    .join('');
}

/**
 * Converts a markdown string into TipTap document JSON.
 */
export function markdownToTipTapDoc(source: string): TipTapDocJSON {
  const blocks = blockSplitter(source);
  const content: TipTapNodeJSON[] = [];

  for (const block of blocks) {
    if (block.type === 'blank_lines') {
      continue;
    }

    if (block.type === 'frontmatter') {
      const fm = parseFrontmatter(source);
      if (fm.isBroken) {
        // Broken frontmatter: shown as text in the editor
        const lines = block.raw.split(/\r?\n/).filter((l) => l.length > 0);
        for (const line of lines) {
          content.push({
            type: 'paragraph',
            content: parseInlineMarkdown(line)
          });
        }
      }
      // Valid frontmatter is preserved in raw format and rendered in Properties line under title
      continue;
    }

    if (block.type === 'heading') {
      const match = block.raw.match(/^([ ]{0,3}#{1,6})[ \t]+(.*)$/m);
      const level = match?.[1]?.trim().length ?? 1;
      const text = match?.[2]?.trim() ?? block.raw.trim();
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarkdown(text)
      });
      continue;
    }

    if (block.type === 'code_block') {
      const lines = block.raw.split(/\r?\n/);
      const firstLine = lines[0] ?? '```';
      const langMatch = firstLine.match(/^[ ]{0,3}(`{3,}|~{3,})(.*)$/);
      const language = langMatch?.[2]?.trim() || null;
      const codeLines = lines.slice(1, -1);
      const codeText = codeLines.join('\n');
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: codeText ? [{ type: 'text', text: codeText }] : []
      });
      continue;
    }

    if (block.type === 'thematic_break') {
      content.push({
        type: 'horizontalRule'
      });
      continue;
    }

    if (block.type === 'blockquote') {
      const rawLines = block.raw.split(/\r?\n/);
      const firstLine = rawLines[0] ?? '';

      // Check for Callout syntax: > [!type][+-]? Title
      const calloutMatch = firstLine.match(/^[ ]{0,3}>[ \t]*\[!([a-zA-Z0-9_-]+)\]([+-]?)[ \t]*(.*)$/);

      if (calloutMatch) {
        const type = calloutMatch[1]?.toLowerCase() || 'info';
        const marker = calloutMatch[2] || null;
        const title = calloutMatch[3]?.trim() || '';
        const isFolded = marker === '-';

        // Extract body lines
        const bodyLines: string[] = [];
        for (let i = 1; i < rawLines.length; i++) {
          const l = rawLines[i];
          if (l === undefined) continue;
          bodyLines.push(l.replace(/^[ ]{0,3}>[ \t]?/, ''));
        }
        const bodyText = bodyLines.join('\n').trim();

        content.push({
          type: 'callout',
          attrs: {
            type,
            title,
            marker,
            folded: isFolded
          },
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarkdown(bodyText)
            }
          ]
        });
        continue;
      }

      // Plain blockquote
      const quoteText = rawLines
        .map((l) => l.replace(/^[ ]{0,3}>[ \t]?/, ''))
        .join('\n')
        .trim();

      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarkdown(quoteText)
          }
        ]
      });
      continue;
    }

    if (block.type === 'table') {
      const tableLines = block.raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (tableLines.length >= 2) {
        const headerLine = tableLines[0] || '';
        const delimiterLine = tableLines[1] || '';
        const dataLines = tableLines.slice(2);

        // Alignments from delimiter line
        const delimiterCells = delimiterLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        const alignments = delimiterCells.map((c) => {
          if (c.startsWith(':') && c.endsWith(':')) return 'center';
          if (c.endsWith(':')) return 'right';
          if (c.startsWith(':')) return 'left';
          return null;
        });

        // Header row
        const headerCells = headerLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        const headerNodes: TipTapNodeJSON[] = headerCells.map((cellText, idx) => ({
          type: 'tableHeader',
          attrs: { align: alignments[idx] ?? null },
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarkdown(cellText)
            }
          ]
        }));

        const rowNodes: TipTapNodeJSON[] = [
          {
            type: 'tableRow',
            content: headerNodes
          }
        ];

        // Data rows
        for (const dLine of dataLines) {
          const cells = dLine
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          const cellNodes: TipTapNodeJSON[] = cells.map((cellText, idx) => ({
            type: 'tableCell',
            attrs: { align: alignments[idx] ?? null },
            content: [
              {
                type: 'paragraph',
                content: parseInlineMarkdown(cellText)
              }
            ]
          }));
          rowNodes.push({
            type: 'tableRow',
            content: cellNodes
          });
        }

        content.push({
          type: 'table',
          content: rowNodes
        });
        continue;
      }
    }

    if (block.type === 'list') {
      const lines = block.raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let currentType: 'task' | 'ordered' | 'bullet' | null = null;
      let currentItems: TipTapNodeJSON[] = [];
      let currentStart = 1;

      const flushCurrentList = () => {
        if (!currentType || currentItems.length === 0) return;
        if (currentType === 'task') {
          content.push({
            type: 'taskList',
            content: currentItems
          });
        } else if (currentType === 'ordered') {
          content.push({
            type: 'orderedList',
            attrs: { start: currentStart },
            content: currentItems
          });
        } else if (currentType === 'bullet') {
          content.push({
            type: 'bulletList',
            content: currentItems
          });
        }
        currentItems = [];
        currentType = null;
      };

      for (const line of lines) {
        const taskMatch = line.match(/^[ ]{0,3}(?:[-*+])[ \t]+\[([ xX/])\][ \t]*(.*)$/);
        if (taskMatch) {
          if (currentType !== 'task') {
            flushCurrentList();
            currentType = 'task';
          }
          const checked = taskMatch[1] === 'x' || taskMatch[1] === 'X';
          const itemText = taskMatch[2]?.trim() ?? '';
          currentItems.push({
            type: 'taskItem',
            attrs: { checked },
            content: [
              {
                type: 'paragraph',
                content: parseInlineMarkdown(itemText)
              }
            ]
          });
          continue;
        }

        const orderedMatch = line.match(/^[ ]{0,3}(\d+)[.)][ \t]+(.*)$/);
        if (orderedMatch) {
          if (currentType !== 'ordered') {
            flushCurrentList();
            currentType = 'ordered';
            currentStart = parseInt(orderedMatch[1] || '1', 10);
          }
          const itemText = orderedMatch[2]?.trim() ?? '';
          currentItems.push({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: parseInlineMarkdown(itemText)
              }
            ]
          });
          continue;
        }

        const bulletMatch = line.match(/^[ ]{0,3}(?:[-*+])[ \t]+(.*)$/);
        if (bulletMatch) {
          if (currentType !== 'bullet') {
            flushCurrentList();
            currentType = 'bullet';
          }
          const itemText = bulletMatch[1]?.trim() ?? '';
          currentItems.push({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: parseInlineMarkdown(itemText)
              }
            ]
          });
          continue;
        }

        // Continuation line for previous item
        if (currentItems.length > 0) {
          const lastItem = currentItems[currentItems.length - 1];
          const lastPara = lastItem?.content?.[0];
          if (lastPara && lastPara.content) {
            const addedNodes = parseInlineMarkdown(' ' + line.trim());
            lastPara.content.push(...addedNodes);
          }
        }
      }

      flushCurrentList();
      continue;
    }

    // Check if block is a standalone Image: ![alt|400|center](url) or ![alt](url)
    const trimmed = block.raw.trim();
    const imageMatch = trimmed.match(/^!\[([^\]|]*)(?:\|(\d+))?(?:\|(left|center|right))?\]\(([^\)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1] || '';
      const width = imageMatch[2] ? parseInt(imageMatch[2], 10) : null;
      const alignment = (imageMatch[3] as 'left' | 'center' | 'right') || 'center';
      const src = imageMatch[4] || '';

      // Non-inline format (e.g. HEIC, PDF, etc.) written with ![] -> render as fileChip
      if (!isInlineImageExtension(src) && getFileExtension(src)) {
        const name = alt || src.split('/').pop() || 'Attachment';
        content.push({
          type: 'fileChip',
          attrs: {
            name,
            path: src,
            fileType: getFileTypeBadge(name || src),
            size: '',
            missing: false
          }
        });
        continue;
      }

      content.push({
        type: 'image',
        attrs: {
          src,
          alt,
          width,
          alignment
        }
      });
      continue;
    }

    // Check if block is a standalone File Chip: [filename.ext](path)
    const fileChipMatch = trimmed.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (fileChipMatch) {
      const name = fileChipMatch[1] || 'Attachment';
      const path = fileChipMatch[2] || '';
      const hasExt = Boolean(getFileExtension(name) || getFileExtension(path));
      const isAttPath = path.includes('attachments/');

      if (hasExt || isAttPath) {
        content.push({
          type: 'fileChip',
          attrs: {
            name,
            path,
            fileType: getFileTypeBadge(name || path),
            size: '',
            missing: false
          }
        });
        continue;
      }
    }

    // Paragraph or generic text block
    content.push({
      type: 'paragraph',
      content: parseInlineMarkdown(trimmed)
    });
  }

  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: []
    });
  }

  return {
    type: 'doc',
    content
  };
}

/**
 * Converts TipTap document JSON into a serialized Markdown string.
 */
export function tipTapDocToMarkdown(doc: TipTapDocJSON): string {
  if (!doc.content || doc.content.length === 0) return '';

  const blocks: string[] = [];

  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = (node.attrs?.['level'] as number) || 1;
      const text = serializeInlineNodes(node.content);
      blocks.push(`${'#'.repeat(level)} ${text}`);
      continue;
    }

    if (node.type === 'paragraph') {
      const text = serializeInlineNodes(node.content);
      blocks.push(text);
      continue;
    }

    if (node.type === 'codeBlock') {
      const lang = (node.attrs?.['language'] as string) || '';
      const text = getNodeRawText(node);
      blocks.push(`\`\`\`${lang}\n${text}\n\`\`\``);
      continue;
    }

    if (node.type === 'horizontalRule') {
      blocks.push('---');
      continue;
    }

    if (node.type === 'blockquote') {
      const text = serializeInlineNodes(node.content);
      const quoted = text
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      blocks.push(quoted);
      continue;
    }

    if (node.type === 'callout') {
      const type = (node.attrs?.['type'] as string) || 'info';
      const marker = (node.attrs?.['marker'] as string) || (node.attrs?.['folded'] ? '-' : '');
      const title = (node.attrs?.['title'] as string) || '';
      const headerLine = `> [!${type}]${marker}${title ? ` ${title}` : ''}`;

      const bodyText = serializeInlineNodes(node.content);
      if (bodyText) {
        const bodyLines = bodyText
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        blocks.push(`${headerLine}\n${bodyLines}`);
      } else {
        blocks.push(headerLine);
      }
      continue;
    }

    if (node.type === 'table') {
      const rows = node.content ?? [];
      if (rows.length > 0) {
        const tableLines: string[] = [];
        const headerRow = rows[0];
        const headerCells = headerRow?.content ?? [];
        const headers = headerCells.map((c) => serializeInlineNodes(c.content).trim());
        tableLines.push(`| ${headers.join(' | ')} |`);

        // Delimiter line
        const delimiters = headerCells.map((c) => {
          const align = c.attrs?.['align'];
          if (align === 'center') return ':---:';
          if (align === 'right') return '---:';
          return '---';
        });
        tableLines.push(`| ${delimiters.join(' | ')} |`);

        // Data rows
        for (let r = 1; r < rows.length; r++) {
          const dCells = rows[r]?.content ?? [];
          const values = dCells.map((c) => serializeInlineNodes(c.content).trim());
          tableLines.push(`| ${values.join(' | ')} |`);
        }
        blocks.push(tableLines.join('\n'));
        continue;
      }
    }

    if (node.type === 'image') {
      const src = (node.attrs?.['src'] as string) || '';
      const alt = (node.attrs?.['alt'] as string) || '';
      const width = node.attrs?.['width'] as number | null;
      const alignment = (node.attrs?.['alignment'] as string) || 'center';

      let descriptor = alt;
      if (width) descriptor += `|${width}`;
      if (alignment && alignment !== 'center') descriptor += `|${alignment}`;
      blocks.push(`![${descriptor}](${src})`);
      continue;
    }

    if (node.type === 'fileChip') {
      const name = (node.attrs?.['name'] as string) || 'Attachment';
      const path = (node.attrs?.['path'] as string) || '';
      blocks.push(`[${name}](${path})`);
      continue;
    }

    if (node.type === 'taskList') {
      const items: string[] = [];
      for (const item of node.content ?? []) {
        const checked = Boolean(item.attrs?.['checked']);
        const mark = checked ? 'x' : ' ';
        const text = serializeInlineNodes(item.content);
        items.push(`- [${mark}] ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    if (node.type === 'bulletList') {
      const items: string[] = [];
      for (const item of node.content ?? []) {
        const text = serializeInlineNodes(item.content);
        items.push(`- ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    if (node.type === 'orderedList') {
      const items: string[] = [];
      let idx = (node.attrs?.['start'] as number) || 1;
      for (const item of node.content ?? []) {
        const text = serializeInlineNodes(item.content);
        items.push(`${idx++}. ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    // Fallback
    const text = serializeInlineNodes(node.content) || getNodeRawText(node);
    if (text) {
      blocks.push(text);
    }
  }

  return blocks.join('\n\n') + '\n';
}

function getNodeRawText(node: TipTapNodeJSON): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(getNodeRawText).join('');
}
