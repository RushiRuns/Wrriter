import { describe, it, expect } from 'vitest';
import {
  isInlineImageExtension,
  getFileExtension,
  getFileNameWithoutExtension,
  getFileTypeBadge,
  formatFileSize,
  sanitizeAttachmentName,
  formatAttachmentClashName,
  computeAttachmentRelativePath,
  encodeAttachmentPath,
  decodeAttachmentPath,
  resolveAttachmentVaultPath,
  formatAttachmentMarkdown,
  formatVaultAssetUrl
} from '../../src/shared/domain/attachments';

describe('Domain: Attachments & File Chips', () => {
  it('correctly classifies inline images vs file chips', () => {
    // Inline images: PNG, JPEG, GIF, WebP, SVG, BMP, AVIF
    expect(isInlineImageExtension('photo.png')).toBe(true);
    expect(isInlineImageExtension('image.jpg')).toBe(true);
    expect(isInlineImageExtension('GRAPHIC.JPEG')).toBe(true);
    expect(isInlineImageExtension('animation.gif')).toBe(true);
    expect(isInlineImageExtension('modern.webp')).toBe(true);
    expect(isInlineImageExtension('vector.svg')).toBe(true);
    expect(isInlineImageExtension('legacy.bmp')).toBe(true);
    expect(isInlineImageExtension('banner.avif')).toBe(true);

    // HEIC and all other types are file chips
    expect(isInlineImageExtension('photo.heic')).toBe(false);
    expect(isInlineImageExtension('PHOTO.HEIC')).toBe(false);
    expect(isInlineImageExtension('document.pdf')).toBe(false);
    expect(isInlineImageExtension('spreadsheet.xlsx')).toBe(false);
    expect(isInlineImageExtension('presentation.pptx')).toBe(false);
    expect(isInlineImageExtension('archive.zip')).toBe(false);
    expect(isInlineImageExtension('music.mp3')).toBe(false);
  });

  it('extracts extensions and base names cleanly', () => {
    expect(getFileExtension('report.pdf')).toBe('.pdf');
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    expect(getFileExtension('no-ext')).toBe('');
    expect(getFileNameWithoutExtension('report.pdf')).toBe('report');
    expect(getFileNameWithoutExtension('folder/sub/report.pdf')).toBe('report');
    expect(getFileNameWithoutExtension('no-ext')).toBe('no-ext');
  });

  it('determines appropriate badge abbreviations for file chips', () => {
    expect(getFileTypeBadge('document.pdf')).toBe('PDF');
    expect(getFileTypeBadge('data.xlsx')).toBe('XLS');
    expect(getFileTypeBadge('letter.docx')).toBe('DOC');
    expect(getFileTypeBadge('slides.pptx')).toBe('PPT');
    expect(getFileTypeBadge('bundle.zip')).toBe('ZIP');
    expect(getFileTypeBadge('photo.heic')).toBe('HEIC');
    expect(getFileTypeBadge('unknown')).toBe('FILE');
  });

  it('formats file sizes in human-readable units', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(55 * 1024)).toBe('55 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(2.3 * 1024 * 1024 * 1024)).toBe('2.3 GB');
  });

  it('sanitizes attachment names according to Windows rules', () => {
    // Forbidden characters replaced with hyphen
    const raw = 'quarterly:report*2026?"draft"|<final>.pdf';
    const clean = sanitizeAttachmentName(raw);
    expect(clean).toBe('quarterly-report-2026--draft---final-.pdf');
    expect(clean.includes(':')).toBe(false);
    expect(clean.includes('*')).toBe(false);
    expect(clean.includes('?')).toBe(false);
    expect(clean.includes('"')).toBe(false);
    expect(clean.includes('<')).toBe(false);
    expect(clean.includes('>')).toBe(false);
    expect(clean.includes('|')).toBe(false);

    // Trims trailing dots and spaces before extension
    expect(sanitizeAttachmentName('meeting notes...  .docx')).toBe('meeting notes.docx');

    // Escapes Windows reserved names with leading underscore
    expect(sanitizeAttachmentName('CON.pdf')).toBe('_CON.pdf');
    expect(sanitizeAttachmentName('aux.txt')).toBe('_aux.txt');

    // Handles empty name
    expect(sanitizeAttachmentName('')).toBe('attachment');
    expect(sanitizeAttachmentName('   ')).toBe('attachment');
  });

  it('formats attachment clash names correctly', () => {
    expect(formatAttachmentClashName('report.pdf', 1)).toBe('report.pdf');
    expect(formatAttachmentClashName('report.pdf', 2)).toBe('report 2.pdf');
    expect(formatAttachmentClashName('report.pdf', 5)).toBe('report 5.pdf');
    expect(formatAttachmentClashName('image.png', 3)).toBe('image 3.png');
    expect(formatAttachmentClashName('plainfile', 2)).toBe('plainfile 2');
  });

  it('computes relative paths from various note locations', () => {
    // Note at vault root
    expect(computeAttachmentRelativePath('Note.md', 'pic.png')).toBe('attachments/pic.png');
    expect(computeAttachmentRelativePath('', 'pic.png')).toBe('attachments/pic.png');

    // Note in single subfolder (e.g. Inbox)
    expect(computeAttachmentRelativePath('Inbox/Note.md', 'pic.png')).toBe('../attachments/pic.png');

    // Note in nested subfolders
    expect(computeAttachmentRelativePath('Work/Projects/Note.md', 'report.pdf')).toBe('../../attachments/report.pdf');
    expect(computeAttachmentRelativePath('A/B/C/Note.md', 'file.zip')).toBe('../../../attachments/file.zip');
  });

  it('percent-encodes and decodes relative attachment paths', () => {
    const rawRel = '../attachments/report 2.pdf';
    const encoded = encodeAttachmentPath(rawRel);
    expect(encoded).toBe('../attachments/report%202.pdf');

    const decoded = decodeAttachmentPath(encoded);
    expect(decoded).toBe(rawRel);
  });

  it('resolves note-relative attachment references to vault paths', () => {
    expect(resolveAttachmentVaultPath('Note.md', 'attachments/pic.png')).toBe('attachments/pic.png');
    expect(resolveAttachmentVaultPath('Inbox/Note.md', '../attachments/pic.png')).toBe('attachments/pic.png');
    expect(resolveAttachmentVaultPath('Work/Projects/Note.md', '../../attachments/report%202.pdf')).toBe('attachments/report 2.pdf');
  });

  it('formats standard markdown for inline images and file chips', () => {
    // Inline image
    expect(formatAttachmentMarkdown('pic.png', 'attachments/pic.png', true)).toBe('![pic.png](attachments/pic.png)');
    expect(formatAttachmentMarkdown('pic 2.png', '../attachments/pic 2.png', true)).toBe('![pic 2.png](../attachments/pic%202.png)');

    // Image with width and alignment
    expect(formatAttachmentMarkdown('pic.png', 'attachments/pic.png', true, 400, 'center')).toBe('![pic.png|400](attachments/pic.png)');
    expect(formatAttachmentMarkdown('pic.png', 'attachments/pic.png', true, 500, 'right')).toBe('![pic.png|500|right](attachments/pic.png)');

    // File chip
    expect(formatAttachmentMarkdown('report 2.pdf', '../attachments/report 2.pdf', false)).toBe('[report 2.pdf](../attachments/report%202.pdf)');
  });

  it('formats vault asset URLs for the custom protocol', () => {
    expect(formatVaultAssetUrl('attachments/photo.png')).toBe('wrriter-vault:///attachments/photo.png');
    expect(formatVaultAssetUrl('attachments\\photo.png')).toBe('wrriter-vault:///attachments/photo.png');
  });
});
