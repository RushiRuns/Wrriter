import { describe, it, expect } from 'vitest';
import { lightIndexNote } from '../../src/shared/markdown/light-index';

describe('lightIndexer (src/shared/markdown/light-index.ts)', () => {
  it('extracts frontmatter tags, status, created, title, preview and image', () => {
    const markdown = `---
tags: [Work, Project/Alpha, work]
status: active
created: 2026-10-28T14:30
---
# Launch Strategy

This is the opening paragraph of our launch strategy.

![Banner](attachments/hero.png)

Check out [[Architecture]] and [[Ideas|Great Ideas]] as well as [[Work/Meeting#Discussion]].
Also embed ![[logo.png]] should not count as note wikilink.
`;

    const res = lightIndexNote('Work/Launch.md', markdown);

    expect(res.title).toBe('Launch Strategy');
    expect(res.folder).toBe('Work');
    // Tags: case-insensitive deduplication, first spelling preserved
    expect(res.tags).toEqual(['Work', 'Project/Alpha']);
    expect(res.status).toBe('active');
    expect(res.created).toBe('2026-10-28T14:30');
    expect(res.hasFrontmatter).toBe(true);
    expect(res.preview).toBe('This is the opening paragraph of our launch strategy.');
    expect(res.coverPath).toBe('attachments/hero.png');
    // Wikilinks extracted, embed ![[logo.png]] ignored
    expect(res.wikilinks).toContain('Architecture');
    expect(res.wikilinks).toContain('Ideas');
    expect(res.wikilinks).toContain('Work/Meeting');
    expect(res.wikilinks).not.toContain('logo.png');
  });

  it('handles note without frontmatter and derives fallback title if first line is empty', () => {
    const markdown = `

Just some text without any heading.
Link to [[Daily Notes]].
`;
    const res = lightIndexNote('Notes/Untitled.md', markdown);
    expect(res.title).toBe('Just some text without any heading.');
    expect(res.folder).toBe('Notes');
    expect(res.tags).toEqual([]);
    expect(res.status).toBeNull();
    expect(res.created).toBeNull();
    expect(res.hasFrontmatter).toBe(false);
    expect(res.wikilinks).toEqual(['Daily Notes']);
  });

  it('handles broken frontmatter safely without crashing', () => {
    const markdown = `---
tags: [broken unclosed tag
status: wip
---
# Note with Broken Frontmatter
Content here.
`;
    const res = lightIndexNote('broken.md', markdown);
    expect(res.hasFrontmatter).toBe(true);
    // Broken frontmatter treated as having empty tags and status per SCHEMA.md
    expect(res.tags).toEqual([]);
    expect(res.status).toBeNull();
    expect(res.title).toBe('Note with Broken Frontmatter');
  });
});
