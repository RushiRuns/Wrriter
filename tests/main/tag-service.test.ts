import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TagService } from '../../src/main/services/tag-service';
import { JobService } from '../../src/main/services/job-service';
import { JobsStore } from '../../src/main/store/jobs-store';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';

describe('TagService & Tag Jobs (src/main/services/tag-service.ts)', () => {
  let tempDir: string;
  let vaultDir: string;
  let appDataDir: string;
  let safeWriter: SafeWriter;
  let vaultReader: VaultReader;
  let jobsStore: JobsStore;
  let jobService: JobService;
  let tagService: TagService;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wrriter-tag-test-'));
    vaultDir = path.join(tempDir, 'vault');
    appDataDir = path.join(tempDir, 'appData');
    await fs.promises.mkdir(vaultDir, { recursive: true });
    await fs.promises.mkdir(appDataDir, { recursive: true });

    safeWriter = new SafeWriter();
    vaultReader = new VaultReader();
    jobsStore = new JobsStore(appDataDir, safeWriter);
    jobService = new JobService(jobsStore);
    tagService = new TagService({
      jobService,
      vaultReader,
      safeWriter
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('aggregates tags with counts preserving first spelling across vault notes', async () => {
    // Note 1: Work, Project/Alpha
    await fs.promises.writeFile(
      path.join(vaultDir, 'note1.md'),
      `---
tags:
  - Work
  - Project/Alpha
status: wip
---
# Note 1
`
    );

    // Note 2: work (different casing, should match Work), Personal
    await fs.promises.writeFile(
      path.join(vaultDir, 'note2.md'),
      `---
tags: [work, Personal]
---
# Note 2
`
    );

    // Note 3: Project/Alpha
    await fs.promises.writeFile(
      path.join(vaultDir, 'note3.md'),
      `---
tags:
  - Project/Alpha
---
# Note 3
`
    );

    const countsRes = await tagService.getTagsWithCounts(vaultDir);
    expect(countsRes.ok).toBe(true);
    if (!countsRes.ok) return;

    const counts = countsRes.value;
    // Personal (1), Project/Alpha (2), Work (2)
    const personal = counts.find((c) => c.tag.toLowerCase() === 'personal');
    expect(personal).toBeDefined();
    expect(personal?.count).toBe(1);

    const projectAlpha = counts.find((c) => c.tag.toLowerCase() === 'project/alpha');
    expect(projectAlpha).toBeDefined();
    expect(projectAlpha?.count).toBe(2);

    const work = counts.find((c) => c.tag.toLowerCase() === 'work');
    expect(work).toBeDefined();
    expect(work?.count).toBe(2);
    // Preserves first spelling 'Work'
    expect(work?.tag).toBe('Work');
  });

  it('finds notes containing a tag or child namespace', async () => {
    await fs.promises.writeFile(
      path.join(vaultDir, 'parent.md'),
      `---
tags: [Engineering]
---
# Parent
`
    );

    await fs.promises.writeFile(
      path.join(vaultDir, 'child.md'),
      `---
tags: [Engineering/Frontend]
---
# Child
`
    );

    await fs.promises.writeFile(
      path.join(vaultDir, 'unrelated.md'),
      `---
tags: [Marketing]
---
# Unrelated
`
    );

    const paths = await tagService.getNotePathsWithTag(vaultDir, 'Engineering');
    expect(paths).toContain('parent.md');
    expect(paths).toContain('child.md');
    expect(paths).not.toContain('unrelated.md');

    const count = await tagService.getNotesCountForTag(vaultDir, 'Engineering');
    expect(count).toBe(2);
  });

  it('renames a tag across notes as a persistent job touching ONLY the tags key', async () => {
    const note1Original = `---
# Top comment
tags:
  - Architecture
  - Planning
status: in-progress
aliases: [SystemArch]
created: 2026-10-28T12:00:00
---
# Note 1 Body
Some content with #Planning in body that should stay untouched.
`;

    const note2Original = `---
tags: [Architecture/Core, Design]
---
# Note 2
`;

    await fs.promises.writeFile(path.join(vaultDir, 'note1.md'), note1Original);
    await fs.promises.writeFile(path.join(vaultDir, 'note2.md'), note2Original);

    const res = await tagService.renameTag('vault-1', vaultDir, 'Architecture', 'Platform');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.affectedCount).toBe(2);

    const note1After = await fs.promises.readFile(path.join(vaultDir, 'note1.md'), 'utf8');
    const note2After = await fs.promises.readFile(path.join(vaultDir, 'note2.md'), 'utf8');

    // Note 1: Architecture renamed to Platform, while status, aliases, created, comments, and body are preserved byte-for-byte
    expect(note1After).toContain('Platform');
    expect(note1After).toContain('# Top comment');
    expect(note1After).toContain('status: in-progress');
    expect(note1After).toContain('aliases: [SystemArch]');
    expect(note1After).toContain('created: 2026-10-28T12:00:00');
    expect(note1After).toContain('Some content with #Planning in body that should stay untouched.');

    // Note 2: Architecture/Core renamed to Platform/Core
    expect(note2After).toContain('Platform/Core');
    expect(note2After).toContain('Design');
  });

  it('merges tags when target tag already exists in note without duplicating', async () => {
    const note = `---
tags:
  - Legacy
  - Modern
---
# Dual Tag
`;
    await fs.promises.writeFile(path.join(vaultDir, 'dual.md'), note);

    const res = await tagService.renameTag('vault-1', vaultDir, 'Legacy', 'Modern');
    expect(res.ok).toBe(true);

    const content = await fs.promises.readFile(path.join(vaultDir, 'dual.md'), 'utf8');
    // Modern should appear only once (merged)
    const modernMatches = content.match(/Modern/g);
    expect(modernMatches?.length).toBe(1);
  });
});
