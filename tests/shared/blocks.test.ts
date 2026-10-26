import { describe, it, expect } from 'vitest';
import { blockSplitter } from '../../src/shared/markdown/blocks';

describe('blockSplitter', () => {
  it('returns empty array for empty string', () => {
    expect(blockSplitter('')).toEqual([]);
  });

  it('preserves exact source bytes invariant: concat(blocks.raw) === source', () => {
    const markdown = `# Title

First paragraph with **bold** and *italic*.

- List item 1
- List item 2
  - Sub-item

> Blockquote line 1
> Blockquote line 2

\`\`\`typescript
const x = 42;
console.log(x);
\`\`\`

| Col 1 | Col 2 |
| ----- | ----- |
| Val 1 | Val 2 |

---

$$
e = mc^2
$$

%%
Comment block
%%

Final paragraph.`;

    const blocks = blockSplitter(markdown);
    expect(blocks.length).toBeGreaterThan(0);
    const reassembled = blocks.map((b) => b.raw).join('');
    expect(reassembled).toBe(markdown);
  });

  it('correctly tags frontmatter when present on line 1', () => {
    const source = `---
title: Test
tags: [one, two]
---
# Heading

Content here.`;

    const blocks = blockSplitter(source);
    expect(blocks[0]?.type).toBe('frontmatter');
    expect(blocks[0]?.raw).toBe(`---
title: Test
tags: [one, two]
---
`);
    expect(blocks.map((b) => b.raw).join('')).toBe(source);
  });

  it('preserves Windows CRLF line endings in block slices', () => {
    const source = '# Heading\r\n\r\nParagraph 1.\r\n\r\nParagraph 2.\r\n';
    const blocks = blockSplitter(source);
    expect(blocks.map((b) => b.raw).join('')).toBe(source);
    expect(blocks[0]?.raw).toBe('# Heading\r\n');
  });

  it('handles loose lists with interleaved blank lines', () => {
    const source = `- Item 1

- Item 2

- Item 3`;

    const blocks = blockSplitter(source);
    expect(blocks.map((b) => b.raw).join('')).toBe(source);
  });
});
