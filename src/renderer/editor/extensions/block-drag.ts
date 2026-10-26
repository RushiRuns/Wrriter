import { Extension } from '@tiptap/core';
import { EditorView } from '@tiptap/pm/view';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { getTopLevelBlocks, getHeadingSection, headingFoldingPluginKey } from './heading-folding';

export const blockDragPluginKey = new PluginKey('blockDrag');

export interface BlockDragOptions {
  getDragHintShown?: () => boolean;
  onSetDragHintShown?: () => void;
}

export const BlockDragExtension = Extension.create<BlockDragOptions>({
  name: 'blockDrag',

  addOptions() {
    return {
      getDragHintShown: () => true,
      onSetDragHintShown: () => {}
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: blockDragPluginKey,

        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;

              // Check if mousedown is on an eligible drag handle
              const headingArrow = target.closest('.heading-fold-arrow') as HTMLElement | null;
              const coMarginGrab = target.closest('.co-margin-grab') as HTMLElement | null;
              const coIcon = target.closest('.ch-icon') as HTMLElement | null;
              const coLeftBar = target.closest('.co') ? (event.offsetX <= 12 ? (target.closest('.co') as HTMLElement) : null) : null;
              const gripHandle = target.closest('.grip-handle') as HTMLElement | null;

              if (!headingArrow && !coMarginGrab && !coIcon && !coLeftBar && !gripHandle) {
                return false;
              }

              const handleEl = headingArrow || coMarginGrab || coIcon || coLeftBar || gripHandle!;
              const isHeadingArrow = Boolean(headingArrow);
              const isCoIcon = Boolean(coIcon);

              const startX = event.clientX;
              const startY = event.clientY;
              let isDragging = false;
              let ghostEl: HTMLElement | null = null;
              let dropIndicatorEl: HTMLElement | null = null;
              let autoScrollRaf: number | null = null;

              const editorDom = view.dom as HTMLElement;
              const scrollContainer = editorDom.closest('.editor-scroll') as HTMLElement | null;

              // Find target top-level block pos
              const posAttr = handleEl.getAttribute('data-pos');
              let targetBlockPos = posAttr !== null ? parseInt(posAttr, 10) : -1;

              if (targetBlockPos === -1) {
                // Resolve from coords
                const coordsPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordsPos) {
                  const $p = view.state.doc.resolve(coordsPos.pos);
                  if ($p.depth >= 1) {
                    targetBlockPos = $p.before(1);
                  }
                }
              }

              if (targetBlockPos === -1) return false;

              const blocks = getTopLevelBlocks(view.state.doc);
              const blockIndex = blocks.findIndex((b) => b.pos === targetBlockPos);
              if (blockIndex === -1) return false;

              const sourceBlock = blocks[blockIndex]!;
              const isHeading = sourceBlock.type === 'heading';

              // Determine section range
              let moveFrom = sourceBlock.pos;
              let moveTo = sourceBlock.endPos;
              let headingSecBlocks = 1;

              if (isHeading) {
                const sec = getHeadingSection(view.state.doc, blockIndex);
                moveFrom = sec.from;
                moveTo = sec.to;
                headingSecBlocks = sec.sectionBlocks.length;
              }

              // Check if heading or callout was open before drag
              const foldingState = headingFoldingPluginKey.getState(view.state);
              const wasHeadingFolded = isHeading && (foldingState?.foldedPositions.has(sourceBlock.pos) ?? false);
              const wasCalloutFolded = sourceBlock.type === 'callout' && Boolean(sourceBlock.node.attrs['folded']);

              // Find the DOM element corresponding to sourceBlock
              let sourceDomNode: HTMLElement | null = null;
              try {
                const nodeDom = view.nodeDOM(sourceBlock.pos);
                if (nodeDom instanceof HTMLElement) {
                  sourceDomNode = nodeDom;
                }
              } catch {
                sourceDomNode = null;
              }

              const cleanupDrag = () => {
                if (ghostEl && ghostEl.parentNode) {
                  ghostEl.parentNode.removeChild(ghostEl);
                  ghostEl = null;
                }
                if (dropIndicatorEl && dropIndicatorEl.parentNode) {
                  dropIndicatorEl.parentNode.removeChild(dropIndicatorEl);
                  dropIndicatorEl = null;
                }
                if (autoScrollRaf !== null) {
                  cancelAnimationFrame(autoScrollRaf);
                  autoScrollRaf = null;
                }
                document.body.style.cursor = '';
                if (sourceDomNode) {
                  sourceDomNode.classList.remove('wr-block-lifted', 'wr-drag-folded');
                }
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('keydown', onKeyDown);
              };

              const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cleanupDrag();
                }
              };

              let currentDropTargetPos: number | null = null;

              const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const dist = Math.hypot(dx, dy);

                if (!isDragging) {
                  if (dist > 4) {
                    isDragging = true;
                    document.body.style.cursor = 'grabbing';

                    // 1. Lift the block with soft shadow
                    if (sourceDomNode) {
                      sourceDomNode.classList.add('wr-block-lifted');

                      // 2. Open heading or callout folds to single row during drag
                      if (isHeading && !wasHeadingFolded) {
                        sourceDomNode.classList.add('wr-drag-folded');
                      }
                      if (sourceBlock.type === 'callout' && !wasCalloutFolded) {
                        sourceDomNode.classList.add('shut');
                      }
                    }

                    // 3. Create faint copy (ghost) following pointer
                    ghostEl = document.createElement('div');
                    ghostEl.className = 'wr-drag-ghost';
                    const label = isHeading
                      ? `Heading (${sourceBlock.node.textContent.slice(0, 30)}) + section`
                      : sourceBlock.type === 'callout'
                        ? `Callout: ${sourceBlock.node.attrs['title'] || 'Notice'}`
                        : sourceBlock.node.textContent.slice(0, 40) || 'Block';
                    ghostEl.textContent = label;
                    document.body.appendChild(ghostEl);

                    // 4. Create drop indicator line
                    dropIndicatorEl = document.createElement('div');
                    dropIndicatorEl.className = 'wr-drop-indicator';
                    editorDom.appendChild(dropIndicatorEl);
                  } else {
                    return;
                  }
                }

                // Update ghost position
                if (ghostEl) {
                  ghostEl.style.left = `${moveEvent.clientX + 14}px`;
                  ghostEl.style.top = `${moveEvent.clientY + 14}px`;
                }

                // Auto-scroll when near top/bottom (Speed tuned: 10 px/frame ~600 px/s)
                if (scrollContainer) {
                  const rect = scrollContainer.getBoundingClientRect();
                  const topThreshold = rect.top + 48;
                  const bottomThreshold = rect.bottom - 48;

                  if (autoScrollRaf !== null) {
                    cancelAnimationFrame(autoScrollRaf);
                    autoScrollRaf = null;
                  }

                  if (moveEvent.clientY < topThreshold) {
                    const scrollUp = () => {
                      scrollContainer.scrollTop -= 10;
                      autoScrollRaf = requestAnimationFrame(scrollUp);
                    };
                    autoScrollRaf = requestAnimationFrame(scrollUp);
                  } else if (moveEvent.clientY > bottomThreshold) {
                    const scrollDown = () => {
                      scrollContainer.scrollTop += 10;
                      autoScrollRaf = requestAnimationFrame(scrollDown);
                    };
                    autoScrollRaf = requestAnimationFrame(scrollDown);
                  }
                }

                // Position drop indicator
                const currentBlocks = getTopLevelBlocks(view.state.doc);
                let closestBoundaryPos = 0;
                let minDeltaY = Infinity;
                let targetTopPx = 0;

                const editorRect = editorDom.getBoundingClientRect();

                for (let i = 0; i < currentBlocks.length; i++) {
                  const cb = currentBlocks[i]!;
                  let domEl: HTMLElement | null = null;
                  try {
                    const node = view.nodeDOM(cb.pos);
                    if (node instanceof HTMLElement) domEl = node;
                  } catch {
                    domEl = null;
                  }
                  if (!domEl) continue;

                  const bRect = domEl.getBoundingClientRect();
                  const midY = bRect.top + bRect.height / 2;

                  if (moveEvent.clientY < midY) {
                    const delta = Math.abs(moveEvent.clientY - bRect.top);
                    if (delta < minDeltaY) {
                      minDeltaY = delta;
                      closestBoundaryPos = cb.pos;
                      targetTopPx = bRect.top - editorRect.top;
                    }
                    break;
                  } else {
                    const delta = Math.abs(moveEvent.clientY - bRect.bottom);
                    if (delta < minDeltaY) {
                      minDeltaY = delta;
                      closestBoundaryPos = cb.endPos;
                      targetTopPx = bRect.bottom - editorRect.top;
                    }
                  }
                }

                currentDropTargetPos = closestBoundaryPos;
                if (dropIndicatorEl) {
                  dropIndicatorEl.style.top = `${targetTopPx}px`;
                }
              };

              const onMouseUp = () => {
                if (!isDragging) {
                  // IT WAS A CLICK WITHOUT DRAGGING (< 4 px)!
                  cleanupDrag();

                  if (isHeadingArrow) {
                    // Toggle fold on heading
                    const tr = view.state.tr.setMeta(headingFoldingPluginKey, {
                      type: 'toggle',
                      pos: sourceBlock.pos
                    });
                    view.dispatch(tr);
                    return;
                  }

                  if (isCoIcon) {
                    // Open Callout type dropdown menu
                    showCalloutTypeDropdown(view, sourceBlock.pos, handleEl);
                    return;
                  }

                  return;
                }

                // IT WAS A DRAG!
                const targetPos = currentDropTargetPos;
                cleanupDrag();

                if (targetPos === null || targetPos === moveFrom || targetPos === moveTo) {
                  // Dropped in place; settle at Base (180 ms)
                  return;
                }

                // Settle drop at Base (180 ms) by applying single ProseMirror transaction
                const slice = view.state.doc.slice(moveFrom, moveTo);
                const tr = view.state.tr;

                if (targetPos < moveFrom) {
                  tr.delete(moveFrom, moveTo);
                  tr.insert(targetPos, slice.content);
                  tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)));
                } else if (targetPos > moveTo) {
                  tr.insert(targetPos, slice.content);
                  tr.delete(moveFrom, moveTo);
                  const newFrom = targetPos - (moveTo - moveFrom);
                  tr.setSelection(TextSelection.near(tr.doc.resolve(newFrom)));
                }

                view.dispatch(tr);
              };

              window.addEventListener('mousemove', onMouseMove);
              window.addEventListener('mouseup', onMouseUp);
              window.addEventListener('keydown', onKeyDown);

              // "Drag to move" tooltip on first hover/grab
              if (options.getDragHintShown && !options.getDragHintShown()) {
                showDragTooltip(handleEl, () => {
                  options.onSetDragHintShown?.();
                });
              }

              return true;
            }
          }
        }
      })
    ];
  }
});

