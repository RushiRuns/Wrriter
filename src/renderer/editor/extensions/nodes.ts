import { Node, mergeAttributes } from '@tiptap/core';

export const DocNode = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
});

export const ParagraphNode = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'p' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0];
  }
});

export const TextNode = Node.create({
  name: 'text',
  group: 'inline'
});

export const HeadingNode = Node.create({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false
      }
    };
  },
  parseHTML() {
    return [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = (node.attrs['level'] as number) || 1;
    return [`h${level}`, mergeAttributes(HTMLAttributes), 0];
  }
});

export const CodeBlockNode = Node.create({
  name: 'codeBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  addAttributes() {
    return {
      language: {
        default: null
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (node) => {
          if (typeof node === 'string') return null;
          const codeEl = (node as HTMLElement).querySelector('code');
          const className = codeEl?.getAttribute('class') ?? '';
          const match = className.match(/language-(\w+)/);
          return { language: match?.[1] ?? null };
        }
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const lang = node.attrs['language'] as string | null;
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { class: 'code-block' }),
      ['code', { class: lang ? `language-${lang}` : undefined }, 0]
    ];
  }
});

export const BlockquoteNode = Node.create({
  name: 'blockquote',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'blockquote' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes), 0];
  }
});

export const BulletListNode = Node.create({
  name: 'bulletList',
  group: 'block',
  content: 'listItem+',
  parseHTML() {
    return [{ tag: 'ul' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes), 0];
  }
});

export const OrderedListNode = Node.create({
  name: 'orderedList',
  group: 'block',
  content: 'listItem+',
  addAttributes() {
    return {
      start: {
        default: 1
      }
    };
  },
  parseHTML() {
    return [{ tag: 'ol' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['ol', mergeAttributes(HTMLAttributes, { start: node.attrs['start'] }), 0];
  }
});

export const ListItemNode = Node.create({
  name: 'listItem',
  content: 'paragraph block*',
  defining: true,
  parseHTML() {
    return [{ tag: 'li' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(HTMLAttributes), 0];
  }
});

export const TaskListNode = Node.create({
  name: 'taskList',
  group: 'block',
  content: 'taskItem+',
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'taskList', class: 'task-list' }), 0];
  }
});

export const TaskItemNode = Node.create({
  name: 'taskItem',
  content: 'paragraph block*',
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false
      },
      stateChar: {
        default: ' '
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'li[data-type="taskItem"]',
        getAttrs: (el) => {
          if (typeof el === 'string') return null;
          const checkbox = (el as HTMLElement).querySelector('input[type="checkbox"]');
          return {
            checked: checkbox ? (checkbox as HTMLInputElement).checked : false
          };
        }
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const isChecked = Boolean(node.attrs['checked']);
    return [
      'li',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'taskItem',
        class: `task-item ${isChecked ? 'done' : ''}`
      }),
      ['input', { type: 'checkbox', checked: isChecked ? 'checked' : undefined, disabled: 'disabled' }],
      ['div', { class: 'task-content' }, 0]
    ];
  }
});

export const HorizontalRuleNode = Node.create({
  name: 'horizontalRule',
  group: 'block',
  parseHTML() {
    return [{ tag: 'hr' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { class: 'thematic-break' })];
  }
});
