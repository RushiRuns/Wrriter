import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  SLASH_MENU_ITEMS,
  filterSlashItems,
  type FilterResult
} from './slash-menu-items';

export interface SlashMenuState {
  readonly isOpen: boolean;
  readonly query: string;
  readonly filterResult: FilterResult;
  readonly selectedIndex: number;
  readonly linePos: number;
  readonly coords: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly flipAbove: boolean;
  } | null;
}

export const slashMenuPluginKey = new PluginKey<SlashMenuState>('slashMenu');

export interface SlashMenuOptions {
  onStateChange?: ((state: SlashMenuState | null) => void) | undefined;
}

export const SlashMenuExtension = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',

  addOptions() {
    return {
      onStateChange: undefined
    };
  },

  addProseMirrorPlugins() {
    let selectedIndex = 0;
    const options = this.options;

    return [
      new Plugin({
        key: slashMenuPluginKey,

        state: {
          init(): SlashMenuState {
            return {
              isOpen: false,
              query: '',
              filterResult: filterSlashItems(SLASH_MENU_ITEMS, ''),
              selectedIndex: 0,
              linePos: 0,
              coords: null
            };
          },

          apply(tr, prevState): SlashMenuState {
            const meta = tr.getMeta(slashMenuPluginKey);
            if (meta) {
              return { ...prevState, ...meta };
            }

            // If document or selection changed, check if caret is on a slash line
            const { selection } = tr;
            if (!selection.empty) {
              return {
                isOpen: false,
                query: '',
                filterResult: filterSlashItems(SLASH_MENU_ITEMS, ''),
                selectedIndex: 0,
                linePos: 0,
                coords: null
              };
            }

            const $from = selection.$from;
            const parent = $from.parent;

            // Only trigger in paragraphs
            if (parent.type.name !== 'paragraph') {
              return {
                isOpen: false,
                query: '',
                filterResult: filterSlashItems(SLASH_MENU_ITEMS, ''),
                selectedIndex: 0,
                linePos: 0,
                coords: null
              };
            }

            const text = parent.textContent;
            // Check if paragraph starts with '/'
            if (text.startsWith('/')) {
              const query = text.slice(1);
              const filterResult = filterSlashItems(SLASH_MENU_ITEMS, query);
              const itemsCount = filterResult.items.length;
              const newIndex = itemsCount === 0 ? 0 : Math.min(prevState.selectedIndex, itemsCount - 1);

              return {
                isOpen: true,
                query,
                filterResult,
                selectedIndex: newIndex,
                linePos: $from.start(),
                coords: prevState.coords
              };
            }

            return {
              isOpen: false,
              query: '',
              filterResult: filterSlashItems(SLASH_MENU_ITEMS, ''),
              selectedIndex: 0,
              linePos: 0,
              coords: null
            };
          }
        },

        props: {
          handleKeyDown(view, event) {
            const pluginState = slashMenuPluginKey.getState(view.state);
            if (!pluginState || !pluginState.isOpen) {
              return false;
            }

            const items = pluginState.filterResult.items;
            const itemsCount = items.length;

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (itemsCount === 0) return true;
              selectedIndex = (pluginState.selectedIndex + 1) % itemsCount;
              view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { selectedIndex }));
              return true;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (itemsCount === 0) return true;
              selectedIndex = (pluginState.selectedIndex - 1 + itemsCount) % itemsCount;
              view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { selectedIndex }));
              return true;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();

              if (itemsCount === 0) {
                // "Nothing matching that": Enter makes a normal new line
                const { state } = view;
                const $from = state.selection.$from;
                const start = $from.start();
                const end = $from.end();
                const pNode = state.schema.nodes['paragraph'];
                if (pNode) {
                  const tr = state.tr.delete(start, end).insert(start, pNode.create());
                  view.dispatch(tr);
                }
                return true;
              }

              const chosen = items[pluginState.selectedIndex];
              if (chosen) {
                // Remove the slash and query text
                const { state } = view;
                const $from = state.selection.$from;
                const start = $from.start();
                const end = $from.end();
                const tr = state.tr.delete(start, end);
                view.dispatch(tr);

                // Execute block insertion
                const editor = (view as any).editor;
                if (editor) {
                  chosen.action(editor);
                }
              }
              return true;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { isOpen: false }));
              return true;
            }

            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              // Close menu on cursor navigation keys
              view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { isOpen: false }));
              return false;
            }

            return false;
          }
        },

        view() {
          return {
            update(view) {
              const state = slashMenuPluginKey.getState(view.state);
              if (!state || !state.isOpen) {
                options.onStateChange?.(null);
                return;
              }

              // Calculate DOM coordinates for positioning
              try {
                const pos = view.state.selection.$from.pos;
                const coords = view.coordsAtPos(pos);
                const flipAbove = window.innerHeight - coords.bottom < 400;

                const updatedCoords = {
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  flipAbove
                };

                options.onStateChange?.({
                  ...state,
                  coords: updatedCoords
                });
              } catch {
                options.onStateChange?.(state);
              }
            }
          };
        }
      })
    ];
  }
});
