import { describe, it, expect } from 'vitest';
import { planSave, encodeUtf8, decodeUtf8, hasUtf8Bom } from '../../src/shared/markdown/save';
import { blockSplitter } from '../../src/shared/markdown/blocks';

describe('planSave and serializer', () => {
  it('returns unchanged: true when content is not edited', () => {
    const text = '# Note\n\nParagraph 1.\n\nParagraph 2.\n';
    const plan = planSave(text, text);
    expect(plan.unchanged).toBe(true);
    expect(plan.changedBlockCount).toBe(0);
    expect(plan.text).toBe(text);
  });

  it('re-serializes only the edited block while preserving untouched blocks', () => {
    const original = `# Note\n\nFirst paragraph.\n\nSecond paragraph.\n`;
    const edited = `# Note\n\nFirst paragraph EDITED.\n\nSecond paragraph.\n`;

    const plan = planSave(original, edited);
    expect(plan.unchanged).toBe(false);
    expect(plan.changedBlockCount).toBe(1);
    expect(plan.text).toBe(edited);

    const origBlocks = blockSplitter(original);
    const resultBlocks = blockSplitter(plan.text);

    // Block 0 (heading) is untouched
    expect(resultBlocks[0]?.raw).toBe(origBlocks[0]?.raw);
    // Block 1 (blank lines) is untouched
    expect(resultBlocks[1]?.raw).toBe(origBlocks[1]?.raw);
    // Block 2 (paragraph 1) was edited
    expect(resultBlocks[2]?.raw).toBe('First paragraph EDITED.\n');
    // Block 3 & 4 (blank lines and paragraph 2) are untouched
    expect(resultBlocks[3]?.raw).toBe(origBlocks[3]?.raw);
    expect(resultBlocks[4]?.raw).toBe(origBlocks[4]?.raw);
  });

  it('preserves Windows CRLF line endings on edited saves', () => {
    const original = '# Title\r\n\r\nParagraph 1.\r\n\r\nParagraph 2.\r\n';
    const edited = '# Title\r\n\r\nParagraph 1 modified.\r\n\r\nParagraph 2.\r\n';

    const plan = planSave(original, edited);
    expect(plan.lineEnding).toBe('\r\n');
    expect(plan.text.includes('\r\n')).toBe(true);
    expect(plan.text.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('preserves absence of final newline', () => {
    const original = '# Title\n\nNo trailing newline';
    const edited = '# Title\n\nNo trailing newline edited';

    const plan = planSave(original, edited);
    expect(plan.hasFinalNewline).toBe(false);
    expect(plan.text.endsWith('\n')).toBe(false);
    expect(plan.text.endsWith('\r')).toBe(false);
  });

  it('preserves UTF-8 BOM byte sequence (EF BB BF)', () => {
    const text = '# Title\n\nContent.\n';
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const bodyBytes = encodeUtf8(text);
    const withBom = new Uint8Array(bom.length + bodyBytes.length);
    withBom.set(bom, 0);
    withBom.set(bodyBytes, bom.length);

    expect(hasUtf8Bom(withBom)).toBe(true);

    const editedText = '# Title\n\nContent modified.\n';
    const plan = planSave(withBom, editedText);

    expect(plan.hasBom).toBe(true);
    expect(hasUtf8Bom(plan.bytes)).toBe(true);
    expect(decodeUtf8(plan.bytes.subarray(3))).toBe(editedText);
  });
});
