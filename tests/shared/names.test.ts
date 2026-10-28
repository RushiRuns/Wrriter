import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  isValidFileName,
  isReservedWindowsName,
  formatClashName,
  areNamesEqualCaseInsensitive,
  isIgnoredDotPath,
  isAttachmentsFolder,
  formatQuickNoteTitle,
  formatPastedImageName,
  MAX_FILE_NAME_LENGTH
} from '../../src/shared/domain/names';

describe('Domain: Windows File and Folder Names', () => {
  it('identifies and sanitizes forbidden Windows characters', () => {
    const raw = 'What: "Is" This *File* / <Folder>? | Name';
    const clean = sanitizeFileName(raw);
    expect(clean).toBe('What Is This File Folder Name');
    expect(isValidFileName(clean)).toBe(true);
  });

  it('trims trailing dots and spaces', () => {
    const raw = 'Meeting Notes ...   ';
    const clean = sanitizeFileName(raw);
    expect(clean).toBe('Meeting Notes');
    expect(isValidFileName('Invalid Name...')).toBe(false);
    expect(isValidFileName('Invalid Name ')).toBe(false);
  });

  it('detects and escapes Windows reserved names', () => {
    expect(isReservedWindowsName('CON')).toBe(true);
    expect(isReservedWindowsName('con.md')).toBe(true);
    expect(isReservedWindowsName('aux')).toBe(true);
    expect(isReservedWindowsName('NUL.txt')).toBe(true);
    expect(isReservedWindowsName('COM1')).toBe(true);
    expect(isReservedWindowsName('LPT9')).toBe(true);
    expect(isReservedWindowsName('Ordinary')).toBe(false);

    const safeCon = sanitizeFileName('CON');
    expect(safeCon).toBe('_CON');
    expect(isValidFileName(safeCon)).toBe(true);
  });

  it('caps file names at 100 characters while preserving words', () => {
    const longTitle = 'A'.repeat(150);
    const clean = sanitizeFileName(longTitle);
    expect(clean.length).toBe(MAX_FILE_NAME_LENGTH);
  });

  it('formats clash numbers consistently', () => {
    expect(formatClashName('Groceries', 1)).toBe('Groceries.md');
    expect(formatClashName('Groceries', 2)).toBe('Groceries 2.md');
    expect(formatClashName('Groceries', 10)).toBe('Groceries 10.md');
  });

  it('compares file names without regard to case (Windows semantics)', () => {
    expect(areNamesEqualCaseInsensitive('Notes.md', 'notes.md')).toBe(true);
    expect(areNamesEqualCaseInsensitive('PROJECTS', 'projects')).toBe(true);
    expect(areNamesEqualCaseInsensitive('FileA.md', 'FileB.md')).toBe(false);
  });

  it('filters dot-folders except for .wrriter', () => {
    expect(isIgnoredDotPath('.git/config')).toBe(true);
    expect(isIgnoredDotPath('.obsidian/app.json')).toBe(true);
    expect(isIgnoredDotPath('.stfolder')).toBe(true);
    expect(isIgnoredDotPath('.stversions/note.md')).toBe(true);
    expect(isIgnoredDotPath('.wrriter/vault.json')).toBe(false);
    expect(isIgnoredDotPath('.wrriter/order.json')).toBe(false);
    expect(isIgnoredDotPath('Notes/Work/.wrriter/order.json')).toBe(false);
    expect(isIgnoredDotPath('Notes/Work/Project.md')).toBe(false);
  });

  it('hides attachments/ folder from folder tree', () => {
    expect(isAttachmentsFolder('attachments')).toBe(true);
    expect(isAttachmentsFolder('attachments/image.png')).toBe(true);
    expect(isAttachmentsFolder('Personal/Notes')).toBe(false);
  });

  it('generates Windows-safe quick note title with dot instead of colon', () => {
    const fixedDate = new Date(2026, 9, 28, 14, 30); // 2026-10-28 14:30
    const title = formatQuickNoteTitle(fixedDate);
    expect(title).toBe('Quick note 2026-10-28 14.30');
    expect(isValidFileName(`${title}.md`)).toBe(true);
  });

  it('generates timestamped pasted image name', () => {
    const fixedDate = new Date(2026, 9, 28, 14, 30, 45);
    const img = formatPastedImageName(fixedDate);
    expect(img).toBe('Pasted image 20261028-143045.png');
    expect(isValidFileName(img)).toBe(true);
  });
});
