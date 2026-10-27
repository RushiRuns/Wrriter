import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import {
  findMatchesInDoc,
  replaceOneMatch,
  replaceAllMatches,
  type FindOptions
} from '../../src/renderer/editor/find-replace-core';

// Test schema matching TipTap basic document structure
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    codeBlock: { group: 'block', content: 'inline*', attrs: { language: { default: null } } },
    text: { group: 'inline' }
  },
  marks: {
    bold: {},
    italic: {},
    code: {}
  }
});

function createDoc(blocks: Array<{ type: 'paragraph' | 'heading' | 'codeBlock'; text: string; marks?: string[] }>) {
  const nodes = blocks.map((b) => {
    const marks = b.marks ? b.marks.map((m) => testSchema.mark(m)) : [];
    const textNode = b.text ? testSchema.text(b.text, marks) : null;
    return testSchema.node(b.type, null, textNode ? [textNode] : []);
  });
  return testSchema.node('doc', null, nodes);
}

describe('Find and Replace in Note', () => {
  const defaultOptions: FindOptions = { matchCase: false, wholeWord: false };

  describe('Find matching rules', () => {
    it('matches text as shown (not markdown symbols)', () => {
      const doc = createDoc([
        { type: 'heading', text: 'Important project meeting' },
        { type: 'paragraph', text: 'Discussion about project timeline and scope.' }
      ]);

      const res = findMatchesInDoc(doc, 'project', defaultOptions);
      expect(res.totalMatches).toBe(2);
      expect(res.skippedMatches).toBe(0);
      expect(res.matches[0]?.text).toBe('project');
      expect(res.matches[1]?.text).toBe('project');
    });

    it('searches code blocks and inline code', () => {
      const doc = createDoc([
        { type: 'codeBlock', text: 'function calculateTotal(items) { return items.length; }' },
        { type: 'paragraph', text: 'Run the calculateTotal script.' }
      ]);

      const res = findMatchesInDoc(doc, 'calculateTotal', defaultOptions);
      expect(res.totalMatches).toBe(2);
    });

    it('respects matchCase toggle', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'Case Sensitive CASE case' }
      ]);

      const insens = findMatchesInDoc(doc, 'case', { matchCase: false, wholeWord: false });
      expect(insens.totalMatches).toBe(3);

      const sens = findMatchesInDoc(doc, 'case', { matchCase: true, wholeWord: false });
      expect(sens.totalMatches).toBe(1);
    });

    it('respects wholeWord toggle', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'The cat scattered the catalog with a cat' }
      ]);

      const substring = findMatchesInDoc(doc, 'cat', { matchCase: false, wholeWord: false });
      expect(substring.totalMatches).toBe(4); // cat, scattered, catalog, cat

      const whole = findMatchesInDoc(doc, 'cat', { matchCase: false, wholeWord: true });
      expect(whole.totalMatches).toBe(2); // only standalone "cat"
    });
  });

  describe('Protection of wikilinks and pass-through syntax', () => {
    it('highlights matches inside wikilinks but flags them as protected', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'Check the [[Project Plan]] before proceeding.' },
        { type: 'paragraph', text: 'Here is the Project overview.' }
      ]);

      const res = findMatchesInDoc(doc, 'Project', defaultOptions);
      expect(res.totalMatches).toBe(2);
      expect(res.skippedMatches).toBe(1);

      expect(res.matches[0]?.isProtected).toBe(true); // Inside [[Project Plan]]
      expect(res.matches[1]?.isProtected).toBe(false); // Normal text
    });

    it('highlights matches inside pass-through syntax (HTML, math, comments, dataview) as protected', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'Normal secret word.' },
        { type: 'paragraph', text: '<script>alert("secret")</script>' },
        { type: 'paragraph', text: 'Math formula: $$ secret = 1 $$' },
        { type: 'paragraph', text: '%% secret inline comment %%' }
      ]);

      const res = findMatchesInDoc(doc, 'secret', defaultOptions);
      expect(res.totalMatches).toBe(4);
      expect(res.skippedMatches).toBe(3); // 3 protected, 1 normal
      expect(res.matches[0]?.isProtected).toBe(false);
      expect(res.matches[1]?.isProtected).toBe(true);
      expect(res.matches[2]?.isProtected).toBe(true);
      expect(res.matches[3]?.isProtected).toBe(true);
    });

    it('skips protected matches during Replace All and reports skipped count', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'First draft in [[Secret Project]].' },
        { type: 'paragraph', text: 'The Secret strategy is confidential.' }
      ]);

      const state = EditorState.create({ schema: testSchema, doc });
      const findRes = findMatchesInDoc(state.doc, 'Secret', defaultOptions);
      expect(findRes.totalMatches).toBe(2);
      expect(findRes.skippedMatches).toBe(1);

      const tr = state.tr;
      const repRes = replaceAllMatches(tr, testSchema, findRes.matches, 'Public');
      expect(repRes.replacedCount).toBe(1);
      expect(repRes.skippedCount).toBe(1);
      expect(repRes.changed).toBe(true);

      const newDoc = tr.doc;
      // Wikilink unchanged, normal text replaced
      expect(newDoc.child(0).textContent).toBe('First draft in [[Secret Project]].');
      expect(newDoc.child(1).textContent).toBe('The Public strategy is confidential.');
    });

    it('refuses to replace single match if it is protected', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'See [[Secret Doc]].' }
      ]);

      const state = EditorState.create({ schema: testSchema, doc });
      const findRes = findMatchesInDoc(state.doc, 'Secret', defaultOptions);
      expect(findRes.totalMatches).toBe(1);
      expect(findRes.matches[0]?.isProtected).toBe(true);

      const tr = state.tr;
      const ok = replaceOneMatch(tr, testSchema, findRes.matches[0]!, 'Public');
      expect(ok).toBe(false);
      expect(tr.doc.child(0).textContent).toBe('See [[Secret Doc]].');
    });
  });

  describe('Replacement rules', () => {
    it('preserves formatting marks of the first character replaced', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'Important term to replace.', marks: ['bold'] }
      ]);

      const state = EditorState.create({ schema: testSchema, doc });
      const findRes = findMatchesInDoc(state.doc, 'Important', defaultOptions);
      expect(findRes.totalMatches).toBe(1);

      const tr = state.tr;
      replaceOneMatch(tr, testSchema, findRes.matches[0]!, 'Crucial');

      const replacedNode = tr.doc.child(0).child(0);
      expect(replacedNode.text).toBe('Crucial term to replace.');
      expect(replacedNode.marks.some((m) => m.type.name === 'bold')).toBe(true);
    });

    it('replace all is a single undo step', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'word word word' },
        { type: 'paragraph', text: 'another word' }
      ]);

      let state = EditorState.create({
        schema: testSchema,
        doc,
        plugins: [history()]
      });

      const findRes = findMatchesInDoc(state.doc, 'word', defaultOptions);
      expect(findRes.totalMatches).toBe(4);

      const tr = state.tr;
      replaceAllMatches(tr, testSchema, findRes.matches, 'replacement');
      state = state.apply(tr);

      expect(state.doc.child(0).textContent).toBe('replacement replacement replacement');
      expect(state.doc.child(1).textContent).toBe('another replacement');

      // Undo reverts all 4 replacements in ONE step
      const undoTr = state.tr;
      const undone = undo(state, (t) => {
        state = state.apply(t);
      });
      expect(undone).toBe(true);
      expect(state.doc.child(0).textContent).toBe('word word word');
      expect(state.doc.child(1).textContent).toBe('another word');
    });

    it('a replace that changes nothing writes nothing (changed: false)', () => {
      const doc = createDoc([
        { type: 'paragraph', text: 'alpha beta gamma' }
      ]);

      const state = EditorState.create({ schema: testSchema, doc });
      const findRes = findMatchesInDoc(state.doc, 'delta', defaultOptions);
      expect(findRes.totalMatches).toBe(0);

      const tr = state.tr;
      const repRes = replaceAllMatches(tr, testSchema, findRes.matches, 'omega');
      expect(repRes.changed).toBe(false);
      expect(repRes.replacedCount).toBe(0);
      expect(tr.docChanged).toBe(false);
    });
  });

  describe('TipTap FindReplaceExtension Commands Execution (Regression for Mismatched Transaction)', () => {
    it('executes replaceAll without throwing RangeError: Applying a mismatched transaction in TipTap CommandManager flow', async () => {
      const { FindReplaceExtension, findReplacePluginKey } = await import('../../src/renderer/editor/extensions/find-replace-extension');

      const { Plugin } = await import('@tiptap/pm/state');
      const doc = createDoc([
        { type: 'paragraph', text: 'alpha bravo alpha charlie' }
      ]);
      let state = EditorState.create({
        schema: testSchema,
        doc,
        plugins: [
          new Plugin({
            key: findReplacePluginKey,
            state: {
              init: () => ({
                searchTerm: 'alpha',
                matches: findMatchesInDoc(doc, 'alpha', defaultOptions).matches,
                activeIndex: 0,
                skippedMatches: 0
              }),
              apply: (_tr, val) => val
            }
          })
        ]
      });

      const mockEditor: any = {
        state,
        schema: testSchema,
        view: {
          dispatch: (t: any) => {
            state = state.apply(t);
            mockEditor.state = state;
          }
        }
      };

      const commands = (FindReplaceExtension.config.addCommands as any).call({
        editor: mockEditor,
        name: 'findReplace'
      });
      const replaceAllFn = commands.replaceAll('zulu');

      // TipTap CommandManager simulation: initiates tr on current state
      const tr = state.tr;
      const callback = replaceAllFn({
        tr,
        editor: mockEditor,
        dispatch: true,
        state
      });

      // TipTap CommandManager dispatches tr if not prevented
      if (!tr.getMeta('preventDispatch')) {
        mockEditor.view.dispatch(tr);
      }

      expect(callback).toBe(true);
      expect(state.doc.textContent).toBe('zulu bravo zulu charlie');
    });

    it('executes replaceCurrent without throwing RangeError: Applying a mismatched transaction in TipTap CommandManager flow', async () => {
      const { FindReplaceExtension, findReplacePluginKey } = await import('../../src/renderer/editor/extensions/find-replace-extension');

      const { Plugin } = await import('@tiptap/pm/state');
      const doc = createDoc([
        { type: 'paragraph', text: 'one two one three' }
      ]);
      let state = EditorState.create({
        schema: testSchema,
        doc,
        plugins: [
          new Plugin({
            key: findReplacePluginKey,
            state: {
              init: () => ({
                searchTerm: 'one',
                matches: findMatchesInDoc(doc, 'one', defaultOptions).matches,
                activeIndex: 0,
                skippedMatches: 0
              }),
              apply: (_tr, val) => val
            }
          })
        ]
      });

      const mockEditor: any = {
        state,
        schema: testSchema,
        view: {
          dispatch: (t: any) => {
            state = state.apply(t);
            mockEditor.state = state;
          }
        }
      };

      const commands = (FindReplaceExtension.config.addCommands as any).call({
        editor: mockEditor,
        name: 'findReplace'
      });
      const replaceCurrentFn = commands.replaceCurrent('ONE');

      // TipTap CommandManager simulation: initiates tr on current state
      const tr = state.tr;
      const callback = replaceCurrentFn({
        tr,
        editor: mockEditor,
        dispatch: true,
        state
      });

      // TipTap CommandManager dispatches tr if not prevented
      if (!tr.getMeta('preventDispatch')) {
        mockEditor.view.dispatch(tr);
      }

      expect(callback).toBe(true);
      expect(state.doc.textContent).toBe('ONE two one three');
    });
  });

  describe('Performance Gate: 5,000 matches in a 1 MB note in under 1 s', () => {
    it('replaces all 5,000 matches in a 1 MB note in under 1,000 ms (measured and verified)', () => {
      // Construct ~1 MB document with 5,000 matches
      // 5,000 paragraphs, each ~200 characters containing the search word "TARGET_KEYWORD"
      const paragraphs: Array<{ type: 'paragraph'; text: string; marks?: string[] }> = [];
      const filler = 'The quick brown fox jumps over the lazy dog and writes notes with great speed. '; // 79 chars

      for (let i = 0; i < 5000; i++) {
        paragraphs.push({
          type: 'paragraph',
          text: `Paragraph ${i}: ${filler}TARGET_KEYWORD and continuing with ${filler}`,
          marks: i % 5 === 0 ? ['bold'] : undefined
        });
      }

      const doc = createDoc(paragraphs);
      const totalChars = doc.textContent.length;
      expect(totalChars).toBeGreaterThanOrEqual(900_000); // ~1 MB of raw text

      const state = EditorState.create({ schema: testSchema, doc });

      // 1. Measure find
      const findStart = performance.now();
      const findRes = findMatchesInDoc(state.doc, 'TARGET_KEYWORD', defaultOptions);
      const findDuration = performance.now() - findStart;

      expect(findRes.totalMatches).toBe(5000);
      expect(findRes.skippedMatches).toBe(0);

      // 2. Measure replace all
      const replaceStart = performance.now();
      const tr = state.tr;
      const repRes = replaceAllMatches(tr, testSchema, findRes.matches, 'REPLACED_TOKEN');
      const replaceDuration = performance.now() - replaceStart;

      const totalOperationDuration = findDuration + replaceDuration;

      console.log(`\n======================================================`);
      console.log(`[PERFORMANCE BENCHMARK] Find & Replace in 1 MB Note:`);
      console.log(`  Document size: ${(totalChars / (1024 * 1024)).toFixed(2)} MB (${totalChars.toLocaleString()} characters)`);
      console.log(`  Occurrences: 5,000 matches`);
      console.log(`  Find duration: ${findDuration.toFixed(2)} ms`);
      console.log(`  ReplaceAll duration: ${replaceDuration.toFixed(2)} ms`);
      console.log(`  Total duration: ${totalOperationDuration.toFixed(2)} ms (Ceiling: 1,000 ms)`);
      console.log(`======================================================\n`);

      expect(repRes.replacedCount).toBe(5000);
      expect(repRes.changed).toBe(true);
      expect(totalOperationDuration).toBeLessThan(1000); // Must be strictly under 1 s!

      // Verify replacements in result
      const newDoc = tr.doc;
      expect(newDoc.child(0).textContent).toContain('REPLACED_TOKEN');
      expect(newDoc.child(4999).textContent).toContain('REPLACED_TOKEN');
      expect(newDoc.textContent).not.toContain('TARGET_KEYWORD');
    });
  });
});
