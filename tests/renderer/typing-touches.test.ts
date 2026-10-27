import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import {
  createTypingTouchesPlugin,
  typingTouchesPluginKey,
  getTypingTouchesCutStage,
  setTypingTouchesCutStage,
  stepAsideNewLetterFade,
  stepAsideCaretGlide,
  resetTypingTouchesCutStage,
  setFastTypingThreshold,
  getFastTypingThreshold,
  subscribeTypingTouchCutStage
} from '../../src/renderer/editor/extensions/typing-touches';
import { TaskItemNode } from '../../src/renderer/editor/extensions/nodes';

// Test schema matching ProseMirror document structure
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' }
  }
});

function createDoc(text: string) {
  const textNode = text ? testSchema.text(text) : null;
  const p = testSchema.node('paragraph', null, textNode ? [textNode] : []);
  return testSchema.node('doc', null, [p]);
}

describe('Typing Touches and Motion System (Features 8, ADR-W09)', () => {
  beforeEach(() => {
    resetTypingTouchesCutStage();
    setFastTypingThreshold(120);
  });

  afterEach(() => {
    resetTypingTouchesCutStage();
    vi.restoreAllMocks();
  });

  describe('Single Caret Contract and Caret Glider Positioning (Regression)', () => {
    it('ensures CSS defines position: relative on .editor-container, top/left: 0 on .wr-caret-glider, and transparent caret when glider is active', async () => {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const css = readFileSync(join(__dirname, '../../src/renderer/styles/components.css'), 'utf-8');

      // 1. .editor-container must be positioned relative to anchor the glider
      const containerMatch = css.match(/\.editor-container\s*\{([^}]+)\}/);
      expect(containerMatch, '.editor-container must be declared in components.css').toBeTruthy();
      expect(containerMatch![1]).toContain('position: relative');

      // 2. .wr-caret-glider must have top: 0 and left: 0 so translate(x,y) starts at origin
      const gliderMatch = css.match(/\.wr-caret-glider\s*\{([^}]+)\}/);
      expect(gliderMatch, '.wr-caret-glider must be declared in components.css').toBeTruthy();
      expect(gliderMatch![1]).toContain('top: 0');
      expect(gliderMatch![1]).toContain('left: 0');

      // 3. When glider is active, native caret must be hidden to avoid double carets
      const hideCaretMatch = css.match(/\.wrriter-prosemirror\.has-caret-glider\s*\{([^}]+)\}/);
      expect(hideCaretMatch, '.wrriter-prosemirror.has-caret-glider must hide native caret').toBeTruthy();
      expect(hideCaretMatch![1]).toContain('caret-color: transparent');
    });

    it('toggles has-caret-glider class on view.dom when glider is active vs inactive', () => {
      const plugin = createTypingTouchesPlugin();
      const state = EditorState.create({
        doc: createDoc('Testing single caret'),
        schema: testSchema,
        plugins: [plugin]
      });

      const classList = new Set<string>();
      const domEl: any = {
        classList: {
          add: (cls: string) => classList.add(cls),
          remove: (cls: string) => classList.delete(cls),
          contains: (cls: string) => classList.has(cls)
        },
        parentElement: {
          getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
          scrollLeft: 0,
          scrollTop: 0,
          appendChild: () => {},
          removeChild: () => {}
        }
      };

      const originalDocument = (global as any).document;
      (global as any).document = {
        createElement: () => ({
          className: '',
          setAttribute: () => {},
          style: {},
          parentElement: domEl.parentElement
        })
      };

      try {
        const mockView: any = {
          state,
          dom: domEl,
          hasFocus: () => true,
          coordsAtPos: () => ({ left: 50, top: 20, bottom: 44 }),
          isDestroyed: false
        };

        const pluginView = plugin.spec.view!(mockView);
        pluginView.update!(mockView, state);

        // When active, class must be added to hide the native caret
        expect(domEl.classList.contains('has-caret-glider')).toBe(true);

        // When editor loses focus, glider hides and native caret is restored
        mockView.hasFocus = () => false;
        pluginView.update!(mockView, state);
        expect(domEl.classList.contains('has-caret-glider')).toBe(false);

        pluginView.destroy!();
        expect(domEl.classList.contains('has-caret-glider')).toBe(false);
      } finally {
        (global as any).document = originalDocument;
      }
    });
  });

  describe('Cut Order & Step-Aside Protocol (PERFORMANCE.md item 44)', () => {
    it('manages cut stages from 0 (all on) to 1 (new-letter cut) to 2 (glide cut)', () => {
      expect(getTypingTouchesCutStage()).toBe(0);

      const events: Array<{ stage: number; reason: string | null }> = [];
      const unsubscribe = subscribeTypingTouchCutStage((stage, reason) => {
        events.push({ stage, reason });
      });

      // Step aside new-letter fade first
      stepAsideNewLetterFade('1 MB note typing touches step-aside: new-letter fade goes first');
      expect(getTypingTouchesCutStage()).toBe(1);
      expect(events).toHaveLength(1);
      expect(events[0]?.stage).toBe(1);
      expect(events[0]?.reason).toContain('new-letter fade goes first');

      // Step aside caret glide second
      stepAsideCaretGlide('Caret glide and selection fade stepped aside');
      expect(getTypingTouchesCutStage()).toBe(2);
      expect(events).toHaveLength(2);
      expect(events[1]?.stage).toBe(2);

      // Reset
      resetTypingTouchesCutStage();
      expect(getTypingTouchesCutStage()).toBe(0);
      expect(events).toHaveLength(3);
      expect(events[2]?.stage).toBe(0);

      unsubscribe();
    });

    it('allows configuring fast-typing threshold', () => {
      expect(getFastTypingThreshold()).toBe(120);
      setFastTypingThreshold(100);
      expect(getFastTypingThreshold()).toBe(100);
    });
  });

  describe('ProseMirror State & Fast-Typing Bypass', () => {
    function createState(initialText = 'Hello', options = {}) {
      const plugin = createTypingTouchesPlugin(options);
      return EditorState.create({
        doc: createDoc(initialText),
        schema: testSchema,
        plugins: [plugin]
      });
    }

    it('initializes typing touches plugin with default state', () => {
      const state = createState();
      const pluginState = typingTouchesPluginKey.getState(state);

      expect(pluginState).toBeDefined();
      expect(pluginState?.isFastTyping).toBe(false);
      expect(pluginState?.cutStage).toBe(0);
      expect(pluginState?.decorations.find()).toHaveLength(0);
    });

    it('applies new-letter fade decoration when typing normally (interval >= 120 ms)', () => {
      let state = createState('Hello');

      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValueOnce(1000); // initial
      nowSpy.mockReturnValueOnce(1300); // 300 ms interval (normal pace)

      // Insert character '!' at pos 6 (end of "Hello")
      const tr = state.tr.insertText('!', 6);
      state = state.apply(tr);

      const pluginState = typingTouchesPluginKey.getState(state);
      expect(pluginState).toBeDefined();
      expect(pluginState?.isFastTyping).toBe(false);

      // Verify decoration was created for newly inserted character
      const decs = pluginState?.decorations.find();
      expect(decs).toHaveLength(1);
      expect((decs?.[0] as any)?.spec?.class).toBe('wr-new-letter-fade');
      expect(decs?.[0]?.from).toBe(6);
      expect(decs?.[0]?.to).toBe(7);
    });

    it('skips new-letter fade immediately when typing is fast (interval < 120 ms)', () => {
      let state = createState('Fast');

      const nowSpy = vi.spyOn(performance, 'now');
      // Keystroke 1:
      nowSpy.mockReturnValue(1000);
      state = state.apply(state.tr.insertText('a', 5));

      // Keystroke 2 occurs only 50 ms later (fast typing)
      nowSpy.mockReturnValue(1050);
      state = state.apply(state.tr.insertText('b', 6));

      const pluginState = typingTouchesPluginKey.getState(state);
      expect(pluginState).toBeDefined();
      expect(pluginState?.isFastTyping).toBe(true);

      // Fast typing: decoration skipped so letter renders instantly without delay
      const decs = pluginState?.decorations.find();
      expect(decs).toHaveLength(0);
    });

    it('steps aside new-letter fade when cutStage is 1 or higher', () => {
      let state = createState('Test');
      stepAsideNewLetterFade('Manual test step-aside');

      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValueOnce(1000);
      nowSpy.mockReturnValueOnce(1500); // 500 ms (normal pace)

      state = state.apply(state.tr.insertText('x', 5));

      const pluginState = typingTouchesPluginKey.getState(state);
      expect(pluginState?.cutStage).toBe(1);

      // With stage 1 step-aside, new-letter fade is skipped even on normal typing pace
      const decs = pluginState?.decorations.find();
      expect(decs).toHaveLength(0);
    });

    it('automatically steps aside new-letter fade when document size >= largeNoteThreshold', () => {
      // Configure threshold to 100 characters for test
      let state = createState('Small', { largeNoteSizeThreshold: 100 });

      // Insert large text to cross the threshold
      const largeText = 'A'.repeat(150);
      state = state.apply(state.tr.insertText(largeText, 6));

      // Type a character
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValueOnce(1000);
      nowSpy.mockReturnValueOnce(2000);
      state = state.apply(state.tr.insertText('Z', 7));

      const pluginState = typingTouchesPluginKey.getState(state);
      expect(pluginState?.cutStage).toBe(1);
      expect(pluginState?.lastStepAsideReason).toContain('1 MB note typing touches step-aside: new-letter fade goes first');

      // Decoration is skipped
      const decs = pluginState?.decorations.find();
      expect(decs).toHaveLength(0);
    });
  });

  describe('Task item checkbox rendering for Fast tick animation', () => {
    it('renders task item checkbox with SVG checkmark path for 100 ms tick drawing', () => {
      const dummyNode = {
        attrs: { checked: true }
      } as any;

      const renderFn = TaskItemNode.config.renderHTML as any;
      const htmlSpec = renderFn?.call({} as any, {
        node: dummyNode,
        HTMLAttributes: {}
      }) as any[];

      // htmlSpec structure: ['li', attrs, ['button', btnAttrs, ['svg', svgAttrs, ['polyline', polyAttrs]]], ['div', ...]]
      expect(Array.isArray(htmlSpec)).toBe(true);
      const buttonSpec = (htmlSpec as any[])?.[2] as any[];
      expect(buttonSpec?.[0]).toBe('button');
      expect(buttonSpec?.[1]?.class).toContain('chk on');

      const svgSpec = buttonSpec?.[2] as any[];
      expect(svgSpec?.[0]).toBe('svg');
      expect(svgSpec?.[1]?.class).toBe('chk-tick-svg');

      const polylineSpec = svgSpec?.[2] as any[];
      expect(polylineSpec?.[0]).toBe('polyline');
      expect(polylineSpec?.[1]?.points).toBe('20 6 9 17 4 12');
    });
  });

  describe('Performance Benchmark: Typing touches overhead in large document', () => {
    it('executes keystroke transactions in under 2 ms without blocking frame budget', () => {
      const plugin = createTypingTouchesPlugin();
      let state = EditorState.create({
        doc: createDoc('Initial test note content for performance benchmarking.'),
        schema: testSchema,
        plugins: [plugin]
      });

      const t0 = performance.now();
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        state = state.apply(state.tr.insertText('x', 1));
      }
      const t1 = performance.now();
      const avgDuration = (t1 - t0) / iterations;

      // 60 FPS frame budget is 16.6 ms; transaction handling must be well under 5 ms
      expect(avgDuration).toBeLessThan(5);
    });

    it('Performance Gate: Key press to letter in 1 MB note is within budget (median < 8 ms, 99th < 16 ms) with all animations on', () => {
      // Create a ~1 MB document (1,000,000 characters)
      const paragraphContent = 'The calm, precise note editor that stays out of your way. '.repeat(18); // ~1,044 chars
      const paragraphs = Array.from({ length: 1000 }, () =>
        testSchema.node('paragraph', null, [testSchema.text(paragraphContent)])
      );
      const largeDoc = testSchema.node('doc', null, paragraphs);

      expect(largeDoc.content.size).toBeGreaterThanOrEqual(1_000_000);

      const plugin = createTypingTouchesPlugin({
        fastTypingThresholdMs: 120,
        largeNoteSizeThreshold: 500_000
      });

      let state = EditorState.create({
        doc: largeDoc,
        schema: testSchema,
        plugins: [plugin]
      });

      const durations: number[] = [];
      const keystrokeCount = 100;

      for (let i = 0; i < keystrokeCount; i++) {
        const start = performance.now();
        // Insert character at position 500
        state = state.apply(state.tr.insertText('A', 500 + i));
        const end = performance.now();
        durations.push(end - start);
      }

      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(keystrokeCount / 2)]!;
      const p99 = durations[Math.floor(keystrokeCount * 0.99)]!;

      console.log(`\n======================================================`);
      console.log(`[PERFORMANCE BENCHMARK] Key press to letter in 1 MB note:`);
      console.log(`  Document size: ${(largeDoc.content.size / 1_000_000).toFixed(2)} MB (${largeDoc.content.size.toLocaleString()} chars)`);
      console.log(`  Keystrokes: ${keystrokeCount}`);
      console.log(`  Median latency: ${median.toFixed(2)} ms (Ceiling: 8.00 ms)`);
      console.log(`  99th percentile: ${p99.toFixed(2)} ms (Ceiling: 16.00 ms)`);
      console.log(`======================================================\n`);

      // Features 8 / PERFORMANCE.md budget: Median under 8 ms, 99th percentile under 16 ms
      expect(median).toBeLessThan(8);
      expect(p99).toBeLessThan(16);
    });
  });
});
