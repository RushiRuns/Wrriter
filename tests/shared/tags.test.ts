import { describe, it, expect } from 'vitest';
import {
  isValidTag,
  cleanTag,
  normalizeTag,
  tagEquals,
  parseTagsInput,
  buildTagTree,
  renameTagInList
} from '../../src/shared/domain/tags';
import { lightIndexNote } from '../../src/shared/markdown/light-index';

describe('Tags domain model (src/shared/domain/tags.ts)', () => {
  it('validates allowed characters: letters, numbers, hyphens, underscores, slashes', () => {
    expect(isValidTag('work')).toBe(true);
    expect(isValidTag('Work')).toBe(true);
    expect(isValidTag('project-alpha')).toBe(true);
    expect(isValidTag('project_2026')).toBe(true);
    expect(isValidTag('work/project/v1')).toBe(true);
    expect(isValidTag('Café/Étude')).toBe(true); // Unicode letters

    // Disallowed
    expect(isValidTag('')).toBe(false);
    expect(isValidTag(' ')).toBe(false);
    expect(isValidTag('has space')).toBe(false);
    expect(isValidTag('tag#with#hash')).toBe(false);
    expect(isValidTag('/leading/slash')).toBe(false);
    expect(isValidTag('trailing/slash/')).toBe(false);
    expect(isValidTag('double//slash')).toBe(false);
    expect(isValidTag('tag?mark')).toBe(false);
    expect(isValidTag('tag!exclamation')).toBe(false);
  });

  it('cleans tags by stripping leading # and trimming slashes', () => {
    expect(cleanTag('#work')).toBe('work');
    expect(cleanTag('###work/alpha')).toBe('work/alpha');
    expect(cleanTag('  /nested/tag/  ')).toBe('nested/tag');
    expect(cleanTag('a///b')).toBe('a/b');
  });

  it('normalizes tags and checks case-insensitive equality', () => {
    expect(normalizeTag('Work')).toBe('work');
    expect(normalizeTag('WORK/PROJECT')).toBe('work/project');
    expect(tagEquals('Work', 'work')).toBe(true);
    expect(tagEquals('Work/Alpha', 'work/alpha')).toBe(true);
    expect(tagEquals('Work', 'Personal')).toBe(false);
  });

  it('parses tag input splitting on spaces and commas ("A space while adding a tag starts the next one")', () => {
    const input = '#Work project-1, client/acme   #tag2';
    const parsed = parseTagsInput(input);
    expect(parsed).toEqual(['Work', 'project-1', 'client/acme', 'tag2']);
  });

  it('deduplicates tags case-insensitively while preserving first spelling', () => {
    const input = 'Work work WORK Personal personal';
    const parsed = parseTagsInput(input);
    expect(parsed).toEqual(['Work', 'Personal']);
  });

  it('builds hierarchical tag tree nested by slash with direct and recursive counts', () => {
    const tagsWithCounts = [
      { tag: 'Work', count: 3 },
      { tag: 'Work/Projects', count: 2 },
      { tag: 'Work/Projects/Beta', count: 4 },
      { tag: 'Personal', count: 5 }
    ];

    const tree = buildTagTree(tagsWithCounts);

    expect(tree).toHaveLength(2);
    // Alphabetical order: Personal, Work
    expect(tree[0]!.name).toBe('Personal');
    expect(tree[0]!.count).toBe(5);
    expect(tree[0]!.totalCount).toBe(5);
    expect(tree[0]!.children).toHaveLength(0);

    expect(tree[1]!.name).toBe('Work');
    expect(tree[1]!.count).toBe(3);
    // Work totalCount: 3 (direct) + 2 (Projects) + 4 (Beta) = 9
    expect(tree[1]!.totalCount).toBe(9);
    expect(tree[1]!.children).toHaveLength(1);

    const projectsNode = tree[1]!.children[0]!;
    expect(projectsNode.name).toBe('Projects');
    expect(projectsNode.tag).toBe('Work/Projects');
    expect(projectsNode.count).toBe(2);
    expect(projectsNode.totalCount).toBe(6); // 2 + 4
    expect(projectsNode.children).toHaveLength(1);

    const betaNode = projectsNode.children[0]!;
    expect(betaNode.name).toBe('Beta');
    expect(betaNode.tag).toBe('Work/Projects/Beta');
    expect(betaNode.count).toBe(4);
    expect(betaNode.totalCount).toBe(4);
  });

  it('renames tags: exact match and namespace children without altering other tags', () => {
    const noteTags = ['Work', 'Work/Projects/Alpha', 'Personal', 'Ideas'];

    // Rename Work -> Office
    const renamed = renameTagInList(noteTags, 'Work', 'Office');
    expect(renamed).toEqual(['Office', 'Office/Projects/Alpha', 'Personal', 'Ideas']);

    // Merge Personal into Office
    const merged = renameTagInList(renamed, 'Personal', 'Office');
    // 'Office' is already present, so Personal is merged and deduplicated
    expect(merged).toEqual(['Office', 'Office/Projects/Alpha', 'Ideas']);
  });

  it('keeps #word in body text as plain text and only indexes tags from frontmatter tags: key', () => {
    const markdown = `---
tags: [VerifiedTag]
---
# Note with #InlineWord

Here is a paragraph with #hashtag and #anotherWord that should remain plain body text.
`;
    const result = lightIndexNote('notes/demo.md', markdown);
    expect(result.tags).toEqual(['VerifiedTag']);
    expect(result.tags).not.toContain('InlineWord');
    expect(result.tags).not.toContain('hashtag');
    expect(result.tags).not.toContain('anotherWord');
  });
});
