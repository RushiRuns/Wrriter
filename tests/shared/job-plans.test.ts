import { describe, it, expect } from 'vitest';
import {
  computeRelativePosix,
  resolvePosix,
  rebaseRelativeImagePath,
  rewriteFolderPrefix,
  rewriteImageHrefsInText
} from '../../src/shared/domain/image-paths';
import {
  planNoteRenameLinks,
  planFolderRenameLinks,
  planNoteMoveLinks,
  planTagRename
} from '../../src/shared/domain/job-plans';

describe('Image Paths domain (src/shared/domain/image-paths.ts)', () => {
  it('computes relative posix paths between directories', () => {
    expect(computeRelativePosix('Work', 'Work/attachments/pic.png')).toBe('attachments/pic.png');
    expect(computeRelativePosix('Work/Projects', 'Work/attachments/pic.png')).toBe('../attachments/pic.png');
    expect(computeRelativePosix('Archive', 'Work/Doc.md')).toBe('../Work/Doc.md');
    expect(computeRelativePosix('Folder', 'Folder')).toBe('');
  });

  it('resolves relative posix paths', () => {
    expect(resolvePosix('Work/Projects', '../attachments/hero.png')).toBe('Work/attachments/hero.png');
    expect(resolvePosix('', 'attachments/hero.png')).toBe('attachments/hero.png');
  });

  it('rebases relative image paths when a note is moved', () => {
    // Note moves from "Work" to "Work/Archive", referencing "attachments/pic.png"
    const rebased = rebaseRelativeImagePath('Work', 'Work/Archive', 'attachments/pic.png');
    expect(rebased).toBe('../attachments/pic.png');

    // Note moves from "Work/Sub" to root "", referencing "../pic.png"
    const rebasedRoot = rebaseRelativeImagePath('Work/Sub', '', '../pic.png');
    expect(rebasedRoot).toBe('Work/pic.png');

    // External URLs stay untouched
    expect(rebaseRelativeImagePath('Work', 'Personal', 'https://example.com/pic.png')).toBe('https://example.com/pic.png');
    expect(rebaseRelativeImagePath('Work', 'Personal', 'data:image/png;base64,123')).toBe('data:image/png;base64,123');
  });

  it('rewrites folder prefix in paths', () => {
    expect(rewriteFolderPrefix('Projects/Alpha/doc.md', 'Projects/Alpha', 'Projects/Beta')).toBe('Projects/Beta/doc.md');
    expect(rewriteFolderPrefix('Other/doc.md', 'Projects/Alpha', 'Projects/Beta')).toBe('Other/doc.md');
  });

  it('rewrites image hrefs in markdown text', () => {
    const text = 'Here is an image: ![Hero Banner](attachments/hero.png) and another ![Photo|400|center](pic.jpg).';
    const res = rewriteImageHrefsInText(text, (href) => `new/${href}`);
    expect(res.changed).toBe(true);
    expect(res.newText).toBe('Here is an image: ![Hero Banner](new/attachments/hero.png) and another ![Photo|400|center](new/pic.jpg).');
  });
});

describe('Job Plans domain (src/shared/domain/job-plans.ts)', () => {
  it('rewrites plain and path-style wikilinks on note rename, preserving headings and aliases', () => {
    const text = `
# Summary
See [[OldNote]] for introduction.
Check [[OldNote|alias text]] and [[OldNote#Architecture]].
Also [[OldNote#Milestone 1|M1 Plan]].
And path-style: [[Folder/OldNote]] and [[Folder/OldNote#Spec|Specification]].
Unknown block reference [[OldNote#^block-id]] must stay untouched!
Image embed ![[OldNote.png]] must stay untouched!
    `;

    const res = planNoteRenameLinks(text, {
      oldTitle: 'OldNote',
      newTitle: 'NewNote',
      oldPath: 'Folder/OldNote',
      newPath: 'Folder/NewNote'
    });

    expect(res.changed).toBe(true);
    expect(res.newText).toContain('See [[NewNote]] for introduction.');
    expect(res.newText).toContain('Check [[NewNote|alias text]]');
    expect(res.newText).toContain('[[NewNote#Architecture]]');
    expect(res.newText).toContain('[[NewNote#Milestone 1|M1 Plan]]');
    expect(res.newText).toContain('[[Folder/NewNote]]');
    expect(res.newText).toContain('[[Folder/NewNote#Spec|Specification]]');

    // Unknown block links and embeds stay untouched
    expect(res.newText).toContain('[[OldNote#^block-id]]');
    expect(res.newText).toContain('![[OldNote.png]]');
  });

  it('rewrites vault markdown links on note rename', () => {
    const text = 'Read the [Old Spec](Folder/OldNote.md) or [Simple](OldNote.md).';
    const res = planNoteRenameLinks(text, {
      oldTitle: 'OldNote',
      newTitle: 'NewNote',
      oldPath: 'Folder/OldNote',
      newPath: 'Folder/NewNote'
    });

    expect(res.changed).toBe(true);
    expect(res.newText).toBe('Read the [Old Spec](Folder/NewNote.md) or [Simple](NewNote.md).');
  });

  it('rewrites path-style wikilinks and relative image paths on folder rename', () => {
    const text = `
See [[Projects/Alpha/Roadmap#Q4|Launch]].
Look at ![Diagram](Projects/Alpha/attachments/arch.png).
Markdown note link: [Doc](Projects/Alpha/Doc.md).
Unrelated [[Other/Doc]] stays unchanged.
    `;

    const res = planFolderRenameLinks(text, {
      oldFolderRelPath: 'Projects/Alpha',
      newFolderRelPath: 'Projects/Beta'
    });

    expect(res.changed).toBe(true);
    expect(res.newText).toContain('See [[Projects/Beta/Roadmap#Q4|Launch]].');
    expect(res.newText).toContain('![Diagram](Projects/Beta/attachments/arch.png)');
    expect(res.newText).toContain('[Doc](Projects/Beta/Doc.md)');
    expect(res.newText).toContain('[[Other/Doc]]');
  });

  it('rewrites path-style links in other notes and image paths in moved note on note move', () => {
    // In another note:
    const otherNoteText = 'Check [[OldDir/Doc#H1|Link]]';
    const otherRes = planNoteMoveLinks(otherNoteText, {
      oldNoteRelPath: 'OldDir/Doc.md',
      newNoteRelPath: 'NewDir/Doc.md'
    }, false);

    expect(otherRes.changed).toBe(true);
    expect(otherRes.newText).toBe('Check [[NewDir/Doc#H1|Link]]');

    // In the moved note itself:
    const movedNoteText = '# Header\n![Hero](attachments/pic.png)';
    const movedRes = planNoteMoveLinks(movedNoteText, {
      oldNoteRelPath: 'OldDir/Doc.md',
      newNoteRelPath: 'NewDir/Doc.md'
    }, true);

    expect(movedRes.changed).toBe(true);
    expect(movedRes.newText).toBe('# Header\n![Hero](../OldDir/attachments/pic.png)');
  });

  it('rewrites tags in note frontmatter for tag.rename jobs', () => {
    const text = `---
tags: [dev, release/v1, ideas]
status: draft
---
# Note Content
`;
    const res = planTagRename(text, {
      oldTag: 'release/v1',
      newTag: 'release/v2'
    });

    expect(res.changed).toBe(true);
    expect(res.newText).toContain('release/v2');
    expect(res.newText).not.toContain('release/v1');
    expect(res.newText).toContain('status: draft');
    expect(res.newText).toContain('# Note Content');
  });
});
