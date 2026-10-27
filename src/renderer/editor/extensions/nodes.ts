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
    return ['p', mergeAttributes(HTMLAttributes, { class: 'edp' }), 0];
  },
  addCommands(): any {
    return {
      setParagraph:
        () =>
        ({ commands }: any) => {
          return commands.setNode(this.name);
        }
    };
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
    return [`h${level}`, mergeAttributes(HTMLAttributes, { class: `ed${level}` }), 0];
  },
  addCommands(): any {
    return {
      setHeading:
        (attributes: { level: number }) =>
        ({ commands }: any) => {
          return commands.setNode(this.name, attributes);
        },
      toggleHeading:
        (attributes: { level: number }) =>
        ({ commands }: any) => {
          return commands.toggleNode(this.name, 'paragraph', attributes);
        }
    };
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
        tag: 'div.codeb',
        preserveWhitespace: 'full',
        getAttrs: (node) => {
          if (typeof node === 'string') return null;
          const el = node as HTMLElement;
          const lang = el.getAttribute('data-language');
          return { language: lang || null };
        }
      },
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
    const lang = (node.attrs['language'] as string | null) || '';
    const isDataview = lang.toLowerCase() === 'dataview' || lang.toLowerCase() === 'dataviewjs';
    const displayLang = lang ? lang.toUpperCase() : 'TEXT';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'codeb',
        'data-language': lang || undefined
      }),
      [
        'div',
        { class: 'ctop', contenteditable: 'false' },
        ['span', { class: 'clang' }, displayLang],
        isDataview ? ['span', { class: 'pill' }, 'Not run'] : ['span', { class: 'pill' }, 'Copy']
      ],
      ['pre', { class: 'cbody mono' }, ['code', { class: lang ? `language-${lang}` : undefined }, 0]]
    ];
  },
  addCommands(): any {
    return {
      setCodeBlock:
        (attributes?: { language?: string | null }) =>
        ({ commands }: any) => {
          return commands.setNode(this.name, attributes);
        },
      toggleCodeBlock:
        (attributes?: { language?: string | null }) =>
        ({ commands }: any) => {
          return commands.toggleNode(this.name, 'paragraph', attributes);
        }
    };
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
    return ['blockquote', mergeAttributes(HTMLAttributes, { class: 'bq' }), 0];
  },
  addCommands(): any {
    return {
      setBlockquote:
        () =>
        ({ commands }: any) => {
          return commands.wrapIn(this.name);
        },
      toggleBlockquote:
        () =>
        ({ commands }: any) => {
          return commands.toggleWrap(this.name);
        },
      unsetBlockquote:
        () =>
        ({ commands }: any) => {
          return commands.lift(this.name);
        }
    };
  }
});

export const BulletListNode = Node.create({
  name: 'bulletList',
  group: 'block',
  content: 'listItem+',
  parseHTML() {
    return [{ tag: 'ul:not([data-type="taskList"])' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { class: 'bullet-list' }), 0];
  },
  addCommands(): any {
    return {
      toggleBulletList:
        () =>
        ({ commands }: any) => {
          return commands.toggleList(this.name, 'listItem');
        }
    };
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
    return ['ol', mergeAttributes(HTMLAttributes, { start: node.attrs['start'], class: 'ordered-list' }), 0];
  },
  addCommands(): any {
    return {
      toggleOrderedList:
        () =>
        ({ commands }: any) => {
          return commands.toggleList(this.name, 'listItem');
        }
    };
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
    return ['li', mergeAttributes(HTMLAttributes, { class: 'li' }), 0];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name)
    };
  }
});

export const TaskListNode = Node.create({
  name: 'taskList',
  group: 'block',
  content: 'taskItem+',
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]' }, { tag: 'div.tasks' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'taskList', class: 'tasks task-list' }), 0];
  },
  addCommands(): any {
    return {
      toggleTaskList:
        () =>
        ({ commands }: any) => {
          return commands.toggleList(this.name, 'taskItem');
        }
    };
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
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name, { checked: false }),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name)
    };
  },
  parseHTML() {
    return [
      {
        tag: 'li[data-type="taskItem"]',
        getAttrs: (el) => {
          if (typeof el === 'string') return null;
          const checkbox = (el as HTMLElement).querySelector('input[type="checkbox"]');
          const isDone = (el as HTMLElement).classList.contains('done');
          return {
            checked: checkbox ? (checkbox as HTMLInputElement).checked : isDone
          };
        }
      },
      {
        tag: 'div.task',
        getAttrs: (el) => {
          if (typeof el === 'string') return null;
          const chk = (el as HTMLElement).querySelector('.chk');
          const isDone = chk?.classList.contains('on');
          return {
            checked: Boolean(isDone)
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
        class: `task ${isChecked ? 'done' : ''}`
      }),
      [
        'button',
        {
          type: 'button',
          class: `chk ${isChecked ? 'on' : ''}`,
          'aria-checked': isChecked ? 'true' : 'false',
          contenteditable: 'false',
          'data-task-toggle': 'true'
        },
        [
          'svg',
          {
            class: 'chk-tick-svg',
            viewBox: '0 0 24 24',
            'aria-hidden': 'true'
          },
          ['polyline', { points: '20 6 9 17 4 12' }]
        ]
      ],
      ['div', { class: 'task-content' }, 0]
    ];
  }
});

export const HorizontalRuleNode = Node.create({
  name: 'horizontalRule',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'hr' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { class: 'hr thematic-break' })];
  },
  addCommands(): any {
    return {
      setHorizontalRule:
        () =>
        ({ chain }: any) => {
          return chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run();
        }
    };
  }
});
