import { blockSplitter, type MarkdownBlock } from '../../shared/markdown/blocks';

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
      // Frontmatter is preserved in raw format and rendered in metadata header,
      // not as an editable rich text block inside document flow
      continue;
    }

    if (block.type === 'heading') {
      const match = block.raw.match(/^([ ]{0,3}#{1,6})[ \t]+(.*)$/m);
      const level = match?.[1]?.trim().length ?? 1;
      const text = match?.[2]?.trim() ?? block.raw.trim();
      content.push({
        type: 'heading',
        attrs: { level },
        content: text ? [{ type: 'text', text }] : []
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
      const quoteText = block.raw
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ ]{0,3}>[ \t]?/, ''))
        .join('\n')
        .trim();

      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: quoteText ? [{ type: 'text', text: quoteText }] : []
          }
        ]
      });
      continue;
    }

    if (block.type === 'list') {
      const lines = block.raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const isTask = lines.some((l) => /^[ ]{0,3}-[ \t]+\[[ xX/]\]/.test(l));

      if (isTask) {
        const taskItems: TipTapNodeJSON[] = [];
        for (const line of lines) {
          const match = line.match(/^[ ]{0,3}-[ \t]+\[([ xX/])\][ \t]*(.*)$/);
          if (match) {
            const checked = match[1] === 'x' || match[1] === 'X';
            const itemText = match[2]?.trim() ?? '';
            taskItems.push({
              type: 'taskItem',
              attrs: { checked },
              content: [
                {
                  type: 'paragraph',
                  content: itemText ? [{ type: 'text', text: itemText }] : []
                }
              ]
            });
          }
        }
        content.push({
          type: 'taskList',
          content: taskItems
        });
        continue;
      }

      // Standard bullet list
      const listItems: TipTapNodeJSON[] = [];
      for (const line of lines) {
        const itemText = line.replace(/^[ ]{0,3}(?:[-*+]|\d+[.)])[ \t]+/, '').trim();
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: itemText ? [{ type: 'text', text: itemText }] : []
            }
          ]
        });
      }
      content.push({
        type: 'bulletList',
        content: listItems
      });
      continue;
    }

    // Paragraph or generic text block
    const paraText = block.raw.trim();
    content.push({
      type: 'paragraph',
      content: paraText ? [{ type: 'text', text: paraText }] : []
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
      const text = getNodeText(node);
      blocks.push(`${'#'.repeat(level)} ${text}`);
      continue;
    }

    if (node.type === 'paragraph') {
      const text = getNodeText(node);
      blocks.push(text);
      continue;
    }

    if (node.type === 'codeBlock') {
      const lang = (node.attrs?.['language'] as string) || '';
      const text = getNodeText(node);
      blocks.push(`\`\`\`${lang}\n${text}\n\`\`\``);
      continue;
    }

    if (node.type === 'horizontalRule') {
      blocks.push('---');
      continue;
    }

    if (node.type === 'blockquote') {
      const text = getNodeText(node);
      const quoted = text
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      blocks.push(quoted);
      continue;
    }

    if (node.type === 'taskList') {
      const items: string[] = [];
      for (const item of node.content ?? []) {
        const checked = Boolean(item.attrs?.['checked']);
        const mark = checked ? 'x' : ' ';
        const text = getNodeText(item);
        items.push(`- [${mark}] ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    if (node.type === 'bulletList') {
      const items: string[] = [];
      for (const item of node.content ?? []) {
        const text = getNodeText(item);
        items.push(`- ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    if (node.type === 'orderedList') {
      const items: string[] = [];
      let idx = (node.attrs?.['start'] as number) || 1;
      for (const item of node.content ?? []) {
        const text = getNodeText(item);
        items.push(`${idx++}. ${text}`);
      }
      blocks.push(items.join('\n'));
      continue;
    }

    // Fallback text
    const text = getNodeText(node);
    if (text) {
      blocks.push(text);
    }
  }

  return blocks.join('\n\n') + '\n';
}

function getNodeText(node: TipTapNodeJSON): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(getNodeText).join('');
}
