import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { getTopLevelBlocks, headingFoldingPluginKey } from './heading-folding';

export const blockHandlesPluginKey = new PluginKey('blockHandles');

// SVG icon for the 6-dot grip handle from UI hand-off 2
const GRIP_ICON_SVG = `
<svg class="ic m grip-dots" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none;width:16px;height:16px;">
  <circle cx="9" cy="6" r="1.9"></circle>
  <circle cx="15" cy="6" r="1.9"></circle>
  <circle cx="9" cy="12" r="1.9"></circle>
  <circle cx="15" cy="12" r="1.9"></circle>
  <circle cx="9" cy="18" r="1.9"></circle>
  <circle cx="15" cy="18" r="1.9"></circle>
</svg>`.trim();

// SVG icon for the 16 px fold arrow chevron
const FOLD_ARROW_SVG = `
<svg class="ic fold-arrow-icon" viewBox="0 0 16 16" aria-hidden="true" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
  <polyline points="4 6 8 10 12 6"></polyline>
</svg>`.trim();

export interface BlockHandlesOptions {
  getDragHintShown?: () => boolean;
  onSetDragHintShown?: () => void;
}

export function createBlockHandlesPlugin(options?: BlockHandlesOptions): Plugin {
  return new Plugin({
    key: blockHandlesPluginKey,

        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            const blocks = getTopLevelBlocks(state.doc);
            const foldingState = headingFoldingPluginKey.getState(state);
            const foldedPositions = foldingState?.foldedPositions || new Set<number>();

            // Determine which top-level block contains the current caret/selection
            const $from = state.selection.$from;
            const activeBlockStart = $from.depth >= 1 ? $from.before(1) : -1;

            for (let i = 0; i < blocks.length; i++) {
              const b = blocks[i]!;
              const isActive = b.pos === activeBlockStart;

              // Mark active block with is-active-block class so controls fade in on caret focus as well as hover
              decos.push(
                Decoration.node(b.pos, b.endPos, {
                  class: isActive ? 'has-handle is-active-block' : 'has-handle'
                })
              );

              if (b.type === 'heading') {
                // Headings show ONLY fold arrow in the margin, NEVER a grip
                const isFolded = foldedPositions.has(b.pos);
                decos.push(
                  Decoration.widget(
                    b.pos + 1,
                    () => {
                      const btn = document.createElement('button');
                      btn.type = 'button';
                      btn.className = `heading-fold-arrow ${isFolded ? 'is-folded' : ''}`;
                      btn.setAttribute('data-handle-type', 'heading');
                      btn.setAttribute('data-pos', String(b.pos));
                      btn.setAttribute('data-index', String(i));
                      btn.setAttribute('aria-expanded', isFolded ? 'false' : 'true');
                      btn.setAttribute('title', isFolded ? 'Unfold section (Click) / Drag to move' : 'Fold section (Click) / Drag to move');
                      btn.innerHTML = FOLD_ARROW_SVG;
                      return btn;
                    },
                    { side: -1, key: `hfold-${b.pos}` }
                  )
                );
              } else if (b.type === 'callout') {
                // Callouts show NO grip. They have an invisible 24 px margin strip beside them that grabs
                decos.push(
                  Decoration.widget(
                    b.pos + 1,
                    () => {
                      const strip = document.createElement('div');
                      strip.className = 'co-margin-grab';
                      strip.setAttribute('data-handle-type', 'callout');
                      strip.setAttribute('data-pos', String(b.pos));
                      strip.setAttribute('data-index', String(i));
                      strip.setAttribute('title', 'Drag to move');
                      return strip;
                    },
                    { side: -1, key: `comargin-${b.pos}` }
                  )
                );
              } else {
                // Other blocks (paragraphs, lists, code, tables, quotes, images, file chips) show 24 px grip
                decos.push(
                  Decoration.widget(
                    b.pos + 1,
                    () => {
                      const grip = document.createElement('button');
                      grip.type = 'button';
                      grip.className = 'grip-handle';
                      grip.setAttribute('data-handle-type', 'block');
                      grip.setAttribute('data-pos', String(b.pos));
                      grip.setAttribute('data-index', String(i));
                      grip.setAttribute('title', 'Drag to move');
                      grip.innerHTML = GRIP_ICON_SVG;
                      return grip;
                    },
                    { side: -1, key: `grip-${b.pos}` }
                  )
                );
              }
            }

            return DecorationSet.create(state.doc, decos);
          }
        }
      });
}

export const BlockHandlesExtension = Extension.create<BlockHandlesOptions>({
  name: 'blockHandles',

  addOptions() {
    return {
      getDragHintShown: () => true,
      onSetDragHintShown: () => {}
    };
  },

  addProseMirrorPlugins() {
    return [createBlockHandlesPlugin(this.options)];
  }
});
