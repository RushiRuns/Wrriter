import { describe, it, expect, beforeEach } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { PasteHandlerExtension } from '../../src/renderer/editor/extensions/paste-handler';

// Schema matching editor nodes & marks
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    bulletList: { group: 'block', content: 'listItem+' },
    orderedList: { group: 'block', content: 'listItem+' },
    listItem: { content: 'paragraph block*' },
    codeBlock: { group: 'block', content: 'text*', attrs: { language: { default: null } } },
    text: { group: 'inline' }
  },
  marks: {
    bold: {},
    italic: {},
    strike: {},
    code: {}
  }
});

interface MockView {
  state: EditorState;
  dispatch: (tr: Transaction) => void;
}

function createMockView(initialText = ''): MockView {
  const p = initialText
    ? testSchema.node('paragraph', null, [testSchema.text(initialText)])
    : testSchema.node('paragraph', null, []);
  const doc = testSchema.node('doc', null, [p]);
  let state = EditorState.create({ doc, schema: testSchema });

  const view: MockView = {
    get state() {
      return state;
    },
    set state(s: EditorState) {
      state = s;
    },
    dispatch(tr: Transaction) {
      state = state.apply(tr);
    }
  };
  return view;
}

function simulatePaste(
  plugin: any,
  view: MockView,
  data: { plainText?: string; htmlText?: string },
  shiftKey = false
): boolean {
  if (shiftKey) {
    plugin.props.handleKeyDown?.(view, { shiftKey: true });
  } else {
    plugin.props.handleKeyDown?.(view, { shiftKey: false });
  }

  const clipboardData = {
    getData: (format: string) => {
      if (format === 'text/plain') return data.plainText ?? '';
      if (format === 'text/html') return data.htmlText ?? '';
      return '';
    }
  };

  const event = {
    clipboardData,
    preventDefault: () => {}
  };

  return Boolean(plugin.props.handlePaste?.(view, event));
}

describe('Paste Formatting Regression Tests', () => {
  let plugin: any;
  let mockEditor: any;

  beforeEach(() => {
    mockEditor = {
      commands: {}
    };
    // Initialize the plugin from PasteHandlerExtension
    const plugins = (PasteHandlerExtension as any).config.addProseMirrorPlugins.call({
      editor: mockEditor
    });
    plugin = plugins[0];
  });

  it('formats bold text and paragraphs immediately on paste instead of leaving raw asterisks', () => {
    const view = createMockView();
    const rawMarkdown =
      '**KR1 — Understand Money and Financial Decision-Making** By Day 7, explain at least 15 fundamental financial concepts.';

    const handled = simulatePaste(plugin, view, { plainText: rawMarkdown });
    expect(handled).toBe(true);

    const doc = view.state.doc;
    const firstParagraph = doc.firstChild;
    expect(firstParagraph?.type.name).toBe('paragraph');

    // Regression check: Text must not have raw markdown asterisks
    const fullText = doc.textContent;
    expect(fullText).not.toContain('**KR1');
    expect(fullText).toContain('KR1 — Understand Money and Financial Decision-Making');

    // Regression check: First text node must have the bold mark
    const boldTextNode = firstParagraph?.firstChild;
    expect(boldTextNode?.text).toBe('KR1 — Understand Money and Financial Decision-Making');
    const hasBold = boldTextNode?.marks.some((m) => m.type.name === 'bold');
    expect(hasBold).toBe(true);
  });

  it('formats bullet points immediately into bulletList with listItems', () => {
    const view = createMockView();
    const bulletMarkdown = '- Item 1\n- Item 2\n- Item 3';

    const handled = simulatePaste(plugin, view, { plainText: bulletMarkdown });
    expect(handled).toBe(true);

    const doc = view.state.doc;
    const firstBlock = doc.firstChild;

    // Regression check: Must be a bulletList rather than a raw text paragraph with dashes
    expect(firstBlock?.type.name).toBe('bulletList');
    expect(firstBlock?.childCount).toBe(3);
    expect(firstBlock?.firstChild?.type.name).toBe('listItem');
    expect(doc.textContent).toContain('Item 1');
  });

  it('preserves raw text without formatting when Shift+Ctrl+V (isShift) is used', () => {
    const view = createMockView();
    const rawMarkdown = '**Keep Raw Asterisks**';

    const handled = simulatePaste(plugin, view, { plainText: rawMarkdown }, true);
    expect(handled).toBe(true);

    // With Shift held, raw asterisks should be preserved as literal plain text
    expect(view.state.doc.textContent).toContain('**Keep Raw Asterisks**');
  });

  it('formats headings immediately into heading blocks on paste', () => {
    const view = createMockView();
    const headingMd = '# Project Goals\n\nInitial kickoff notes.';

    const handled = simulatePaste(plugin, view, { plainText: headingMd });
    expect(handled).toBe(true);

    const doc = view.state.doc;
    expect(doc.firstChild?.type.name).toBe('heading');
    expect(doc.firstChild?.attrs['level']).toBe(1);
    expect(doc.firstChild?.textContent).toBe('Project Goals');
    expect(doc.child(1)?.type.name).toBe('paragraph');
  });

  it('pastes inline bold text into existing text without splitting paragraph', () => {
    const view = createMockView('Hello world');
    // Select the word "world" (from: 7, to: 12)
    const tr = view.state.tr.setSelection(
      (view.state.selection.constructor as any).between(
        view.state.doc.resolve(7),
        view.state.doc.resolve(12)
      )
    );
    view.dispatch(tr);

    const handled = simulatePaste(plugin, view, { plainText: '**friend**' });
    expect(handled).toBe(true);

    const doc = view.state.doc;
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild?.type.name).toBe('paragraph');
    expect(doc.textContent).toBe('Hello friend');
    const boldNode = doc.firstChild?.child(1);
    expect(boldNode?.text).toBe('friend');
    expect(boldNode?.marks.some((m) => m.type.name === 'bold')).toBe(true);
  });

  it('pastes literal text inside code blocks without markdown conversion', () => {
    const codeBlock = testSchema.node('codeBlock', { language: 'js' }, []);
    const doc = testSchema.node('doc', null, [codeBlock]);
    let state = EditorState.create({ doc, schema: testSchema });
    const view: MockView = {
      get state() {
        return state;
      },
      set state(s: EditorState) {
        state = s;
      },
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      }
    };

    const handled = simulatePaste(plugin, view, { plainText: '# Not a heading\n- Not a list' });
    expect(handled).toBe(true);

    const resDoc = view.state.doc;
    expect(resDoc.firstChild?.type.name).toBe('codeBlock');
    expect(resDoc.textContent).toContain('# Not a heading\n- Not a list');
  });
});
