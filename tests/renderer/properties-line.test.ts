import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import {
  createPropertiesLinePlugin,
  propertiesLinePluginKey
} from '../../src/renderer/editor/extensions/properties-line';
import { markdownToTipTapDoc } from '../../src/renderer/editor/markdown-converter';
import {
  parseFrontmatter,
  updateFrontmatter,
  formatCreatedDate
} from '../../src/shared/domain/frontmatter';
import { formatNoteDate } from '../../src/renderer/editor/EditorHost';

const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    text: { group: 'inline' }
  }
});

interface EditorDispatcher {
  state: EditorState;
  dispatch: (tr: any) => void;
}

describe('M3: Properties (Frontmatter, Properties Line, Tags, Status, Created, Modified)', () => {
  describe('Properties Line under title', () => {
    const origDocument = globalThis.document;

    beforeEach(() => {
      // Mock minimal document for DOM testing in Node
      (globalThis as any).document = {
        createElement: (tag: string) => {
          const children: any[] = [];
          const listeners: Record<string, Function[]> = {};
          return {
            tagName: tag.toUpperCase(),
            className: '',
            textContent: '',
            title: '',
            children,
            setAttribute: () => {},
            addEventListener: (evt: string, fn: Function) => {
              listeners[evt] = listeners[evt] || [];
              listeners[evt].push(fn);
            },
            appendChild: (child: any) => children.push(child),
            querySelector: (sel: string) => {
              if (sel === '.hstatus') return children.find((c) => c.className === 'hstatus') || null;
              if (sel === '.props-add-btn') return children.find((c) => c.className === 'props-add-btn') || null;
              return null;
            },
            querySelectorAll: (sel: string) => {
              if (sel === '.htag') return children.filter((c) => c.className.startsWith('htag'));
              return [];
            }
          };
        }
      };
    });

    afterEach(() => {
      (globalThis as any).document = origDocument;
    });

    function createTestEditor(md = '# My Note Title\n\nFirst paragraph of content body.'): EditorDispatcher {
      const docJson = markdownToTipTapDoc(md);
      const doc = testSchema.nodeFromJSON(docJson);

      let state = EditorState.create({
        schema: testSchema,
        doc,
        plugins: [createPropertiesLinePlugin()]
      });

      const dispatcher: EditorDispatcher = {
        get state() {
          return state;
        },
        dispatch(tr: any) {
          state = state.apply(tr);
        }
      };

      return dispatcher;
    }

    it('renders nothing when both tags and status are empty', () => {
      const editor = createTestEditor();
      editor.dispatch(
        editor.state.tr.setMeta(propertiesLinePluginKey, { tags: [], status: null })
      );

      const plugin = propertiesLinePluginKey.get(editor.state);
      expect(plugin).toBeDefined();

      const decos = plugin?.props.decorations?.call(plugin, editor.state);
      expect(decos?.find().length ?? 0).toBe(0);
    });

    it('renders properties line widget immediately under the title when tags or status are set', () => {
      const editor = createTestEditor();
      editor.dispatch(
        editor.state.tr.setMeta(propertiesLinePluginKey, {
          tags: ['frontend', 'architecture'],
          status: 'active'
        })
      );

      const plugin = propertiesLinePluginKey.get(editor.state);
      expect(plugin).toBeDefined();

      const decos = plugin?.props.decorations?.call(plugin, editor.state);
      const found = decos?.find() ?? [];
      expect(found.length).toBe(1);

      // Verify widget position: immediately after title node
      const titleNode = editor.state.doc.firstChild;
      expect(titleNode).toBeDefined();
      expect(found[0]?.from).toBe(titleNode!.nodeSize);

      // Verify rendered DOM elements
      const toDOM = (found[0] as any).type?.toDOM;
      expect(toDOM).toBeDefined();
      const dom = toDOM() as HTMLElement;
      expect(dom.className).toBe('props');

      const statusEl = dom.querySelector('.hstatus');
      expect(statusEl).not.toBeNull();
      expect(statusEl?.textContent).toBe('active');

      const tagEls = dom.querySelectorAll('.htag');
      expect(tagEls.length).toBe(2);
      expect(tagEls[0]?.textContent).toBe('#frontend');
      expect(tagEls[1]?.textContent).toBe('#architecture');

      const addBtn = dom.querySelector('.props-add-btn');
      expect(addBtn).not.toBeNull();
      expect(addBtn?.textContent).toBe('+');
    });
  });

  describe('Broken Frontmatter handling', () => {
    const brokenNote = `---
tags: [unclosed bracket
status: broken
---
# Note Title

Body text.`;

    it('marks broken frontmatter as isBroken and treats properties as empty', () => {
      const parsed = parseFrontmatter(brokenNote);
      expect(parsed.hasFrontmatter).toBe(true);
      expect(parsed.isBroken).toBe(true);
      expect(parsed.tags).toEqual([]);
      expect(parsed.status).toBeNull();
      expect(parsed.created).toBeNull();
    });

    it('shows broken frontmatter as raw text inside TipTap document', () => {
      const doc = markdownToTipTapDoc(brokenNote);
      // The broken lines must be present as paragraphs in the doc content
      const paragraphTexts = doc.content
        .filter((n) => n.type === 'paragraph')
        .map((n) => n.content?.[0]?.text ?? '');

      expect(paragraphTexts).toContain('---');
      expect(paragraphTexts).toContain('tags: [unclosed bracket');
      expect(paragraphTexts).toContain('status: broken');
    });

    it('leaves file completely untouched when updating broken frontmatter', () => {
      const result = updateFrontmatter(brokenNote, {
        tags: ['new-tag'],
        status: 'new-status'
      });
      expect(result).toBe(brokenNote);
    });
  });

  describe('Created and Modified timestamps', () => {
    it('formats created date in ISO 8601 (YYYY-MM-DDTHH:mm:ss)', () => {
      const date = new Date(2026, 9, 28, 14, 25, 30); // 2026-10-28 14:25:30
      expect(formatCreatedDate(date)).toBe('2026-10-28T14:25:30');
    });

    it('adds created timestamp to a note without it upon surgical frontmatter update', () => {
      const source = `---
tags: [alpha]
status: draft
---
# Note Title

Content.`;

      const updated = updateFrontmatter(source, {
        created: '2026-10-28T15:00:00'
      });

      expect(updated).toContain('created: 2026-10-28T15:00:00');
      expect(updated).toContain('tags: [alpha]');
      expect(updated).toContain('status: draft');
      expect(updated).toContain('# Note Title');
    });

    it('formats file disk modified time on the date line without storing modified in note', () => {
      const mtimeMs = new Date(2026, 9, 17, 8, 12, 0).getTime();
      const dateLine = formatNoteDate(mtimeMs);
      expect(dateLine).toBe('17 October 2026 at 08:12');

      const noteSource = `---
tags: [review]
created: 2026-10-17T08:00:00
---
# Plan

Body text`;

      const parsed = parseFrontmatter(noteSource);
      // Modified time is NEVER stored in frontmatter
      expect((parsed as any).modified).toBeUndefined();
      expect(noteSource).not.toContain('modified:');
    });
  });

  describe('Frontmatter surgical key ownership & round-trip safety', () => {
    it('edits only owned keys (tags, status, created) while preserving unowned keys, order, and comments', () => {
      const source = `---
# Important Author Header
aliases:
  - Custom Alias
title: External App Title
tags: [project, core]
status: draft
created: 2026-10-20T10:00:00
# Unowned comment
custom_metadata: 12345
---
# Note Heading

Body text.`;

      const updated = updateFrontmatter(source, {
        tags: ['project', 'core', 'v1'],
        status: 'published'
      });

      expect(updated).toContain('# Important Author Header');
      expect(updated).toContain('aliases:\n  - Custom Alias');
      expect(updated).toContain('title: External App Title');
      expect(updated).toContain('tags: [project, core, v1]');
      expect(updated).toContain('status: published');
      expect(updated).toContain('created: 2026-10-20T10:00:00');
      expect(updated).toContain('# Unowned comment');
      expect(updated).toContain('custom_metadata: 12345');
      expect(updated).toContain('# Note Heading\n\nBody text.');
    });

    it('adds frontmatter block only when first property is set', () => {
      const cleanNote = `# Clean Note\n\nNo frontmatter block.`;

      // Empty updates -> no block added
      const untouched = updateFrontmatter(cleanNote, {});
      expect(untouched).toBe(cleanNote);

      // Property set -> block added with list tags per SCHEMA.md line 123
      const withProps = updateFrontmatter(cleanNote, {
        tags: ['ideas'],
        status: 'active'
      });
      expect(withProps.startsWith('---\n')).toBe(true);
      expect(withProps).toContain('tags:\n  - ideas\n');
      expect(withProps).toContain('status: active\n');
      expect(withProps).toContain('# Clean Note');
    });
  });
});
