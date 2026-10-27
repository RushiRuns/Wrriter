import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isReducedMotionActive } from '../../motion';

/**
 * Step-aside cut stage for typing touches (Features 8, PERFORMANCE.md item 44):
 * 0: All typing touches active (normal typing)
 * 1: New-letter fade stepped aside first (large note or fast typing)
 * 2: Caret glide and selection fade also stepped aside
 */
export type TypingTouchCutStage = 0 | 1 | 2;

export interface TypingTouchesOptions {
  /**
   * Interval threshold in milliseconds below which typing is considered fast
   * and touches are instantly bypassed. Default: 120 ms.
   */
  fastTypingThresholdMs?: number;
  /**
   * Note size in characters above which new-letter fade automatically steps aside.
   * Default: 500,000 characters (~0.5 MB - 1 MB).
   */
  largeNoteSizeThreshold?: number;
}

export interface TypingTouchesState {
  lastKeystrokeTime: number;
  isFastTyping: boolean;
  cutStage: TypingTouchCutStage;
  decorations: DecorationSet;
  steppedAsideCount: number;
  lastStepAsideReason: string | null;
}

export const typingTouchesPluginKey = new PluginKey<TypingTouchesState>('typingTouches');

// Module-level state for global monitoring and step-aside coordination
let globalCutStage: TypingTouchCutStage = 0;
let globalFastThreshold = 120;
let globalStepAsideReason: string | null = null;
let globalStepAsideListeners: Array<(stage: TypingTouchCutStage, reason: string | null) => void> = [];

export function getTypingTouchesCutStage(): TypingTouchCutStage {
  return globalCutStage;
}

export function setTypingTouchesCutStage(stage: TypingTouchCutStage, reason?: string | null): void {
  globalCutStage = stage;
  globalStepAsideReason = reason ?? null;
  for (const listener of globalStepAsideListeners) {
    listener(stage, globalStepAsideReason);
  }
}

export function stepAsideNewLetterFade(reason = '1 MB note typing touches step-aside: new-letter fade goes first'): void {
  setTypingTouchesCutStage(1, reason);
}

export function stepAsideCaretGlide(reason = 'Caret glide and selection fade stepped aside'): void {
  setTypingTouchesCutStage(2, reason);
}

export function resetTypingTouchesCutStage(): void {
  setTypingTouchesCutStage(0, null);
}

export function setFastTypingThreshold(ms: number): void {
  globalFastThreshold = ms;
}

export function getFastTypingThreshold(): number {
  return globalFastThreshold;
}

export function subscribeTypingTouchCutStage(
  listener: (stage: TypingTouchCutStage, reason: string | null) => void
): () => void {
  globalStepAsideListeners.push(listener);
  return () => {
    globalStepAsideListeners = globalStepAsideListeners.filter((l) => l !== listener);
  };
}

/**
 * Creates the pure ProseMirror Plugin for typing touches.
 */
