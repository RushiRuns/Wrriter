import { Node, mergeAttributes } from '@tiptap/core';

export interface ImageAttributes {
  src: string;
  alt: string;
  width: number | null;
  alignment: 'left' | 'center' | 'right';
}

export const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return {
      src: {
        default: null
      },
      alt: {
        default: ''
      },
      width: {
        default: null
      },
      alignment: {
        default: 'center'
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.phw',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const el = element as HTMLElement;
          const img = el.querySelector('img');
          if (!img) return false;

          let alignment: 'left' | 'center' | 'right' = 'center';
          if (el.classList.contains('r')) alignment = 'right';
          else if (el.classList.contains('l')) alignment = 'left';

          const widthAttr = el.style.getPropertyValue('--pw') || img.getAttribute('width');
          const width = widthAttr ? parseInt(widthAttr, 10) : null;

          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            width: isNaN(width as any) ? null : width,
            alignment
          };
        }
      },
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          if (typeof element === 'string') return null;
          const img = element as HTMLElement;
          const widthAttr = img.getAttribute('width');
          const width = widthAttr ? parseInt(widthAttr, 10) : null;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            width: isNaN(width as any) ? null : width,
            alignment: 'center'
          };
        }
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const alignment = (node.attrs['alignment'] as string) || 'center';
    const width = node.attrs['width'] as number | null;
    const alt = (node.attrs['alt'] as string) || '';
    const src = (node.attrs['src'] as string) || '';

    const alignClass = alignment === 'right' ? 'r' : alignment === 'left' ? 'l' : 'c';
    const isPlaceholder = !src || src === 'attachments/image.png';

    let displaySrc = src;
    if (
      src &&
      !src.startsWith('http://') &&
      !src.startsWith('https://') &&
      !src.startsWith('data:') &&
      !src.startsWith('file://') &&
      !src.startsWith('wrriter-vault://')
    ) {
      try {
        const decoded = decodeURIComponent(src);
        const norm = decoded.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
        displaySrc = `wrriter-vault:///${encodeURI(norm)}`;
      } catch {
        displaySrc = `wrriter-vault:///${src.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '')}`;
      }
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `phw ${alignClass}`,
        style: width ? `--pw: ${width}px;` : undefined,
        'data-image-block': 'true'
      }),
      [
        'div',
        { class: 'ph' },
        isPlaceholder
          ? [
              'div',
              { class: 'ph-placeholder', contenteditable: 'false' },
              [
                'svg',
                { class: 'ic xl', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }],
                ['circle', { cx: '8.5', cy: '8.5', r: '1.5' }],
                ['polyline', { points: '21 15 16 10 5 21' }]
              ],
              ['span', { class: 'ph-label' }, alt || 'Add an image']
            ]
          : [
              'img',
              {
                src: displaySrc,
                alt,
                loading: 'lazy',
                decoding: 'async',
                width: width ? String(width) : undefined
              }
            ]
      ],
      // Corner resize handles
      ['span', { class: 'phh tl', contenteditable: 'false' }],
      ['span', { class: 'phh tr', contenteditable: 'false' }],
      ['span', { class: 'phh bl', contenteditable: 'false' }],
      ['span', { class: 'phh br', contenteditable: 'false' }],
      // Floating toolbar bar above selected image
      [
        'div',
        { class: 'phbar', contenteditable: 'false' },
        [
          'button',
          {
            type: 'button',
            class: 'fb',
            'data-align': 'left',
            'aria-pressed': alignment === 'left' ? 'true' : 'false'
          },
          'Left'
        ],
        [
          'button',
          {
            type: 'button',
            class: 'fb',
            'data-align': 'center',
            'aria-pressed': alignment === 'center' ? 'true' : 'false'
          },
          'Center'
        ],
        [
          'button',
          {
            type: 'button',
            class: 'fb',
            'data-align': 'right',
            'aria-pressed': alignment === 'right' ? 'true' : 'false'
          },
          'Right'
        ],
        [
          'button',
          {
            type: 'button',
            class: 'fb',
            'data-action': 'remove',
            style: 'color: var(--dgr);'
          },
          'Remove'
        ]
      ]
    ];
  }
});
