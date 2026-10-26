import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface FloatingToolbarState {
  readonly isVisible: boolean;
  readonly coords: {
    readonly top: number;
    readonly left: number;
  } | null;
  readonly isBold: boolean;
  readonly isItalic: boolean;
  readonly isStrike: boolean;
  readonly isCode: boolean;
  readonly isLink: boolean;
  readonly currentBlockType: string;
  readonly currentListType: string;
}

export const floatingToolbarPluginKey = new PluginKey<FloatingToolbarState>('floatingToolbar');

export interface FloatingToolbarOptions {
  onStateChange?: ((state: FloatingToolbarState | null) => void) | undefined;
}

export const FloatingToolbarExtension = Extension.create<FloatingToolbarOptions>({
  name: 'floatingToolbar',

  addOptions() {
    return {
      onStateChange: undefined
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: floatingToolbarPluginKey,

        state: {
          init(): FloatingToolbarState {
            return {
              isVisible: false,
              coords: null,
              isBold: false,
              isItalic: false,
              isStrike: false,
              isCode: false,
              isLink: false,
              currentBlockType: 'paragraph',
              currentListType: 'none'
            };
          },

          apply(tr, prevState): FloatingToolbarState {
            const meta = tr.getMeta(floatingToolbarPluginKey);
            if (meta) {
              return { ...prevState, ...meta };
            }

            const { selection } = tr;
            if (selection.empty) {
              return {
                ...prevState,
                isVisible: false,
                coords: null
              };
            }

            // Determine active formatting marks
            const state = tr.doc ? (tr as any) : null;
            let isBold = false;
            let isItalic = false;
            let isStrike = false;
            let isCode = false;
            let isLink = false;

            if (state) {
              const { from, to } = selection;
              tr.doc.nodesBetween(from, to, (node) => {
                if (node.isText) {
                  node.marks.forEach((mark) => {
                    if (mark.type.name === 'bold') isBold = true;
                    if (mark.type.name === 'italic') isItalic = true;
                    if (mark.type.name === 'strike') isStrike = true;
                    if (mark.type.name === 'code') isCode = true;
                    if (mark.type.name === 'link') isLink = true;
                  });
                }
              });
            }

            // Block type
            const parent = selection.$from.parent;
            let currentBlockType = 'paragraph';
            if (parent.type.name === 'heading') {
              currentBlockType = `h${parent.attrs['level'] ?? 1}`;
            } else if (parent.type.name === 'codeBlock') {
              currentBlockType = 'codeBlock';
            } else if (parent.type.name === 'blockquote') {
              currentBlockType = 'blockquote';
            }

            // List type
            let currentListType = 'none';
            for (let d = selection.$from.depth; d > 0; d--) {
              const node = selection.$from.node(d);
              if (node.type.name === 'bulletList') {
                currentListType = 'bulletList';
                break;
              } else if (node.type.name === 'orderedList') {
                currentListType = 'orderedList';
                break;
              } else if (node.type.name === 'taskList') {
                currentListType = 'taskList';
                break;
              }
            }

            return {
              isVisible: true,
              coords: prevState.coords, // Kept stable; updated via view update
              isBold,
              isItalic,
              isStrike,
              isCode,
              isLink,
              currentBlockType,
              currentListType
            };
          }
        },

        view() {
          return {
            update(view, prevState) {
              const state = floatingToolbarPluginKey.getState(view.state);
              if (!state || !state.isVisible || view.state.selection.empty) {
                options.onStateChange?.(null);
                return;
              }

              // Only recalculate coords if selection changed from empty or block changed
              // "never follows the selection" - stays static once shown
              const prevSel = prevState.selection;
              const currSel = view.state.selection;
              const needsReposition = prevSel.empty || Math.abs(prevSel.from - currSel.from) > 10;

              if (needsReposition || !state.coords) {
                try {
                  const { from, to } = view.state.selection;
                  const startCoords = view.coordsAtPos(from);
                  const endCoords = view.coordsAtPos(to);

                  const centerX = (startCoords.left + endCoords.right) / 2;
                  const topY = Math.min(startCoords.top, endCoords.top) - 48; // 12 px above pill height

                  const newCoords = {
                    top: Math.max(16, topY),
                    left: Math.max(24, Math.min(centerX - 160, window.innerWidth - 340))
                  };

                  options.onStateChange?.({
                    ...state,
                    coords: newCoords
                  });
                } catch {
                  options.onStateChange?.(state);
                }
              } else {
                options.onStateChange?.(state);
              }
            }
          };
        }
      })
    ];
  }
});
