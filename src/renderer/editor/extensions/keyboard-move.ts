import { Extension } from '@tiptap/core';
import { EditorView } from '@tiptap/pm/view';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { getTopLevelBlocks, getHeadingSection } from './heading-folding';

export interface EditorDispatcher {
  state: EditorState;
  dispatch: (tr: any) => void;
}

/**
 * Moves the block or section under the caret up or down.
 * - A heading always carries its entire section (subheadings included).
 * - A callout, paragraph, table, list, code block, etc. moves as a single block.
 * - Done in a single ProseMirror transaction so one Ctrl+Z undoes the move with no animation.
 */
export function moveBlockUnderCaret(view: EditorDispatcher, direction: 'up' | 'down'): boolean {
  const { state } = view;
  const { doc, selection } = state;

  const $from = selection.$from;
  if ($from.depth < 1) return false;

  const blockStart = $from.before(1);
  const blocks = getTopLevelBlocks(doc);
  const blockIndex = blocks.findIndex((b) => b.pos === blockStart);
  if (blockIndex === -1) return false;

  const currentBlock = blocks[blockIndex]!;

  let moveFrom: number;
  let moveTo: number;
  let blocksInMove: number;

  if (currentBlock.type === 'heading') {
    const sec = getHeadingSection(doc, blockIndex);
    moveFrom = sec.from;
    moveTo = sec.to;
    blocksInMove = sec.sectionBlocks.length;
  } else {
    moveFrom = currentBlock.pos;
    moveTo = currentBlock.endPos;
    blocksInMove = 1;
  }

  if (direction === 'up') {
    if (blockIndex === 0) return false; // Already at top

    // Find preceding boundary
    const prevBlock = blocks[blockIndex - 1]!;
    // If current block is a heading, jump before the entire preceding section if previous block belongs to a heading
    let targetPos: number;
    if (currentBlock.type === 'heading') {
      let precedingHeadingIdx = -1;
      for (let i = blockIndex - 1; i >= 0; i--) {
        const b = blocks[i]!;
        if (b.type === 'heading') {
          const sec = getHeadingSection(doc, i);
          if (sec.to === moveFrom) {
            precedingHeadingIdx = i;
            break;
          }
        }
      }
      if (precedingHeadingIdx !== -1) {
        targetPos = blocks[precedingHeadingIdx]!.pos;
      } else {
        targetPos = prevBlock.pos;
      }
    } else {
      targetPos = prevBlock.pos;
    }

    const slice = doc.slice(moveFrom, moveTo);
    const tr = state.tr;
    tr.delete(moveFrom, moveTo);
    tr.insert(targetPos, slice.content);

    const relativeOffset = selection.from - moveFrom;
    const newSelPos = Math.min(targetPos + relativeOffset, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(newSelPos)));

    view.dispatch(tr);
    return true;
  }

  if (direction === 'down') {
    const nextBlockIndex = blockIndex + blocksInMove;
    if (nextBlockIndex >= blocks.length) return false; // Already at bottom

    const nextBlock = blocks[nextBlockIndex]!;
    let targetPos: number;

    if (nextBlock.type === 'heading') {
      const nextSec = getHeadingSection(doc, nextBlockIndex);
      targetPos = nextSec.to;
    } else {
      targetPos = nextBlock.endPos;
    }

    const slice = doc.slice(moveFrom, moveTo);
    const tr = state.tr;
    tr.insert(targetPos, slice.content);
    tr.delete(moveFrom, moveTo);

    const sliceSize = moveTo - moveFrom;
    const newFrom = targetPos - sliceSize;
    const relativeOffset = selection.from - moveFrom;
    const newSelPos = Math.min(newFrom + relativeOffset, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(newSelPos)));

    view.dispatch(tr);
    return true;
  }

  return false;
}

export const KeyboardMoveExtension = Extension.create({
  name: 'keyboardMove',

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': ({ editor }) => {
        return moveBlockUnderCaret(editor.view, 'up');
      },
      'Alt-ArrowDown': ({ editor }) => {
        return moveBlockUnderCaret(editor.view, 'down');
      }
    };
  }
});
