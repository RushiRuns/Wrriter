import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  findMatchesInDoc,
  replaceOneMatch,
  replaceAllMatches,
  type FindOptions,
  type FindMatch,
  type FindResult
} from '../find-replace-core';

export interface FindReplacePluginState {
  searchTerm: string;
  replaceText: string;
  options: FindOptions;
  matches: FindMatch[];
  activeIndex: number;
  skippedMatches: number;
}

export const findReplacePluginKey = new PluginKey<FindReplacePluginState>('findReplace');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      setFindState: (patch: Partial<FindReplacePluginState>) => ReturnType;
      findNext: () => ReturnType;
      findPrev: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      clearFind: () => ReturnType;
    };
  }
}

export const FindReplaceExtension = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplacePluginState>({
        key: findReplacePluginKey,

        state: {
          init(): FindReplacePluginState {
            return {
              searchTerm: '',
              replaceText: '',
              options: {
                matchCase: false,
                wholeWord: false
              },
              matches: [],
              activeIndex: 0,
              skippedMatches: 0
            };
          },

          apply(tr, prevState, _oldDocState, newDocState): FindReplacePluginState {
            const meta = tr.getMeta(findReplacePluginKey);

            if (meta) {
              const updated: FindReplacePluginState = {
                ...prevState,
                ...meta
              };

              // Recompute matches on doc or search changes
              const findRes: FindResult = findMatchesInDoc(
                newDocState.doc,
                updated.searchTerm,
                updated.options
              );

              let active = updated.activeIndex;
              if (active >= findRes.matches.length) {
                active = Math.max(0, findRes.matches.length - 1);
              }

              return {
                ...updated,
                matches: [...findRes.matches],
                activeIndex: active,
                skippedMatches: findRes.skippedMatches
              };
            }

            if (tr.docChanged && prevState.searchTerm) {
              const findRes: FindResult = findMatchesInDoc(
                newDocState.doc,
                prevState.searchTerm,
                prevState.options
              );

              let active = prevState.activeIndex;
              if (active >= findRes.matches.length) {
                active = Math.max(0, findRes.matches.length - 1);
              }

              return {
                ...prevState,
                matches: [...findRes.matches],
                activeIndex: active,
                skippedMatches: findRes.skippedMatches
              };
            }

            return prevState;
          }
        },

        props: {
          decorations(state) {
            const pluginState = findReplacePluginKey.getState(state);
            if (!pluginState || !pluginState.searchTerm || pluginState.matches.length === 0) {
              return DecorationSet.empty;
            }

            const decos = pluginState.matches.map((m, idx) => {
              let cls = 'wr-find-match';
              if (m.isProtected) {
                cls = 'wr-find-match-protected';
              } else if (idx === pluginState.activeIndex) {
                cls = 'wr-find-match-active';
              }

              return Decoration.inline(m.from, m.to, {
                class: cls,
                'data-find-index': String(idx)
              });
            });

            return DecorationSet.create(state.doc, decos);
          }
        }
      })
    ];
  },

  addCommands() {
    return {
      setFindState:
        (patch: Partial<FindReplacePluginState>) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findReplacePluginKey, patch);
          }
          return true;
        },

      findNext:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = findReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          const nextIndex = (state.activeIndex + 1) % state.matches.length;
          if (dispatch) {
            tr.setMeta(findReplacePluginKey, { activeIndex: nextIndex });
          }
          return true;
        },

      findPrev:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = findReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          const prevIndex = (state.activeIndex - 1 + state.matches.length) % state.matches.length;
          if (dispatch) {
            tr.setMeta(findReplacePluginKey, { activeIndex: prevIndex });
          }
          return true;
        },

      replaceCurrent:
        (replacement: string) =>
        ({ editor, dispatch }) => {
          const state = findReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          const currentMatch = state.matches[state.activeIndex];
          if (!currentMatch || currentMatch.isProtected) return false;

          if (dispatch) {
            const tr = editor.state.tr;
            const ok = replaceOneMatch(tr, editor.state.schema, currentMatch, replacement);
            if (ok) {
              editor.view.dispatch(tr);
            }
          }
          return true;
        },

      replaceAll:
        (replacement: string) =>
        ({ editor, dispatch }) => {
          const state = findReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          if (dispatch) {
            const tr = editor.state.tr;
            const res = replaceAllMatches(tr, editor.state.schema, state.matches, replacement);
            if (res.changed) {
              editor.view.dispatch(tr);
            }
          }
          return true;
        },

      clearFind:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findReplacePluginKey, {
              searchTerm: '',
              matches: [],
              activeIndex: 0,
              skippedMatches: 0
            });
          }
          return true;
        }
    };
  }
});
