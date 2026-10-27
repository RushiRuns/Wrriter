import type { Editor } from '@tiptap/core';

export interface SlashMenuItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly group: 'Text' | 'Lists' | 'Blocks' | 'Media';
  readonly shortcut: string;
  readonly keywords: readonly string[];
  readonly iconName: string;
  readonly paletteCommand: string;
  readonly action: (editor: Editor) => void;
}

export const SLASH_MENU_ITEMS: readonly SlashMenuItem[] = [
  // Group 1: Text
  {
    id: 'heading',
    title: 'Heading',
    description: 'Large section heading',
    group: 'Text',
    shortcut: '#',
    keywords: ['heading', 'h1', 'title', 'header', 'large', '#'],
    iconName: 'SlashHeadingIcon',
    paletteCommand: 'wrriter:insert-heading',
    action: (editor) => {
      (editor.chain().focus() as any).setHeading({ level: 1 }).run();
    }
  },
  {
    id: 'subheading',
    title: 'Subheading',
    description: 'Medium section heading',
    group: 'Text',
    shortcut: '##',
    keywords: ['subheading', 'h2', 'h3', 'subtitle', 'medium', 'header', '##'],
    iconName: 'SlashSubheadingIcon',
    paletteCommand: 'wrriter:insert-subheading',
    action: (editor) => {
      (editor.chain().focus() as any).setHeading({ level: 2 }).run();
    }
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Indented quote block',
    group: 'Text',
    shortcut: '>',
    keywords: ['quote', 'blockquote', 'pullquote', 'citation', '>'],
    iconName: 'SlashQuoteIcon',
    paletteCommand: 'wrriter:insert-quote',
    action: (editor) => {
      (editor.chain().focus() as any).toggleBlockquote().run();
    }
  },

  // Group 2: Lists
  {
    id: 'bullet-list',
    title: 'Bullet list',
    description: 'Simple bulleted list',
    group: 'Lists',
    shortcut: '-',
    keywords: ['bullet list', 'bullet', 'unordered', 'list', 'points', '-'],
    iconName: 'BulletListIcon',
    paletteCommand: 'wrriter:insert-bullet-list',
    action: (editor) => {
      (editor.chain().focus() as any).toggleBulletList().run();
    }
  },
  {
    id: 'numbered-list',
    title: 'Numbered list',
    description: 'Numbered sequence list',
    group: 'Lists',
    shortcut: '1.',
    keywords: ['numbered list', 'number', 'ordered', 'sequence', '1.'],
    iconName: 'SlashNumberedListIcon',
    paletteCommand: 'wrriter:insert-numbered-list',
    action: (editor) => {
      (editor.chain().focus() as any).toggleOrderedList().run();
    }
  },
  {
    id: 'task-list',
    title: 'Task list',
    description: 'To-do list with checkboxes',
    group: 'Lists',
    shortcut: '[]',
    keywords: ['task list', 'task', 'todo', 'to-do', 'check', 'checkbox', 'done', '[]'],
    iconName: 'SlashTaskListIcon',
    paletteCommand: 'wrriter:insert-task-list',
    action: (editor) => {
      (editor.chain().focus() as any).toggleTaskList().run();
    }
  },

  // Group 3: Blocks
  {
    id: 'table',
    title: 'Table',
    description: 'Table with columns and rows',
    group: 'Blocks',
    shortcut: '',
    keywords: ['table', 'grid', 'columns', 'rows', 'tabular', 'data'],
    iconName: 'SlashTableIcon',
    paletteCommand: 'wrriter:insert-table',
    action: (editor) => {
      // Create 3x3 table with headers
      const schema = editor.schema;
      if (!schema.nodes['table'] || !schema.nodes['tableRow'] || !schema.nodes['tableHeader'] || !schema.nodes['tableCell'] || !schema.nodes['paragraph']) {
        return;
      }
      const pNode = schema.nodes['paragraph'];
      const headerRow = schema.nodes['tableRow'].create(null, [
        schema.nodes['tableHeader'].create(null, pNode.create(null, schema.text('Column 1'))),
        schema.nodes['tableHeader'].create(null, pNode.create(null, schema.text('Column 2'))),
        schema.nodes['tableHeader'].create(null, pNode.create(null, schema.text('Column 3')))
      ]);
      const dataRow1 = schema.nodes['tableRow'].create(null, [
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Item 1'))),
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Description'))),
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Value')))
      ]);
      const dataRow2 = schema.nodes['tableRow'].create(null, [
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Item 2'))),
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Description'))),
        schema.nodes['tableCell'].create(null, pNode.create(null, schema.text('Value')))
      ]);
      const tableNode = schema.nodes['table'].create(null, [headerRow, dataRow1, dataRow2]);
      editor.chain().focus().insertContent([tableNode.toJSON(), { type: 'paragraph' }]).run();
    }
  },
  {
    id: 'code-block',
    title: 'Code block',
    description: 'Code with syntax highlighting',
    group: 'Blocks',
    shortcut: '```',
    keywords: ['code block', 'code', 'snippet', 'syntax', 'programming', 'script', '```'],
    iconName: 'SlashCodeIcon',
    paletteCommand: 'wrriter:insert-code-block',
    action: (editor) => {
      (editor.chain().focus() as any).toggleCodeBlock().run();
    }
  },
  {
    id: 'callout',
    title: 'Callout',
    description: 'Highlighted information callout',
    group: 'Blocks',
    shortcut: '',
    keywords: ['callout', 'info', 'note', 'box', 'highlight', 'callout:info'],
    iconName: 'SlashCalloutIcon',
    paletteCommand: 'wrriter:insert-callout',
    action: (editor) => {
      const schema = editor.schema;
      if (schema.nodes['callout']) {
        editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { type: 'info', title: 'Info' },
          content: [{ type: 'paragraph' }]
        }).run();
      }
    }
  },
  {
    id: 'warning',
    title: 'Warning',
    description: 'Warning callout block',
    group: 'Blocks',
    shortcut: '',
    keywords: ['warning', 'warn', 'danger', 'alert', 'caution', 'callout:warn'],
    iconName: 'CalloutWarnIcon',
    paletteCommand: 'wrriter:insert-warning',
    action: (editor) => {
      const schema = editor.schema;
      if (schema.nodes['callout']) {
        editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { type: 'warn', title: 'Warning' },
          content: [{ type: 'paragraph' }]
        }).run();
      }
    }
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Five-dot horizontal separator',
    group: 'Blocks',
    shortcut: '---',
    keywords: ['divider', 'horizontal rule', 'hr', 'line', 'separator', 'rule', '---'],
    iconName: 'SlashDividerIcon',
    paletteCommand: 'wrriter:insert-divider',
    action: (editor) => {
      (editor.chain().focus() as any).setHorizontalRule().run();
    }
  },

  // Group 4: Media
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or insert image',
    group: 'Media',
    shortcut: '',
    keywords: ['image', 'picture', 'photo', 'img', 'media', 'upload'],
    iconName: 'SlashImageIcon',
    paletteCommand: 'wrriter:insert-image',
    action: (editor) => {
      if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              if (dataUrl) {
                editor.chain().focus().insertContent([
                  { type: 'image', attrs: { src: dataUrl, alt: file.name } },
                  { type: 'paragraph' }
                ]).run();
              }
            };
            reader.readAsDataURL(file);
          }
          input.remove();
        };
        document.body.appendChild(input);
        input.click();
      } else {
        editor.chain().focus().insertContent([
          { type: 'image', attrs: { src: 'attachments/image.png' } },
          { type: 'paragraph' }
        ]).run();
      }
    }
  }
];

export interface FilterResult {
  readonly items: readonly SlashMenuItem[];
  readonly activeGroups: readonly ('Text' | 'Lists' | 'Blocks' | 'Media')[];
  readonly hasMatches: boolean;
}

/**
 * Pure search/filtering function for the slash menu.
 * Matches by name and related words.
 * Hides groups that have 0 matches.
 */
export function filterSlashItems(
  items: readonly SlashMenuItem[],
  query: string
): FilterResult {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    const groups: ('Text' | 'Lists' | 'Blocks' | 'Media')[] = ['Text', 'Lists', 'Blocks', 'Media'];
    return {
      items,
      activeGroups: groups,
      hasMatches: true
    };
  }

  const matched = items.filter((item) => {
    if (item.title.toLowerCase().includes(cleanQuery)) return true;
    if (item.shortcut.toLowerCase() === cleanQuery) return true;
    return item.keywords.some((k) => k.toLowerCase().includes(cleanQuery));
  });

  const activeGroups = Array.from(new Set(matched.map((i) => i.group)));

  return {
    items: matched,
    activeGroups,
    hasMatches: matched.length > 0
  };
}
