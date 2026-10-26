import { Node, mergeAttributes } from '@tiptap/core';

export const TableNode = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'table'
      },
      {
        tag: 'div.tw',
        getAttrs: (node) => {
          if (typeof node === 'string') return null;
          const table = (node as HTMLElement).querySelector('table');
          return table ? {} : false;
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'tw' },
      ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]]
    ];
  }
});

export const TableRowNode = Node.create({
  name: 'tableRow',
  content: '(tableHeader | tableCell)+',

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  }
});

export const TableHeaderNode = Node.create({
  name: 'tableHeader',
  content: 'paragraph block*',
  isolating: true,

  addAttributes() {
    return {
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('align') || (element.classList.contains('r') ? 'right' : null),
        renderHTML: (attributes) => {
          if (!attributes['align']) return {};
          return {
            align: attributes['align'],
            class: attributes['align'] === 'right' ? 'r' : undefined
          };
        }
      }
    };
  },

  parseHTML() {
    return [{ tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0];
  }
});

export const TableCellNode = Node.create({
  name: 'tableCell',
  content: 'paragraph block*',
  isolating: true,

  addAttributes() {
    return {
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('align') || (element.classList.contains('r') ? 'right' : null),
        renderHTML: (attributes) => {
          if (!attributes['align']) return {};
          return {
            align: attributes['align'],
            class: attributes['align'] === 'right' ? 'r' : undefined
          };
        }
      }
    };
  },

  parseHTML() {
    return [{ tag: 'td' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  }
});
