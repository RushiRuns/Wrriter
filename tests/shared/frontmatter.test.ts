import { describe, it, expect } from 'vitest';
import { parseFrontmatter, updateFrontmatter } from '../../src/shared/domain/frontmatter';

describe('frontmatter parser and surgical updater', () => {
  it('parses frontmatter tags, status, created and unowned keys', () => {
    const source = `---
# Top comment
title: Note Title
tags: [alpha, beta/sub]
status: active
created: 2026-10-26
aliases:
  - Alias One
  - Alias Two
custom_field: 42
---
# Body Title

Content body.`;

    const parsed = parseFrontmatter(source);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.isBroken).toBe(false);
    expect(parsed.tags).toEqual(['alpha', 'beta/sub']);
    expect(parsed.status).toBe('active');
    expect(parsed.created).toBe('2026-10-26');
    expect(parsed.unownedKeys.get('title')).toBe('Note Title');
    expect(parsed.unownedKeys.get('custom_field')).toBe('42');
  });

  it('marks malformed frontmatter as isBroken without crashing', () => {
    const broken = `---
tags: [unclosed bracket
status: broken
---
Body text`;

    const parsed = parseFrontmatter(broken);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.isBroken).toBe(true);
    expect(parsed.tags).toEqual([]);
  });

  it('surgically updates status while keeping comments, order, and unowned keys byte-for-byte', () => {
    const original = `---
# Important header comment
title: Note Title
tags: [project, core]
status: draft
# Comments before unowned key
aliases:
  - My Note
custom_val: 100
---
Paragraph text.`;

    const updated = updateFrontmatter(original, { status: 'reviewed' });

    expect(updated).toContain('# Important header comment');
    expect(updated).toContain('title: Note Title');
    expect(updated).toContain('tags: [project, core]');
    expect(updated).toContain('status: reviewed');
    expect(updated).toContain('# Comments before unowned key');
    expect(updated).toContain('aliases:\n  - My Note');
    expect(updated).toContain('custom_val: 100');

    // Confirm that other keys were not changed
    expect(updated.replace('status: reviewed', 'status: draft')).toBe(original);
  });

  it('leaves file completely untouched when updating broken frontmatter', () => {
    const broken = `---
tags: [unclosed
status: invalid
---
Body`;

    const result = updateFrontmatter(broken, { status: 'new-status' });
    expect(result).toBe(broken);
  });

  it('adds frontmatter when note previously had none', () => {
    const source = `# Plain Note\n\nNo frontmatter here.`;
    const result = updateFrontmatter(source, { tags: ['ideas', 'wrriter'], status: 'active' });

    expect(result.startsWith('---\n')).toBe(true);
    expect(result).toContain('tags: [ideas, wrriter]\n');
    expect(result).toContain('status: active\n');
    expect(result).toContain('# Plain Note\n\nNo frontmatter here.');
  });
});