/**
 * Shows the "Drag to move" tooltip once.
 */
let activeTooltipEl: HTMLElement | null = null;
let tooltipTimer: any = null;

export function showDragTooltip(anchorEl: HTMLElement, onShown: () => void): void {
  if (tooltipTimer) clearTimeout(tooltipTimer);

  tooltipTimer = setTimeout(() => {
    if (activeTooltipEl) {
      activeTooltipEl.remove();
      activeTooltipEl = null;
    }

    const tip = document.createElement('div');
    tip.className = 'wr-drag-tooltip';
    tip.textContent = 'Drag to move';

    const rect = anchorEl.getBoundingClientRect();
    tip.style.left = `${rect.left + rect.width / 2}px`;
    tip.style.top = `${rect.top - 28}px`;

    document.body.appendChild(tip);
    activeTooltipEl = tip;
    onShown();

    setTimeout(() => {
      tip.style.opacity = '0';
      setTimeout(() => tip.remove(), 180);
    }, 2500);
  }, 500);
}

/**
 * Displays the Callout type dropdown menu on icon click.
 */
export function showCalloutTypeDropdown(
  view: EditorView,
  calloutPos: number,
  anchorEl: HTMLElement
): void {
  const existing = document.querySelector('.co-type-dropdown');
  if (existing) existing.remove();

  const types = [
    { type: 'info', label: 'Info' },
    { type: 'tip', label: 'Tip' },
    { type: 'warning', label: 'Warning' },
    { type: 'danger', label: 'Danger' },
    { type: 'note', label: 'Note' },
    { type: 'quote', label: 'Quote' }
  ];

  const menu = document.createElement('div');
  menu.className = 'co-type-dropdown';

  const rect = anchorEl.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;

  for (const item of types) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `co-type-item ${item.type}`;
    row.textContent = item.label;
    row.onclick = (e) => {
      e.stopPropagation();
      menu.remove();

      const $pos = view.state.doc.resolve(calloutPos);
      const node = $pos.nodeAfter;
      if (node && node.type.name === 'callout') {
        const tr = view.state.tr.setNodeMarkup(calloutPos, undefined, {
          ...node.attrs,
          type: item.type
        });
        view.dispatch(tr);
      }
    };
    menu.appendChild(row);
  }

  const closeDropdown = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      window.removeEventListener('click', closeDropdown);
    }
  };

  setTimeout(() => window.addEventListener('click', closeDropdown), 0);
  document.body.appendChild(menu);
}
