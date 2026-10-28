import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { hashString } from '../EditorHost';

export interface PropertiesLineState {
  tags: readonly string[];
  status: string | null;
}

export const propertiesLinePluginKey = new PluginKey<PropertiesLineState>('propertiesLine');

export interface PropertiesLineOptions {
  onTagClick?: (tag: string) => void;
  onStatusClick?: () => void;
  onAddTagClick?: () => void;
}

/**
 * Creates the DOM element for the properties line under the note title.
 * Renders tags with Apple Notes colored pills (.htag.c1-c5) and status pill (.hstatus).
 */
function createPropertiesLineDom(
  tags: readonly string[],
  status: string | null,
  options?: PropertiesLineOptions
): HTMLElement {
  if (typeof document === 'undefined') {
    return {} as HTMLElement;
  }
  const container = document.createElement('div');
  container.className = 'props';

  // Status pill
  if (status) {
    const statusEl = document.createElement('span');
    statusEl.className = 'hstatus';
    statusEl.textContent = status;
    statusEl.title = `Status: ${status} (click to change)`;
    statusEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      options?.onStatusClick?.();
      window.dispatchEvent(new CustomEvent('wrriter:open-set-status'));
    });
    container.appendChild(statusEl);
  }

  // Tags pills
  for (const tag of tags) {
    const tagEl = document.createElement('span');
    const colorIdx = (hashString(tag) % 5) + 1;
    tagEl.className = `htag c${colorIdx}`;
    tagEl.textContent = `#${tag}`;
    tagEl.title = `Tag: #${tag}`;
    tagEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      options?.onTagClick?.(tag);
      window.dispatchEvent(new CustomEvent('wrriter:tag-clicked', { detail: { tag } }));
    });
    container.appendChild(tagEl);
  }

  // Add Tag subtle button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'props-add-btn';
  addBtn.title = 'Add tag';
  addBtn.setAttribute('aria-label', 'Add tag');
  addBtn.textContent = '+';
  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options?.onAddTagClick?.();
    window.dispatchEvent(new CustomEvent('wrriter:open-add-tag'));
  });
  container.appendChild(addBtn);

  return container;
}

/**
 * Creates the ProseMirror plugin for the Properties line.
 */
export function createPropertiesLinePlugin(options?: PropertiesLineOptions): Plugin<PropertiesLineState> {
  return new Plugin<PropertiesLineState>({
    key: propertiesLinePluginKey,
    state: {
      init: () => ({
        tags: [],
        status: null
      }),
      apply: (tr, prev) => {
        const meta = tr.getMeta(propertiesLinePluginKey);
        if (meta) {
          return {
            tags: meta.tags ?? prev.tags,
            status: meta.status !== undefined ? meta.status : prev.status
          };
        }
        return prev;
      }
    },
    props: {
      decorations(state) {
        const pluginState = propertiesLinePluginKey.getState(state);
        if (!pluginState) return DecorationSet.empty;

        const { tags, status } = pluginState;

        // Renders nothing when both are empty (M3 Properties requirement)
        if ((!tags || tags.length === 0) && !status) {
          return DecorationSet.empty;
        }

        // Must position immediately under the title (after first block)
        if (state.doc.childCount === 0) {
          return DecorationSet.empty;
        }

        const titleNode = state.doc.firstChild;
        if (!titleNode) {
          return DecorationSet.empty;
        }

        const pos = titleNode.nodeSize;

        const widget = Decoration.widget(
          pos,
          () => createPropertiesLineDom(tags, status, options),
          {
            side: 1,
            stopEvent: () => true,
            ignoreMutation: () => true
          }
        );

        return DecorationSet.create(state.doc, [widget]);
      }
    }
  });
}

/**
 * PropertiesLineExtension:
 * Injects a widget decoration immediately under the note title (after doc.firstChild)
 * showing tags and status. Renders nothing when both tags and status are empty.
 */
export const PropertiesLineExtension = Extension.create<PropertiesLineOptions>({
  name: 'propertiesLine',

  addProseMirrorPlugins() {
    return [createPropertiesLinePlugin(this.options)];
  }
});
