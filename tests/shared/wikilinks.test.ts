import { describe, it, expect } from 'vitest';
import {
  parseWikilinkContent,
  extractWikilinksWithLines,
  formatWikilink,
  rewriteWikilinkTarget,
  isUnknownWikilink
} from '../../src/shared/domain/wikilinks';
import { resolveLink, resolveMarkdownLink, type NoteReference } from '../../src/shared/domain/links';

describe('Wikilinks domain model (src/shared/domain/wikilinks.ts)', () => {
  it('parses plain note wikilink [[Note]]', () => {
    const parsed = parseWikilinkContent('Note');
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe('Note');
    expect(parsed?.noteName).toBe('Note');
    expect(parsed?.displayText).toBe('Note');
    expect(parsed?.heading).toBeUndefined();
    expect(parsed?.alias).toBeUndefined();
  });

  it('parses note with alias [[Note|Custom Display Text]]', () => {
    const parsed = parseWikilinkContent('Note|Custom Display Text');
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe('Note');
    expect(parsed?.alias).toBe('Custom Display Text');
    expect(parsed?.displayText).toBe('Custom Display Text');
  });

  it('parses note with heading [[Note#Project Scope]]', () => {
    const parsed = parseWikilinkContent('Note#Project Scope');
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe('Note');
    expect(parsed?.heading).toBe('Project Scope');
    expect(parsed?.displayText).toBe('Note > Project Scope');
  });

  it('parses note with heading and alias [[Note#Heading|Display Text]]', () => {
    const parsed = parseWikilinkContent('Note#Heading|Display Text');
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe('Note');
    expect(parsed?.heading).toBe('Heading');
    expect(parsed?.alias).toBe('Display Text');
    expect(parsed?.displayText).toBe('Display Text');
  });

  it('parses disambiguated path [[Folder/Note]]', () => {
    const parsed = parseWikilinkContent('Folder/Sub/Note');
    expect(parsed).not.toBeNull();
    expect(parsed?.target).toBe('Folder/Sub/Note');
    expect(parsed?.folder).toBe('Folder/Sub');
    expect(parsed?.noteName).toBe('Note');
  });

  it('rejects unknown forms such as block links [[Note#^id]] and leaves them null', () => {
    expect(isUnknownWikilink('Note#^abc123')).toBe(true);
    expect(parseWikilinkContent('Note#^abc123')).toBeNull();
  });

  it('extracts wikilinks with line snippets while ignoring embeds ![[pic.png]]', () => {
    const markdown = `
# Meeting

Discussed architecture with [[Alice]] on Tuesday.
See also [[Projects/Launch#Milestone 3|M3 Deliverables]] for full details.
Here is an image ![[attachments/hero.png]] that should not be extracted.
And an unsupported block link [[Note#^block-id]] that stays plain text.
`;

    const extracted = extractWikilinksWithLines(markdown);
    expect(extracted).toHaveLength(2);

    expect(extracted[0]!.link.target).toBe('Alice');
    expect(extracted[0]!.lineText).toBe('Discussed architecture with [[Alice]] on Tuesday.');

    expect(extracted[1]!.link.target).toBe('Projects/Launch');
    expect(extracted[1]!.link.heading).toBe('Milestone 3');
    expect(extracted[1]!.link.alias).toBe('M3 Deliverables');
    expect(extracted[1]!.lineText).toBe('See also [[Projects/Launch#Milestone 3|M3 Deliverables]] for full details.');
  });

  it('rewrites wikilink target while preserving heading and alias', () => {
    expect(rewriteWikilinkTarget('[[OldNote]]', 'NewNote')).toBe('[[NewNote]]');
    expect(rewriteWikilinkTarget('[[OldNote#Heading]]', 'NewNote')).toBe('[[NewNote#Heading]]');
    expect(rewriteWikilinkTarget('[[OldNote#Heading|Custom]]', 'NewNote')).toBe('[[NewNote#Heading|Custom]]');
    expect(rewriteWikilinkTarget('[[OldFolder/Note|Alias]]', 'NewFolder/Note')).toBe('[[NewFolder/Note|Alias]]');
  });
});

describe('Link resolution (src/shared/domain/links.ts)', () => {
  const vaultNotes: NoteReference[] = [
    { path: 'Work/Projects/Weekly.md', title: 'Weekly', modified: 1000 },
    { path: 'Personal/Weekly.md', title: 'Weekly', modified: 2000 },
    { path: 'Archive/Old.md', title: 'Old', modified: 500 },
    { path: 'Standalone.md', title: 'Standalone', modified: 3000 }
  ];

  it('resolves plain link to note in the same folder first', () => {
    // In Work/Projects/Status.md linking to [[Weekly]]: resolves to Work/Projects/Weekly.md
    const resolved = resolveLink('Weekly', 'Work/Projects/Status.md', vaultNotes);
    expect(resolved.resolved).toBe(true);
    expect(resolved.path).toBe('Work/Projects/Weekly.md');
    expect(resolved.isMissing).toBe(false);
  });

  it('resolves plain link to the most recently modified note when not in same folder', () => {
    // In Other/Note.md linking to [[Weekly]]: resolves to Personal/Weekly.md (mtime 2000 > 1000)
    const resolved = resolveLink('Weekly', 'Other/Note.md', vaultNotes);
    expect(resolved.resolved).toBe(true);
    expect(resolved.path).toBe('Personal/Weekly.md');
    expect(resolved.isMissing).toBe(false);
  });

  it('resolves explicit path-style link [[Folder/Note]]', () => {
    const resolved = resolveLink('Work/Projects/Weekly', 'Other/Note.md', vaultNotes);
    expect(resolved.resolved).toBe(true);
    expect(resolved.path).toBe('Work/Projects/Weekly.md');
  });

  it('flags missing note when candidate does not exist in vault', () => {
    const resolved = resolveLink('UncreatedNote', 'Work/Note.md', vaultNotes);
    expect(resolved.resolved).toBe(false);
    expect(resolved.isMissing).toBe(true);
    expect(resolved.targetName).toBe('UncreatedNote');
  });

  it('resolves standard markdown link to .md file in the vault', () => {
    const resolved = resolveMarkdownLink('../Projects/Weekly.md', 'Work/Archive/Notes.md', vaultNotes);
    expect(resolved).not.toBeNull();
    expect(resolved?.resolved).toBe(true);
    expect(resolved?.path).toBe('Work/Projects/Weekly.md');

    // External web link returns null
    expect(resolveMarkdownLink('https://example.com/doc.md', 'Work/Note.md', vaultNotes)).toBeNull();
  });

  it('keeps unknown forms such as [[Note#^id]] as plain text, byte for byte', async () => {
    const { parseInlineMarkdown, serializeInlineNodes } = await import('../../src/renderer/editor/markdown-converter');
    const input = 'This has an unknown [[Note#^block123]] and a valid [[ValidNote]].';
    const parsed = parseInlineMarkdown(input);

    // The unknown form must be a plain text node with no wikilink mark
    const unknownNode = parsed.find((n) => n.text?.includes('[[Note#^block123]]'));
    expect(unknownNode).toBeDefined();
    expect(unknownNode?.marks).toBeUndefined();

    // The valid link must have a wikilink mark
    const validNode = parsed.find((n) => n.marks?.some((m) => m.type === 'wikilink'));
    expect(validNode).toBeDefined();

    // Round-trip back to markdown
    const serialized = serializeInlineNodes(parsed);
    expect(serialized).toBe(input);
  });
});
