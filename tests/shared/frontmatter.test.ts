import { describe, it, expect } from 'vitest';
import { parseFrontmatter, updateFrontmatter, formatCreatedDate } from '../../src/shared/domain/frontmatter';

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

  it('adds frontmatter using list form for new tags key per SCHEMA.md line 123', () => {
    const source = `# Plain Note\n\nNo frontmatter here.`;
    const result = updateFrontmatter(source, { tags: ['ideas', 'wrriter'], status: 'active', created: '2026-10-28T15:30:00' });

    expect(result.startsWith('---\n')).toBe(true);
    expect(result).toContain('tags:\n  - ideas\n  - wrriter\n');
    expect(result).toContain('status: active\n');
    expect(result).toContain('created: 2026-10-28T15:30:00\n');
    expect(result).toContain('# Plain Note\n\nNo frontmatter here.');
  });

  it('preserves existing list form of tags when modifying tags', () => {
    const source = `---
tags:
  - work
  - project
status: draft
---
# Content`;

    const updated = updateFrontmatter(source, { tags: ['work', 'project', 'release'] });
    expect(updated).toContain('tags:\n  - work\n  - project\n  - release\n');
    expect(updated).toContain('status: draft');
  });

  it('preserves existing flow form of tags when modifying tags', () => {
    const source = `---
tags: [work, project]
status: draft
---
# Content`;

    const updated = updateFrontmatter(source, { tags: ['work', 'project', 'release'] });
    expect(updated).toContain('tags: [work, project, release]\n');
    expect(updated).toContain('status: draft');
  });

  it('adds created timestamp without touching other keys', () => {
    const source = `---
tags: [alpha]
status: active
---
# Body`;

    const updated = updateFrontmatter(source, { created: '2026-10-28T12:00:00' });
    expect(updated).toContain('tags: [alpha]');
    expect(updated).toContain('status: active');
    expect(updated).toContain('created: 2026-10-28T12:00:00');
  });

  it('formats creation date in ISO YYYY-MM-DDTHH:mm:ss format', () => {
    const d = new Date(2026, 9, 28, 15, 30, 45); // 2026-10-28 15:30:45
    expect(formatCreatedDate(d)).toBe('2026-10-28T15:30:45');
  });
});
