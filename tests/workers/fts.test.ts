import { describe, it, expect } from 'vitest';
import { ftsEscape } from '../../src/workers/index/fts';

describe('ftsEscape (src/workers/index/fts.ts)', () => {
  it('returns empty string on empty or whitespace queries', () => {
    expect(ftsEscape('')).toBe('');
    expect(ftsEscape('   ')).toBe('');
  });

  it('escapes single and multiple search tokens for prefix search', () => {
    expect(ftsEscape('meet')).toBe('"meet"*');
    expect(ftsEscape('meet plan')).toBe('"meet"* "plan"*');
  });

  it('escapes special FTS5 operators and punctuation safely', () => {
    expect(ftsEscape('foo:bar')).toBe('"foo:bar"*');
    expect(ftsEscape('NOT OR AND')).toBe('"NOT"* "OR"* "AND"*');
    expect(ftsEscape('"quoted"')).toBe('"quoted"*');
    expect(ftsEscape('nested"quote')).toBe('"nested""quote"*');
    expect(ftsEscape('***')).toBe('');
  });
});
