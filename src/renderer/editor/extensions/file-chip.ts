import { Node, mergeAttributes } from '@tiptap/core';

export const FileChipNode = Node.create({
  name: 'fileChip',
  group: 'block',
  selectable: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return {
      name: {
        default: 'Attachment'
      },
      path: {
        default: ''
      },
      size: {
        default: ''
      },
      fileType: {
        default: 'FILE'
      },
      missing: {
        default: false
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.fchip',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          const name = el.querySelector('.fname')?.textContent || 'Attachment';
          const size = el.querySelector('.fsize')?.textContent || '';
          const fileType = el.querySelector('.ftype')?.textContent || 'FILE';
          const missing = el.classList.contains('miss');
          const path = el.getAttribute('data-path') || '';
          return { name, path, size, fileType, missing };
        }
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = (node.attrs['name'] as string) || 'Attachment';
    const path = (node.attrs['path'] as string) || '';
    const size = (node.attrs['size'] as string) || '';
    const fileType = ((node.attrs['fileType'] as string) || 'FILE').toUpperCase();
    const missing = Boolean(node.attrs['missing']);

    const typeColor =
      fileType === 'PDF'
        ? 'var(--hc)'
        : fileType === 'XLS' || fileType === 'SHEET' || fileType === 'CSV'
        ? 'var(--vault-w)'
        : 'var(--vault-p)';

    if (missing) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          class: 'fchip miss',
          'data-path': path,
          contenteditable: 'false'
        }),
        ['span', { class: 'fname' }, `File not found: ${name}`]
      ];
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'fchip',
        'data-path': path,
        contenteditable: 'false'
      }),
      ['div', { class: 'ftype', style: `--fc: ${typeColor};` }, fileType],
      [
        'div',
        { class: 'fmeta' },
        ['span', { class: 'fname' }, name],
        size ? ['span', { class: 'fsize' }, size] : ['span', { class: 'fsize' }, 'Attachment']
      ]
    ];
  }
});
