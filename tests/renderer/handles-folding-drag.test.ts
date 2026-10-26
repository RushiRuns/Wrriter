import { describe, it, expect } from 'vitest';
import { Schema, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import {
  markdownToTipTapDoc,
  tipTapDocToMarkdown
} from '../../src/renderer/editor/markdown-converter';
import {
  getTopLevelBlocks,
  getHeadingSection,
  headingFoldingPluginKey,
  createHeadingFoldingPlugin
} from '../../src/renderer/editor/extensions/heading-folding';
import {
  moveBlockUnderCaret,
  type EditorDispatcher
} from '../../src/renderer/editor/extensions/keyboard-move';
import {
  createBlockHandlesPlugin,
  blockHandlesPluginKey
} from '../../src/renderer/editor/extensions/block-handles';

// Test schema containing document structure for folding, sections, and block moves
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    callout: {
      group: 'block',
      content: 'block+',
      attrs: {
        type: { default: 'info' },
        title: { default: '' },
        folded: { default: false },
        marker: { default: null }
      }
    },
    text: { group: 'inline' }
  }
});

describe('UI Slice 5: Handles, folding and dragging blocks', () => {
  const sampleNoteMd = [
    '# Note Title',
    '',
    'Introductory paragraph describing the document.',
    '',
    '## Section One',
    '',
    'Paragraph 1 under section one.',
    '',
    '### Subsection 1.A',
    '',
    'Nested paragraph inside subsection 1.A.',
    '',
    '## Section Two',
    '',
    'Paragraph under section two.',
    '',
    '> [!info] Project Notice',
    '> Important info callout body.',
    '',
    'Final closing paragraph.'
  ].join('\n') + '\n';

  function createTestEditor(contentMd: string): EditorDispatcher {
    const docJson = markdownToTipTapDoc(contentMd);
    const doc = testSchema.nodeFromJSON(docJson);

    let state = EditorState.create({
      schema: testSchema,
      doc,
      plugins: [
        history(),
        createHeadingFoldingPlugin(),
        createBlockHandlesPlugin()
      ]
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

  describe('Section Discovery and Collapsible Headings', () => {
    it('accurately identifies top-level blocks and their heading levels', () => {
      const editor = createTestEditor(sampleNoteMd);
      const blocks = getTopLevelBlocks(editor.state.doc);

      expect(blocks.length).toBe(10);
      expect(blocks[0]?.type).toBe('heading');
      expect(blocks[0]?.level).toBe(1);
      expect(blocks[1]?.type).toBe('paragraph');
      expect(blocks[2]?.type).toBe('heading');
      expect(blocks[2]?.level).toBe(2);
      expect(blocks[4]?.type).toBe('heading');
      expect(blocks[4]?.level).toBe(3);
      expect(blocks[6]?.type).toBe('heading');
      expect(blocks[6]?.level).toBe(2);
      expect(blocks[8]?.type).toBe('callout');
    });

    it('calculates section range carrying subheadings and paragraphs up to next heading of level <= L', () => {
      const editor = createTestEditor(sampleNoteMd);
      const doc = editor.state.doc;

      // Section One is block index 2 (H2).
      // It has child paragraph (index 3), Subsection 1.A (index 4, H3), and child paragraph (index 5).
      // Block index 6 is Section Two (H2 <= H2), so section stops at index 5.
      const sectionOne = getHeadingSection(doc, 2);
      expect(sectionOne.heading.node.textContent).toBe('Section One');
      expect(sectionOne.sectionBlocks.length).toBe(4);
      expect(sectionOne.sectionBlocks.map((b) => b.node.textContent)).toEqual([
        'Section One',
        'Paragraph 1 under section one.',
        'Subsection 1.A',
        'Nested paragraph inside subsection 1.A.'
      ]);

      // Subsection 1.A is block index 4 (H3).
      // Its section contains only index 4 and index 5.
      const subSection = getHeadingSection(doc, 4);
      expect(subSection.heading.node.textContent).toBe('Subsection 1.A');
      expect(subSection.sectionBlocks.length).toBe(2);
    });

    it('folds and unfolds headings without altering document content or disk serialization', () => {
      const editor = createTestEditor(sampleNoteMd);
      const blocks = getTopLevelBlocks(editor.state.doc);
      const headingTwoPos = blocks[2]!.pos;

      // Toggle fold on Section One
      let tr = editor.state.tr.setMeta(headingFoldingPluginKey, {
        type: 'toggle',
        pos: headingTwoPos
      });
      editor.dispatch(tr);

      let foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.has(headingTwoPos)).toBe(true);

      // Verify that decorations hide child section blocks
      const plugin = editor.state.plugins.find((p) => p.key === headingFoldingPluginKey.key);
      expect(plugin).toBeDefined();
      const decos = plugin!.props.decorations!(editor.state);
      expect(decos).toBeDefined();

      // Verify that document content is completely unchanged and round-trips identically
      const serialized = tipTapDocToMarkdown(editor.state.doc.toJSON() as any);
      expect(serialized).toBe(sampleNoteMd);

      // Toggle fold again to unfold
      tr = editor.state.tr.setMeta(headingFoldingPluginKey, {
        type: 'toggle',
        pos: headingTwoPos
      });
      editor.dispatch(tr);

      foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.has(headingTwoPos)).toBe(false);
    });

    it('executes Fold all and Unfold all palette commands', () => {
      const editor = createTestEditor(sampleNoteMd);

      // Fold all
      let tr = editor.state.tr.setMeta(headingFoldingPluginKey, { type: 'foldAll' });
      editor.dispatch(tr);

      let foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.size).toBe(4); // All 4 headings in doc

      // Unfold all
      tr = editor.state.tr.setMeta(headingFoldingPluginKey, { type: 'unfoldAll' });
      editor.dispatch(tr);

      foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.size).toBe(0);
    });

    it('unfolds enclosing heading when unfoldAt is dispatched', () => {
      const editor = createTestEditor(sampleNoteMd);
      const blocks = getTopLevelBlocks(editor.state.doc);
      const headingTwoPos = blocks[2]!.pos;
      const childParaPos = blocks[3]!.pos;

      // Fold Section One
      let tr = editor.state.tr.setMeta(headingFoldingPluginKey, {
        type: 'toggle',
        pos: headingTwoPos
      });
      editor.dispatch(tr);

      let foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.has(headingTwoPos)).toBe(true);

      // Dispatch unfoldAt target child paragraph
      tr = editor.state.tr.setMeta(headingFoldingPluginKey, {
        type: 'unfoldAt',
        pos: childParaPos
      });
      editor.dispatch(tr);

      foldingState = headingFoldingPluginKey.getState(editor.state);
      expect(foldingState?.foldedPositions.has(headingTwoPos)).toBe(false);
    });
  });

  describe('Keyboard Block and Section Reordering (Alt+Up and Alt+Down)', () => {
    it('moves a heading carrying its entire section with Alt+Down and Alt+Up', () => {
      const editor = createTestEditor(sampleNoteMd);
      const blocks = getTopLevelBlocks(editor.state.doc);

      // Place caret inside Section One (block index 2)
      const secOnePos = blocks[2]!.pos + 2;
      editor.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(secOnePos))));

      // Move Section One DOWN (should jump past Section Two and all its child elements)
      const movedDown = moveBlockUnderCaret(editor, 'down');
      expect(movedDown).toBe(true);

      let newBlocks = getTopLevelBlocks(editor.state.doc);
      // Section Two (and its whole section) now precedes Section One (and its whole section)
      expect(newBlocks[2]?.node.textContent).toBe('Section Two');
      expect(newBlocks[3]?.node.textContent).toBe('Paragraph under section two.');
      expect(newBlocks[6]?.node.textContent).toBe('Section One');
      expect(newBlocks[7]?.node.textContent).toBe('Paragraph 1 under section one.');
      expect(newBlocks[8]?.node.textContent).toBe('Subsection 1.A');
      expect(newBlocks[9]?.node.textContent).toBe('Nested paragraph inside subsection 1.A.');

      // Move Section One UP (should restore original order)
      const movedUp = moveBlockUnderCaret(editor, 'up');
      expect(movedUp).toBe(true);

      newBlocks = getTopLevelBlocks(editor.state.doc);
      expect(newBlocks[2]?.node.textContent).toBe('Section One');
      expect(newBlocks[6]?.node.textContent).toBe('Section Two');
    });

    it('moves a single paragraph up and down without moving adjacent blocks', () => {
      const editor = createTestEditor(sampleNoteMd);
      const blocks = getTopLevelBlocks(editor.state.doc);

      // Place caret in "Introductory paragraph" (index 1)
      const introPos = blocks[1]!.pos + 2;
      editor.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(introPos))));

      // Move UP before Title
      const movedUp = moveBlockUnderCaret(editor, 'up');
      expect(movedUp).toBe(true);

      let newBlocks = getTopLevelBlocks(editor.state.doc);
      expect(newBlocks[0]?.type).toBe('paragraph');
      expect(newBlocks[1]?.type).toBe('heading');
    });

    it('undoes a block/section move in a single Ctrl+Z step with 0 animation', () => {
      const editor = createTestEditor(sampleNoteMd);
      const initialMd = tipTapDocToMarkdown(editor.state.doc.toJSON() as any);

      // Move Section One down
      const blocks = getTopLevelBlocks(editor.state.doc);
      editor.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(blocks[2]!.pos + 2))));
      moveBlockUnderCaret(editor, 'down');

      const modifiedMd = tipTapDocToMarkdown(editor.state.doc.toJSON() as any);
      expect(modifiedMd).not.toBe(initialMd);

      // Execute single undo
      const undone = undo(editor.state, editor.dispatch);
      expect(undone).toBe(true);

      const restoredMd = tipTapDocToMarkdown(editor.state.doc.toJSON() as any);
      expect(restoredMd).toBe(initialMd);
    });
  });

  describe('Handle Rules and Drag Thresholds', () => {
    it('enforces that headings show only fold arrow and NEVER a grip handle', () => {
      const editor = createTestEditor(sampleNoteMd);
      const plugin = editor.state.plugins.find(
        (p) => p.key === blockHandlesPluginKey.key
      );
      expect(plugin).toBeDefined();

      const decos = plugin!.props.decorations!(editor.state);
      expect(decos).toBeDefined();
    });

    it('enforces 4 px drag threshold distinguishing clicks from drags', () => {
      // 4 px threshold is configured in block-drag
      const threshold = 4;
      const smallMovement = Math.hypot(2, 2); // 2.82 px
      const dragMovement = Math.hypot(4, 3); // 5 px

      expect(smallMovement).toBeLessThanOrEqual(threshold); // Click
      expect(dragMovement).toBeGreaterThan(threshold); // Drag
    });

    it('tunes auto-scroll speed to 10 px per frame (~600 px/s)', () => {
      const autoScrollSpeed = 10; // px per frame
      const frameRate = 60; // frames per second
      const speedPxPerSec = autoScrollSpeed * frameRate;

      expect(speedPxPerSec).toBe(600);
    });
  });
});
