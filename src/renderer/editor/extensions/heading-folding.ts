import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface BlockInfo {
  index: number;
  pos: number;
  endPos: number;
  node: ProseMirrorNode;
  type: string;
  level?: number | undefined;
}

/**
 * Returns all top-level blocks in the document with their positions.
 */
export function getTopLevelBlocks(doc: ProseMirrorNode): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  let index = 0;
  doc.forEach((node, pos) => {
    const level = node.type.name === 'heading' ? (node.attrs['level'] as number) || 1 : undefined;
    blocks.push({
      index: index++,
      pos,
      endPos: pos + node.nodeSize,
      node,
      type: node.type.name,
      level
    });
  });
  return blocks;
}

/**
 * Given a heading block index, calculates the full section range:
 * everything under it up to the next heading of the same or higher level, sub-headings included.
 */
export function getHeadingSection(doc: ProseMirrorNode, headingIndex: number): {
  heading: BlockInfo;
  sectionBlocks: BlockInfo[];
  from: number;
  to: number;
} {
  const blocks = getTopLevelBlocks(doc);
  const heading = blocks[headingIndex];
  if (!heading || heading.type !== 'heading' || heading.level === undefined) {
    throw new Error('Target block is not a heading');
  }

  const hLevel = heading.level;
  const sectionBlocks: BlockInfo[] = [heading];

  for (let i = headingIndex + 1; i < blocks.length; i++) {
    const nextBlock = blocks[i]!;
    if (nextBlock.type === 'heading' && nextBlock.level !== undefined && nextBlock.level <= hLevel) {
      break; // Reached next heading of same or higher level
    }
    sectionBlocks.push(nextBlock);
  }

  const from = heading.pos;
  const lastBlock = sectionBlocks[sectionBlocks.length - 1]!;
  const to = lastBlock.endPos;

  return { heading, sectionBlocks, from, to };
}

export interface HeadingFoldingState {
  // Set of heading positions that are folded
  foldedPositions: Set<number>;
}

export const headingFoldingPluginKey = new PluginKey<HeadingFoldingState>('headingFolding');

export function createHeadingFoldingPlugin(): Plugin<HeadingFoldingState> {
  return new Plugin<HeadingFoldingState>({
    key: headingFoldingPluginKey,
    state: {
      init() {
        // Notes always open fully expanded; fold state is purely a view and never written to disk
        return { foldedPositions: new Set<number>() };
      },
          apply(tr, oldState) {
            const meta = tr.getMeta(headingFoldingPluginKey) as
              | { type: 'toggle'; pos: number }
              | { type: 'foldAll' }
              | { type: 'unfoldAll' }
              | { type: 'unfoldAt'; pos: number }
              | { type: 'setFolded'; positions: Set<number> }
              | undefined;

            if (meta) {
              if (meta.type === 'foldAll') {
                const allHeadings = new Set<number>();
                tr.doc.forEach((node, pos) => {
                  if (node.type.name === 'heading') {
                    allHeadings.add(pos);
                  }
                });
                return { foldedPositions: allHeadings };
              }

              if (meta.type === 'unfoldAll') {
                return { foldedPositions: new Set<number>() };
              }

              if (meta.type === 'toggle') {
                const next = new Set<number>(oldState.foldedPositions);
                if (next.has(meta.pos)) {
                  next.delete(meta.pos);
                } else {
                  next.add(meta.pos);
                }
                return { foldedPositions: next };
              }

              if (meta.type === 'unfoldAt') {
                const blocks = getTopLevelBlocks(tr.doc);
                const next = new Set<number>(oldState.foldedPositions);
                for (let i = 0; i < blocks.length; i++) {
                  const b = blocks[i]!;
                  if (b.type === 'heading' && next.has(b.pos)) {
                    const sec = getHeadingSection(tr.doc, i);
                    if (meta.pos >= sec.from && meta.pos <= sec.to) {
                      next.delete(b.pos);
                    }
                  }
                }
                return { foldedPositions: next };
              }

              if (meta.type === 'setFolded') {
                return { foldedPositions: new Set<number>(meta.positions) };
              }
            }

            // Remap positions if doc changed
            if (tr.docChanged && oldState.foldedPositions.size > 0) {
              const remapped = new Set<number>();
              const currentBlocks = getTopLevelBlocks(tr.doc);
              const validHeadingPositions = new Set(
                currentBlocks.filter((b) => b.type === 'heading').map((b) => b.pos)
              );

              for (const oldPos of oldState.foldedPositions) {
                const newPos = tr.mapping.map(oldPos);
                if (validHeadingPositions.has(newPos)) {
                  remapped.add(newPos);
                }
              }
              return { foldedPositions: remapped };
            }

            return oldState;
          }
        },

        props: {
          decorations(state) {
            const pluginState = headingFoldingPluginKey.getState(state);
            if (!pluginState) return DecorationSet.empty;

            const decos: Decoration[] = [];
            const blocks = getTopLevelBlocks(state.doc);

            for (let i = 0; i < blocks.length; i++) {
              const b = blocks[i]!;
              if (b.type === 'heading' && pluginState.foldedPositions.has(b.pos)) {
                // Decorate the heading itself with wr-heading-folded
                decos.push(
                  Decoration.node(b.pos, b.endPos, {
                    class: 'wr-heading-folded'
                  })
                );

                // Decorate child section blocks with wr-folded-hidden
                const section = getHeadingSection(state.doc, i);
                for (let j = 1; j < section.sectionBlocks.length; j++) {
                  const childBlock = section.sectionBlocks[j]!;
                  decos.push(
                    Decoration.node(childBlock.pos, childBlock.endPos, {
                      class: 'wr-folded-hidden'
                    })
                  );
                }
              }
            }

            return DecorationSet.create(state.doc, decos);
          }
        }
      });
}

export const HeadingFoldingExtension = Extension.create({
  name: 'headingFolding',

  addProseMirrorPlugins() {
    return [createHeadingFoldingPlugin()];
  }
});
