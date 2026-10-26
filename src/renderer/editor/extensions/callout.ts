import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutAttributes {
  type: string;
  title: string;
  folded: boolean;
  marker: string | null;
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => {
          const typeClass = Array.from(element.classList).find(
            (c) => c !== 'co' && c !== 'shut'
          );
          return element.getAttribute('data-callout-type') || typeClass || 'info';
        },
        renderHTML: (attributes) => ({
          'data-callout-type': attributes['type']
        })
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-callout-title') || '',
        renderHTML: (attributes) => ({
          'data-callout-title': attributes['title']
        })
      },
      folded: {
        default: false,
        parseHTML: (element) => element.classList.contains('shut') || element.getAttribute('data-folded') === 'true',
        renderHTML: (attributes) => ({
          'data-folded': attributes['folded'] ? 'true' : 'false'
        })
      },
      marker: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-marker') || null,
        renderHTML: (attributes) => (attributes['marker'] ? { 'data-marker': attributes['marker'] } : {})
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.co',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          const type = el.getAttribute('data-callout-type') || 'info';
          const title = el.getAttribute('data-callout-title') || '';
          const folded = el.classList.contains('shut');
          const marker = el.getAttribute('data-marker') || null;
          return { type, title, folded, marker };
        }
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = (node.attrs['type'] as string) || 'info';
    const title = (node.attrs['title'] as string) || (type.charAt(0).toUpperCase() + type.slice(1));
    const isFolded = Boolean(node.attrs['folded']);

    const normType = type.toLowerCase() === 'warn' ? 'warn' : type.toLowerCase();
    const classNames = ['co', normType, isFolded ? 'shut' : ''].filter(Boolean).join(' ');

    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: classNames }),
      [
        'div',
        { class: 'ch', contenteditable: 'false' },
        ['span', { class: 'ch-icon', 'data-type': normType }],
        ['span', { class: 'ch-title' }, title],
        [
          'button',
          {
            type: 'button',
            class: 'fold',
            'aria-expanded': isFolded ? 'false' : 'true',
            'data-callout-fold': 'true'
          },
          ['span', { class: 'fold-arrow' }]
        ]
      ],
      ['div', { class: 'cb', style: isFolded ? 'display: none;' : undefined }, 0]
    ];
  }
});
