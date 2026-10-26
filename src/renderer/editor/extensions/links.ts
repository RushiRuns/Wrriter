import { Mark, mergeAttributes } from '@tiptap/core';

export const WikilinkMark = Mark.create({
  name: 'wikilink',

  addAttributes() {
    return {
      target: {
        default: ''
      },
      alias: {
        default: ''
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.wl:not(.web)',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          return {
            target: el.getAttribute('data-target') || el.textContent || '',
            alias: el.getAttribute('data-alias') || ''
          };
        }
      }
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const target = (mark.attrs['target'] as string) || '';
    const alias = (mark.attrs['alias'] as string) || '';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'wl',
        'data-target': target,
        'data-alias': alias,
        title: `Link to: ${target}`
      }),
      0
    ];
  }
});

export const WebLinkMark = Mark.create({
  name: 'webLink',

  addAttributes() {
    return {
      href: {
        default: ''
      },
      title: {
        default: null
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a.wl.web',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          return {
            href: el.getAttribute('href') || '',
            title: el.getAttribute('title') || null
          };
        }
      },
      {
        tag: 'a[href]',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          return {
            href: el.getAttribute('href') || '',
            title: el.getAttribute('title') || null
          };
        }
      }
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const href = (mark.attrs['href'] as string) || '';
    const title = (mark.attrs['title'] as string) || href;

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        class: 'wl web',
        href,
        title,
        target: '_blank',
        rel: 'noopener noreferrer'
      }),
      ['span', { class: 'globe-icon', contenteditable: 'false' }],
      ['span', { class: 'u' }, 0]
    ];
  }
});