export function createTypingTouchesPlugin(options: TypingTouchesOptions = {}): Plugin<TypingTouchesState> {
  const threshold = options.fastTypingThresholdMs ?? globalFastThreshold;
  const largeNoteThreshold = options.largeNoteSizeThreshold ?? 500_000;

  return new Plugin<TypingTouchesState>({
    key: typingTouchesPluginKey,

    state: {
      init() {
        return {
          lastKeystrokeTime: 0,
          isFastTyping: false,
          cutStage: globalCutStage,
          decorations: DecorationSet.empty,
          steppedAsideCount: 0,
          lastStepAsideReason: globalStepAsideReason
        };
      },

      apply(tr, prevState, oldEditorState, newEditorState) {
        let nextDecorations = prevState.decorations.map(tr.mapping, tr.doc);
        const now = performance.now();
        const timeSinceLast = prevState.lastKeystrokeTime > 0 ? now - prevState.lastKeystrokeTime : 9999;
        const isFast = timeSinceLast < threshold;

        let currentCutStage = globalCutStage;
        let steppedAsideCount = prevState.steppedAsideCount;
        let stepAsideReason = prevState.lastStepAsideReason;

        // Check large note threshold for automatic step-aside
        if (newEditorState.doc.content.size >= largeNoteThreshold && currentCutStage === 0) {
          currentCutStage = 1;
          stepAsideReason = '1 MB note typing touches step-aside: new-letter fade goes first';
          steppedAsideCount++;
        }

        // Clean up expired decorations
        const metaClear = tr.getMeta('clearTypingTouchDecorations');
        if (metaClear) {
          nextDecorations = DecorationSet.empty;
        }

        // Detect single character insertion (letter typing)
        if (tr.docChanged && tr.steps.length > 0) {
          const reduced = isReducedMotionActive();

          // Only apply new-letter fade if not fast typing, cut stage is 0, and reduced motion is off
          if (!isFast && currentCutStage === 0 && !reduced) {
            for (const step of tr.steps) {
              const stepMap = step.getMap();
              stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                const insertedLength = newEnd - newStart;
                if (insertedLength === 1 && oldEnd === oldStart) {
                  const dec = Decoration.inline(
                    newStart,
                    newEnd,
                    { class: 'wr-new-letter-fade' },
                    { class: 'wr-new-letter-fade' }
                  );
                  nextDecorations = nextDecorations.add(tr.doc, [dec]);
                }
              });
            }
          } else if (isFast || currentCutStage > 0) {
            nextDecorations = DecorationSet.empty;
          }
        }

        return {
          lastKeystrokeTime: tr.docChanged ? now : prevState.lastKeystrokeTime,
          isFastTyping: isFast,
          cutStage: currentCutStage,
          decorations: nextDecorations,
          steppedAsideCount,
          lastStepAsideReason: stepAsideReason
        };
      }
    },

    props: {
      decorations(state) {
        return this.getState(state)?.decorations ?? DecorationSet.empty;
      },

      handleKeyDown(view, event) {
        const pluginState = typingTouchesPluginKey.getState(view.state);
        if (!pluginState) return false;

        // Clear fade decorations periodically to prevent accumulation
        if (pluginState.decorations.find().length > 0) {
          setTimeout(() => {
            if (view.isDestroyed) return;
            const tr = view.state.tr.setMeta('clearTypingTouchDecorations', true);
            view.dispatch(tr);
          }, 120);
        }

        return false;
      }
    },

    view(editorView) {
      let glider: HTMLDivElement | null = null;
      let prevCoords: { left: number; top: number; height: number } | null = null;

      const parent = editorView.dom?.parentElement;
      if (parent && typeof document !== 'undefined') {
        glider = document.createElement('div');
        glider.className = 'wr-caret-glider';
        glider.setAttribute('aria-hidden', 'true');
        parent.appendChild(glider);
      }

      return {
        update(view, prevState) {
          if (!glider) return;

          const pluginState = typingTouchesPluginKey.getState(view.state);
          const cutStage = pluginState?.cutStage ?? globalCutStage;
          const isFast = pluginState?.isFastTyping ?? false;
          const reduced = isReducedMotionActive();

          if (!view.hasFocus() || cutStage >= 2 || reduced) {
            glider.style.opacity = '0';
            prevCoords = null;
            return;
          }

          const { selection } = view.state;
          if (!selection.empty) {
            glider.style.opacity = '0';
            prevCoords = null;
            return;
          }

          const parentEl = view.dom.parentElement;
          if (!parentEl) return;

          const parentRect = parentEl.getBoundingClientRect();
          const coords = view.coordsAtPos(selection.from);
          const x = coords.left - parentRect.left + parentEl.scrollLeft;
          const y = coords.top - parentRect.top + parentEl.scrollTop;
          const height = Math.max(16, coords.bottom - coords.top);

          if (!prevCoords || isFast) {
            glider.style.transition = 'none';
            glider.style.transform = `translate(${x}px, ${y}px)`;
            glider.style.height = `${height}px`;
            glider.style.opacity = '1';
          } else {
            glider.style.transition = 'transform var(--t-fast) var(--ease-move), height var(--t-fast) var(--ease-move)';
            glider.style.transform = `translate(${x}px, ${y}px)`;
            glider.style.height = `${height}px`;
            glider.style.opacity = '1';
          }

          prevCoords = { left: x, top: y, height };
        },

        destroy() {
          if (glider && glider.parentElement) {
            glider.parentElement.removeChild(glider);
            glider = null;
          }
        }
      };
    }
  });
}

/**
 * TipTap extension implementing the typing touches from Features 8:
 * 1. Caret glide: smooth 100 ms gliding indicator when navigating or typing normally.
 * 2. Selection fade: smooth 100 ms selection transition.
 * 3. New-letter fade: subtle 100 ms opacity fade when typing normally.
 *
 * Fast-typing bypass:
 * Whenever consecutive keystrokes occur under the threshold (120 ms), touches are skipped
 * instantly so typing is never delayed or throttled.
 *
 * Step-aside rule (PERFORMANCE.md item 44):
 * In notes >= 500,000 characters (~1 MB), new-letter fade steps aside first.
 */
export const TypingTouchesExtension = Extension.create<TypingTouchesOptions>({
  name: 'typingTouches',

  addOptions() {
    return {
      fastTypingThresholdMs: 120,
      largeNoteSizeThreshold: 500_000
    };
  },

  addProseMirrorPlugins() {
    return [createTypingTouchesPlugin(this.options)];
  }
});
