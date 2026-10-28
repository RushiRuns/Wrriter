import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AttachmentService } from '../../src/main/services/attachment-service';
import { SafeWriter } from '../../src/main/services/safe-writer';

describe('Main: AttachmentService', () => {
  let tempDir: string;
  let vaultRoot: string;
  let safeWriter: SafeWriter;
  let attachmentService: AttachmentService;
  let openedPaths: string[];
  let revealedPaths: string[];

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wrriter-attachment-test-'));
    vaultRoot = path.join(tempDir, 'vault');
    await fs.promises.mkdir(vaultRoot, { recursive: true });

    openedPaths = [];
    revealedPaths = [];

    safeWriter = new SafeWriter();
    attachmentService = new AttachmentService({
      safeWriter,
      shellOpenPath: async (p) => {
        openedPaths.push(p);
        return '';
      },
      shellShowItemInFolder: (p) => {
        revealedPaths.push(p);
      }
    });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  });

  it('saves an attachment into attachments/ and returns formatted markdown', async () => {
    const buffer = Buffer.from('hello attachment world', 'utf8');
    const res = await attachmentService.saveAttachment(
      vaultRoot,
      'Note.md',
      'spec.pdf',
      buffer
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.fileName).toBe('spec.pdf');
    expect(res.value.relativePath).toBe('attachments/spec.pdf');
    expect(res.value.encodedPath).toBe('attachments/spec.pdf');
    expect(res.value.isImage).toBe(false);
    expect(res.value.markdown).toBe('[spec.pdf](attachments/spec.pdf)');

    const diskPath = path.join(vaultRoot, 'attachments', 'spec.pdf');
    expect(fs.existsSync(diskPath)).toBe(true);
    expect(fs.readFileSync(diskPath, 'utf8')).toBe('hello attachment world');
  });

  it('reuses an identical file if the same content already exists in attachments/', async () => {
    const buffer = Buffer.from('identical binary payload', 'utf8');

    // First save
    const res1 = await attachmentService.saveAttachment(
      vaultRoot,
      'Note.md',
      'contract.pdf',
      buffer
    );
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.value.fileName).toBe('contract.pdf');

    // Second save under a different requested name with identical buffer
    const res2 = await attachmentService.saveAttachment(
      vaultRoot,
      'OtherNote.md',
      'another_name.pdf',
      buffer
    );
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;

    // Must reuse the existing file name and not write another file
    expect(res2.value.fileName).toBe('contract.pdf');

    const filesInAttachments = await fs.promises.readdir(path.join(vaultRoot, 'attachments'));
    expect(filesInAttachments.filter((f) => !f.startsWith('.'))).toEqual(['contract.pdf']);
  });

  it('adds clash numbers when a file of the same name exists with different content', async () => {
    const buf1 = Buffer.from('version 1', 'utf8');
    const buf2 = Buffer.from('version 2 (different)', 'utf8');
    const buf3 = Buffer.from('version 3 (also different)', 'utf8');

    const res1 = await attachmentService.saveAttachment(vaultRoot, 'Note.md', 'budget.xlsx', buf1);
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.value.fileName).toBe('budget.xlsx');

    const res2 = await attachmentService.saveAttachment(vaultRoot, 'Note.md', 'budget.xlsx', buf2);
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.value.fileName).toBe('budget 2.xlsx');
    expect(res2.value.markdown).toBe('[budget 2.xlsx](attachments/budget%202.xlsx)');

    const res3 = await attachmentService.saveAttachment(vaultRoot, 'Note.md', 'budget.xlsx', buf3);
    expect(res3.ok).toBe(true);
    if (!res3.ok) return;
    expect(res3.value.fileName).toBe('budget 3.xlsx');
  });

  it('replaces Windows forbidden characters with hyphens', async () => {
    const buffer = Buffer.from('test', 'utf8');
    const res = await attachmentService.saveAttachment(
      vaultRoot,
      'Note.md',
      'report:annual*2026?.pdf',
      buffer
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.fileName).toBe('report-annual-2026-.pdf');
    expect(fs.existsSync(path.join(vaultRoot, 'attachments', 'report-annual-2026-.pdf'))).toBe(true);
  });

  it('computes relative paths correctly from subfolder notes', async () => {
    const buffer = Buffer.from('subfolder note test', 'utf8');
    const res = await attachmentService.saveAttachment(
      vaultRoot,
      'Work/Projects/Doc.md',
      'diagram.png',
      buffer
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.relativePath).toBe('../../attachments/diagram.png');
    expect(res.value.isImage).toBe(true);
    expect(res.value.markdown).toBe('![diagram.png](../../attachments/diagram.png)');
  });

  it('saves pasted images with Pasted image YYYYMMDD-HHmmss.png convention', async () => {
    const buffer = Buffer.from('fake png image bytes', 'utf8');
    const res = await attachmentService.savePastedImage(
      vaultRoot,
      'Inbox/Quick.md',
      buffer
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.fileName).toMatch(/^Pasted image \d{8}-\d{6}\.png$/);
    expect(res.value.isImage).toBe(true);
    expect(res.value.relativePath).toMatch(/^\.\.\/attachments\/Pasted image \d{8}-\d{6}\.png$/);
  });

  it('reports attachment info for existing and missing files', async () => {
    const buffer = Buffer.from('some file data for info', 'utf8');
    await attachmentService.saveAttachment(vaultRoot, 'Note.md', 'archive.zip', buffer);

    // Existing file info
    const infoRes = await attachmentService.getAttachmentInfo(
      vaultRoot,
      'Note.md',
      'attachments/archive.zip'
    );
    expect(infoRes.ok).toBe(true);
    if (!infoRes.ok) return;

    expect(infoRes.value.exists).toBe(true);
    expect(infoRes.value.fileName).toBe('archive.zip');
    expect(infoRes.value.fileType).toBe('ZIP');
    expect(infoRes.value.size).toBe(buffer.length);
    expect(infoRes.value.formattedSize).toBe(`${buffer.length} B`);

    // Missing file info
    const missRes = await attachmentService.getAttachmentInfo(
      vaultRoot,
      'Note.md',
      'attachments/non_existent.pdf'
    );
    expect(missRes.ok).toBe(true);
    if (!missRes.ok) return;

    expect(missRes.value.exists).toBe(false);
    expect(missRes.value.fileName).toBe('non_existent.pdf');
    expect(missRes.value.fileType).toBe('PDF');
  });

  it('opens and reveals attachments in explorer while enforcing vault boundaries', async () => {
    const buffer = Buffer.from('open me', 'utf8');
    await attachmentService.saveAttachment(vaultRoot, 'Note.md', 'manual.pdf', buffer);

    const openRes = await attachmentService.openAttachment(
      vaultRoot,
      'Note.md',
      'attachments/manual.pdf'
    );
    expect(openRes.ok).toBe(true);
    expect(openedPaths.length).toBe(1);
    expect(openedPaths[0]).toBe(path.join(vaultRoot, 'attachments', 'manual.pdf'));

    const showRes = await attachmentService.showInExplorer(
      vaultRoot,
      'Note.md',
      'attachments/manual.pdf'
    );
    expect(showRes.ok).toBe(true);
    expect(revealedPaths.length).toBe(1);
    expect(revealedPaths[0]).toBe(path.join(vaultRoot, 'attachments', 'manual.pdf'));

    // Boundary violation rejection
    const escapeRes = await attachmentService.openAttachment(
      vaultRoot,
      'Note.md',
      '../../../../Windows/System32/cmd.exe'
    );
    expect(escapeRes.ok).toBe(false);
  });
});
