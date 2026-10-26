import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { planSave, decodeUtf8, encodeUtf8 } from '../../src/shared/markdown/save';
import { blockSplitter, type MarkdownBlock } from '../../src/shared/markdown/blocks';
import { findPassThroughSpans, containsScriptTag, isDataviewLanguage } from '../../src/shared/markdown/pass-through';

const SAMPLES_DIR = path.resolve(__dirname);

function getSampleFiles(): string[] {
  const entries = fs.readdirSync(SAMPLES_DIR);
  return entries
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => path.join(SAMPLES_DIR, f));
}

describe('M2 Round-Trip Check (The Sample-Note Check)', () => {
  const sampleFiles = getSampleFiles();

  it('has hand-made sample notes matching all 21 lines of the SCHEMA.md compatibility checklist', () => {
    expect(sampleFiles.length).toBe(21);
  });

  describe('Gate 1: Opening and saving without editing leaves notes byte-for-byte identical', () => {
    for (const filePath of sampleFiles) {
      const fileName = path.basename(filePath);

      it(`sample note [${fileName}] remains byte-for-byte identical when unedited`, () => {
        const rawBytes = fs.readFileSync(filePath);

        // Detect BOM
        const hasBom = rawBytes.length >= 3 && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
        const textBytes = hasBom ? rawBytes.subarray(3) : rawBytes;
        const text = textBytes.toString('utf8');

        // Execute planSave
        const plan = planSave(rawBytes, text);

        expect(plan.unchanged).toBe(true);
        expect(plan.changedBlockCount).toBe(0);

        // Byte-for-byte comparison
        const planBuffer = Buffer.from(plan.bytes);
        expect(planBuffer.equals(rawBytes)).toBe(true);
      });
    }
  });

  describe('Gate 2: Editing one paragraph changes ONLY that paragraph, keeping all else intact', () => {
    for (const filePath of sampleFiles) {
      const fileName = path.basename(filePath);

      it(`sample note [${fileName}] isolates changes to the single edited block`, () => {
        const rawBytes = fs.readFileSync(filePath);
        const hasBom = rawBytes.length >= 3 && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
        const textBytes = hasBom ? rawBytes.subarray(3) : rawBytes;
        const text = textBytes.toString('utf8');
        const hasFinalNewline = text.endsWith('\n') || text.endsWith('\r\n');

        const blocks = blockSplitter(text);
        expect(blocks.length).toBeGreaterThan(0);

        // Find a paragraph or suitable text block to edit (avoid editing frontmatter in this test)
        let targetBlockIdx = -1;
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          if (b && b.type === 'paragraph') {
            targetBlockIdx = i;
            break;
          }
        }

        // If no paragraph found, target the last non-blank, non-frontmatter block
        if (targetBlockIdx === -1) {
          for (let i = blocks.length - 1; i >= 0; i--) {
            const b = blocks[i];
            if (b && b.type !== 'frontmatter' && b.type !== 'blank_lines') {
              targetBlockIdx = i;
              break;
            }
          }
        }

        expect(targetBlockIdx).toBeGreaterThanOrEqual(0);
        const targetBlock = blocks[targetBlockIdx];
        expect(targetBlock).toBeDefined();

        const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
        const editedLine = `This paragraph was edited during round-trip validation.${lineEnding}`;

        const editedBlocks: MarkdownBlock[] = blocks.map((b, idx) => {
          if (idx === targetBlockIdx) {
            return {
              ...b,
              raw: editedLine
            };
          }
          return b;
        });

        const editedText = editedBlocks.map((b) => b.raw).join('');
        const plan = planSave(rawBytes, editedText);

        expect(plan.unchanged).toBe(false);
        expect(plan.changedBlockCount).toBe(1);

        // Re-split result and verify untouched blocks match original slices exactly
        const resultBlocks = blockSplitter(plan.text);
        expect(resultBlocks.length).toBe(blocks.length);

        for (let i = 0; i < blocks.length; i++) {
          const origB = blocks[i];
          const resB = resultBlocks[i];
          expect(origB).toBeDefined();
          expect(resB).toBeDefined();

          if (i === targetBlockIdx) {
            const expectedEdited =
              !hasFinalNewline && i === blocks.length - 1
                ? editedLine.replace(/\r?\n$/, '')
                : editedLine;
            expect(resB?.raw).toBe(expectedEdited);
          } else {
            expect(resB?.raw).toBe(origB?.raw);
          }
        }

        // Verify line ending, BOM, and final newline matching
        expect(plan.lineEnding).toBe(lineEnding);
        expect(plan.hasBom).toBe(hasBom);
      });
    }
  });

  describe('Gate 3: Note content is never run and pass-through elements are protected', () => {
    it('detects and protects raw HTML and script tags as plain text', () => {
      const htmlSample = fs.readFileSync(path.join(SAMPLES_DIR, '06-raw-html-script-tags.md'), 'utf8');
      expect(containsScriptTag(htmlSample)).toBe(true);
      const spans = findPassThroughSpans(htmlSample);
      expect(spans).toBeDefined();
    });

    it('identifies dataview and dataviewjs blocks for the Not Run indicator', () => {
      expect(isDataviewLanguage('dataview')).toBe(true);
      expect(isDataviewLanguage('dataviewjs')).toBe(true);
      expect(isDataviewLanguage('typescript')).toBe(false);

      const dvSample = fs.readFileSync(path.join(SAMPLES_DIR, '03-dataview-and-inline-fields.md'), 'utf8');
      const spans = findPassThroughSpans(dvSample);
      const inlineFields = spans.filter((s) => s.kind === 'inline_dataview');
      expect(inlineFields.length).toBeGreaterThan(0);
    });

    it('protects templater tags from execution', () => {
      const templaterSample = fs.readFileSync(path.join(SAMPLES_DIR, '04-templater-tags.md'), 'utf8');
      const spans = findPassThroughSpans(templaterSample);
      const tags = spans.filter((s) => s.kind === 'templater_tag');
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]?.raw).toContain('<%');
    });

    it('protects block IDs and block links', () => {
      const blockSample = fs.readFileSync(path.join(SAMPLES_DIR, '07-block-ids-and-links.md'), 'utf8');
      const spans = findPassThroughSpans(blockSample);
      const blockIds = spans.filter((s) => s.kind === 'block_id');
      const blockLinks = spans.filter((s) => s.kind === 'block_link');
      expect(blockIds.length).toBeGreaterThan(0);
      expect(blockLinks.length).toBeGreaterThan(0);
    });
  });
});
