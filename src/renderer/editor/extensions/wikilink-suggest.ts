import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface WikilinkSuggestState {
  readonly isOpen: boolean;
  readonly query: string;
  readonly fromPos: number;
  readonly toPos: number;
  readonly selectedIndex: number;
  readonly coords: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly flipAbove: boolean;
  } | null;
}

export const wikilinkSuggestPluginKey = new PluginKey<WikilinkSuggestState>('wikilinkSuggest');

export interface WikilinkSuggestOptions {
  onStateChange?: ((state: WikilinkSuggestState | null) => void) | undefined;
  onSelectCurrent?: (() => void) | undefined;
}

/**
 * Inserts a wikilink at the specified document range.
 */
export function insertWikilink(
  view: EditorView,
  from: number,
  to: number,
  target: string,
  alias?: string
): void {
  const mark = view.state.schema.marks['wikilink'];
  const displayText = alias || (target.includes('/') ? target.slice(target.lastIndexOf('/') + 1) : target);

  let tr = view.state.tr;
  if (mark) {
    const textNode = view.state.schema.text(displayText, [
      mark.create({ target, alias: alias ?? '' })
    ]);
    tr = tr.replaceWith(from, to, textNode);
  } else {
    tr = tr.insertText(`[[${target}]]`, from, to);
  }

  view.dispatch(tr);
  view.focus();
}

export const WikilinkSuggestExtension = Extension.create<WikilinkSuggestOptions>({
  name: 'wikilinkSuggest',

  addOptions() {
    return {
      onStateChange: undefined,
      onSelectCurrent: undefined
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: wikilinkSuggestPluginKey,

        state: {
          init(): WikilinkSuggestState {
            return {
              isOpen: false,
              query: '',
              fromPos: 0,
              toPos: 0,
              selectedIndex: 0,
              coords: null
            };
          },

          apply(tr, prevState): WikilinkSuggestState {
            const meta = tr.getMeta(wikilinkSuggestPluginKey);
            if (meta) {
              return { ...prevState, ...meta };
            }

            const { selection } = tr;
            if (!selection.empty) {
              return {
                isOpen: false,
                query: '',
                fromPos: 0,
                toPos: 0,
                selectedIndex: 0,
                coords: null
              };
            }

            const $from = selection.$from;
            const parent = $from.parent;
            if (!parent.isTextblock) {
              return {
                isOpen: false,
                query: '',
                fromPos: 0,
                toPos: 0,
                selectedIndex: 0,
                coords: null
              };
            }

            const textBefore = parent.textBetween(0, $from.parentOffset);
            // Match [[ followed by non-bracket text up to cursor, not preceded by !
            const match = textBefore.match(/(?:^|[^!])\[\[([^\]\n]*)$/);
            if (!match) {
              return {
                isOpen: false,
                query: '',
                fromPos: 0,
                toPos: 0,
                selectedIndex: 0,
                coords: null
              };
            }

            const query = match[1] ?? '';
            // Start of [[
            const matchStartInParent = match.index! + (match[0].startsWith('[[') ? 0 : 1);
            const fromPos = $from.start() + matchStartInParent;
            const toPos = $from.pos;

            return {
              isOpen: true,
              query,
              fromPos,
              toPos,
              selectedIndex: prevState.isOpen && prevState.query === query ? prevState.selectedIndex : 0,
              coords: prevState.coords
            };
          }
        },

        props: {
          handleKeyDown(view, event) {
            const pluginState = wikilinkSuggestPluginKey.getState(view.state);
            if (!pluginState || !pluginState.isOpen) {
              return false;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(wikilinkSuggestPluginKey, {
                  selectedIndex: pluginState.selectedIndex + 1
                })
              );
              return true;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(wikilinkSuggestPluginKey, {
                  selectedIndex: Math.max(0, pluginState.selectedIndex - 1)
                })
              );
              return true;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              if (options.onSelectCurrent) {
                event.preventDefault();
                options.onSelectCurrent();
                return true;
              }
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(wikilinkSuggestPluginKey, {
                  isOpen: false
                })
              );
              return true;
            }

            return false;
          }
        },

        view() {
          return {
            update(view: EditorView, prevState: EditorState) {
              const prev = wikilinkSuggestPluginKey.getState(prevState);
              let curr = wikilinkSuggestPluginKey.getState(view.state);

              if (curr && curr.isOpen) {
                try {
                  const domCoords = view.coordsAtPos(curr.toPos);
                  const flipAbove = domCoords.bottom > window.innerHeight - 220;
                  const newCoords = {
                    top: domCoords.top,
                    bottom: domCoords.bottom,
                    left: domCoords.left,
                    flipAbove
                  };

                  if (
                    !curr.coords ||
                    curr.coords.left !== newCoords.left ||
                    curr.coords.bottom !== newCoords.bottom
                  ) {
                    curr = { ...curr, coords: newCoords };
                  }
                } catch {
                  // Coordinate lookup safe fallback
                }
              }

              if (prev !== curr && options.onStateChange) {
                options.onStateChange(curr?.isOpen ? curr : null);
              }
            }
          };
        }
      })
    ];
  }
});
