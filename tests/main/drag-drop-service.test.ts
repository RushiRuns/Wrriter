import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AttachmentService } from '../../src/main/services/attachment-service';
import { SafeWriter } from '../../src/main/services/safe-writer';

describe('Drag and Drop Main Services: AttachmentService and SafeWriter', () => {
  let tempDir: string;
  let vaultRoot: string;
  let externalDir: string;
  let attachmentService: AttachmentService;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wrriter-dnd-test-'));
    vaultRoot = path.join(tempDir, 'vault');
    externalDir = path.join(tempDir, 'external');
    await fs.promises.mkdir(vaultRoot, { recursive: true });
    await fs.promises.mkdir(externalDir, { recursive: true });

    attachmentService = new AttachmentService({
      safeWriter: new SafeWriter()
    });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('inspectPath', () => {
    it('accurately inspects a local file (size, name, isDirectory: false)', async () => {
      const filePath = path.join(externalDir, 'document.pdf');
      await fs.promises.writeFile(filePath, 'PDF-CONTENT-12345');

      const res = await attachmentService.inspectPath(filePath);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.isDirectory).toBe(false);
        expect(res.value.name).toBe('document.pdf');
        expect(res.value.size).toBe(17);
      }
    });

    it('accurately inspects a local directory (isDirectory: true)', async () => {
      const folderPath = path.join(externalDir, 'SubFolder');
      await fs.promises.mkdir(folderPath, { recursive: true });

      const res = await attachmentService.inspectPath(folderPath);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.isDirectory).toBe(true);
        expect(res.value.name).toBe('SubFolder');
      }
    });

    it('returns error when file does not exist', async () => {
      const nonExistent = path.join(externalDir, 'ghost.txt');
      const res = await attachmentService.inspectPath(nonExistent);
      expect(res.ok).toBe(false);
    });
  });

  describe('saveDroppedFile', () => {
    it('copies dropped file into attachments/ leaving the original untouched', async () => {
      const sourceFile = path.join(externalDir, 'photo.png');
      const testBytes = Buffer.from('fake-png-bytes');
      await fs.promises.writeFile(sourceFile, testBytes);

      const res = await attachmentService.saveDroppedFile(vaultRoot, 'Notes/Vacation.md', sourceFile);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.fileName).toBe('photo.png');
        expect(res.value.relativePath).toBe('../attachments/photo.png');
        expect(res.value.isImage).toBe(true);
        expect(res.value.markdown).toBe('![photo.png](../attachments/photo.png)');

        // Verify copied into attachments
        const savedPath = path.join(vaultRoot, 'attachments', 'photo.png');
        expect(fs.existsSync(savedPath)).toBe(true);
        expect(await fs.promises.readFile(savedPath)).toEqual(testBytes);

        // Verify original file is untouched
        expect(fs.existsSync(sourceFile)).toBe(true);
        expect(await fs.promises.readFile(sourceFile)).toEqual(testBytes);
      }
    });

    it('handles name clashes and reuses identical files', async () => {
      const sourceFile1 = path.join(externalDir, 'report.pdf');
      await fs.promises.writeFile(sourceFile1, 'report-version-1');

      const res1 = await attachmentService.saveDroppedFile(vaultRoot, 'Note.md', sourceFile1);
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.value.fileName).toBe('report.pdf');
      }

      // 1. Same file name with different content -> clashes to report 2.pdf
      const sourceFile2 = path.join(externalDir, 'different-dir-report.pdf');
      await fs.promises.writeFile(sourceFile2, 'report-version-2-different');
      // Save under original name report.pdf
      const renamedSource = path.join(externalDir, 'temp', 'report.pdf');
      await fs.promises.mkdir(path.dirname(renamedSource), { recursive: true });
      await fs.promises.writeFile(renamedSource, 'report-version-2-different');

      const res2 = await attachmentService.saveDroppedFile(vaultRoot, 'Note.md', renamedSource);
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.value.fileName).toBe('report 2.pdf');
      }

      // 2. Same file with identical content -> reuses existing without creating duplicate
      const res3 = await attachmentService.saveDroppedFile(vaultRoot, 'Note.md', sourceFile1);
      expect(res3.ok).toBe(true);
      if (res3.ok) {
        expect(res3.value.fileName).toBe('report.pdf');
      }
    });

    it('rejects directories with validation error', async () => {
      const dirPath = path.join(externalDir, 'SomeDir');
      await fs.promises.mkdir(dirPath, { recursive: true });

      const res = await attachmentService.saveDroppedFile(vaultRoot, 'Note.md', dirPath);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe('validation');
      }
    });
  });

  describe('importDroppedPath', () => {
    it('imports dropped .md file as note into target folder', async () => {
      const sourceMd = path.join(externalDir, 'Project Roadmap.md');
      await fs.promises.writeFile(sourceMd, '# Project Roadmap\n\nContent here.');

      const res = await attachmentService.importDroppedPath(vaultRoot, 'Work', sourceMd);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.importedCount).toBe(1);
        expect(res.value.rootName).toBe('Project Roadmap.md');
        expect(res.value.notePath).toBe('Work/Project Roadmap.md');

        const importedPath = path.join(vaultRoot, 'Work', 'Project Roadmap.md');
        expect(fs.existsSync(importedPath)).toBe(true);
        const importedText = await fs.promises.readFile(importedPath, 'utf8');
        expect(importedText).toBe('# Project Roadmap\n\nContent here.');
      }
    });

    it('imports non-markdown file as a new note holding it titled with the file name', async () => {
      const sourcePdf = path.join(externalDir, 'Annual Budget.pdf');
      await fs.promises.writeFile(sourcePdf, 'PDF-BINARY-DATA');

      const res = await attachmentService.importDroppedPath(vaultRoot, 'Finance', sourcePdf);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.importedCount).toBe(1);
        expect(res.value.title).toBe('Annual Budget');
        expect(res.value.notePath).toBe('Finance/Annual Budget.md');

        const notePath = path.join(vaultRoot, 'Finance', 'Annual Budget.md');
        expect(fs.existsSync(notePath)).toBe(true);
        const noteText = await fs.promises.readFile(notePath, 'utf8');
        expect(noteText).toContain('[Annual Budget.pdf](../attachments/Annual%20Budget.pdf)');

        const attachmentPath = path.join(vaultRoot, 'attachments', 'Annual Budget.pdf');
        expect(fs.existsSync(attachmentPath)).toBe(true);
      }
    });

    it('recursively imports dropped folder keeping subfolder structure and notes', async () => {
      const srcFolder = path.join(externalDir, 'ClientDocs');
      const srcSub = path.join(srcFolder, 'Plans');
      await fs.promises.mkdir(srcSub, { recursive: true });

      await fs.promises.writeFile(path.join(srcFolder, 'Overview.md'), '# Client Overview');
      await fs.promises.writeFile(path.join(srcSub, 'Sprint 1.md'), '## Sprint 1 Details');
      await fs.promises.writeFile(path.join(srcSub, 'diagram.png'), 'PNG-DATA');

      const res = await attachmentService.importDroppedPath(vaultRoot, 'Clients', srcFolder);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.importedCount).toBe(3);
        expect(res.value.rootName).toBe('ClientDocs');

        expect(fs.existsSync(path.join(vaultRoot, 'Clients', 'ClientDocs', 'Overview.md'))).toBe(true);
        expect(fs.existsSync(path.join(vaultRoot, 'Clients', 'ClientDocs', 'Plans', 'Sprint 1.md'))).toBe(true);
        expect(fs.existsSync(path.join(vaultRoot, 'Clients', 'ClientDocs', 'Plans', 'diagram.md'))).toBe(true);
        expect(fs.existsSync(path.join(vaultRoot, 'attachments', 'diagram.png'))).toBe(true);
      }
    });
  });
});
