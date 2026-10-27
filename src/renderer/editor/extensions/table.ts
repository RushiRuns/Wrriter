import { Node, mergeAttributes } from '@tiptap/core';

function goToNextTableCell(direction: 1 | -1) {
  return ({ state, dispatch }: any) => {
    const { selection } = state;
    const { $from } = selection;
    let tableDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tableDepth = d;
        break;
      }
    }
    if (tableDepth === -1) return false;

    const tablePos = $from.start(tableDepth);
    const tableNode = $from.node(tableDepth);
    const cellPositions: number[] = [];

    tableNode.descendants((node: any, pos: number) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cellPositions.push(tablePos + pos + 1);
      }
    });

    const currentCellIdx = cellPositions.findIndex((pos, i) => {
      const nextPos = cellPositions[i + 1] ?? (tablePos + tableNode.nodeSize);
      return $from.pos >= pos && $from.pos < nextPos;
    });

    if (currentCellIdx === -1) return false;

    const targetIdx = currentCellIdx + direction;
    if (targetIdx >= 0 && targetIdx < cellPositions.length) {
      if (dispatch) {
        const nextPos = cellPositions[targetIdx]!;
        const tr = state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(nextPos)));
        dispatch(tr);
      }
      return true;
    }

    // If at last cell and pressing Tab, append a new row
    if (targetIdx >= cellPositions.length && direction === 1) {
      if (dispatch) {
        const tr = state.tr;
        const schema = state.schema;
        const lastRow = tableNode.lastChild;
        const cols = lastRow ? lastRow.childCount : 3;
        const pNode = schema.nodes['paragraph']!;
        const cells = Array.from({ length: cols }, () =>
          schema.nodes['tableCell']!.create(null, pNode.create())
        );
        const newRow = schema.nodes['tableRow']!.create(null, cells);
        const insertPos = tablePos + tableNode.nodeSize - 2;
        tr.insert(insertPos, newRow);
        tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 2)));
        dispatch(tr);
      }
      return true;
    }

    return false;
  };
}

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
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.command(goToNextTableCell(1)),
      'Shift-Tab': () => this.editor.commands.command(goToNextTableCell(-1))
    };
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
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.command(goToNextTableCell(1)),
      'Shift-Tab': () => this.editor.commands.command(goToNextTableCell(-1))
    };
  }
});
