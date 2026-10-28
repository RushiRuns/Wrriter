/**
 * Domain rules and helpers for attachments and file chips (M4).
 * Strictly pure logic: no Node.js, Electron, or DOM imports (ARCHITECTURE.md rule 4).
 */

import { isReservedWindowsName, MAX_FILE_NAME_LENGTH } from './names';
import { getParentDir, normalizeSlashes, resolvePosix } from './image-paths';

/**
 * Image extensions supported for inline display in the renderer.
 * Built-in Chromium engine supports PNG, JPEG, GIF, WebP, SVG, BMP, and AVIF.
 * HEIC and every other format is displayed as a file chip.
 */
export const INLINE_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.avif'
]);

/**
 * Returns the file extension including the dot, lowercased (e.g. ".pdf").
 * Returns empty string if no extension exists.
 */
export function getFileExtension(fileNameOrPath: string): string {
  const norm = normalizeSlashes(fileNameOrPath);
  const base = norm.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx).toLowerCase() : '';
}

/**
 * Returns the file name without its extension (e.g. "report.pdf" -> "report").
 */
export function getFileNameWithoutExtension(fileNameOrPath: string): string {
  const norm = normalizeSlashes(fileNameOrPath);
  const base = norm.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(0, idx) : base;
}

/**
 * Checks whether a file or path is an inline image type.
 */
export function isInlineImageExtension(fileNameOrPath: string): boolean {
  const ext = getFileExtension(fileNameOrPath);
  return INLINE_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Returns a short badge string for a file chip (e.g. "PDF", "XLS", "DOC", "HEIC").
 */
export function getFileTypeBadge(fileNameOrPath: string): string {
  const ext = getFileExtension(fileNameOrPath).replace(/^\./, '').toUpperCase();
  if (!ext) return 'FILE';
  if (ext === 'DOCX') return 'DOC';
  if (ext === 'XLSX') return 'XLS';
  if (ext === 'PPTX') return 'PPT';
  if (ext === 'JPEG') return 'JPG';
  return ext;
}

/**
 * Formats a byte size into user-friendly units (e.g. 512 B, 24 KB, 1.2 MB).
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

const WINDOWS_FORBIDDEN_CHARS_GLOBAL = /[\\/:*?"<>|]/g;
const TRAILING_DOTS_SPACES_REGEX = /[. ]+$/;

/**
 * Sanitizes an attachment file name for Windows:
 * - Forbidden characters (\ / : * ? " < > |) are replaced with a hyphen (-).
 * - Trailing periods and spaces before the extension are trimmed.
 * - Windows reserved names (CON, PRN, etc.) receive a leading underscore.
 * - Base name capped at MAX_FILE_NAME_LENGTH (100 characters).
 * - Empty names default to "attachment".
 */
export function sanitizeAttachmentName(originalName: string): string {
  if (!originalName || originalName.trim().length === 0) {
    return 'attachment';
  }

  // Preserve the original extension (case and all)
  const norm = normalizeSlashes(originalName);
  const baseAndExt = norm.split('/').pop() ?? '';
  const dotIdx = baseAndExt.lastIndexOf('.');

  let base = dotIdx >= 0 ? baseAndExt.slice(0, dotIdx) : baseAndExt;
  const ext = dotIdx >= 0 ? baseAndExt.slice(dotIdx) : '';

  // Replace forbidden characters with hyphen
  base = base.replace(WINDOWS_FORBIDDEN_CHARS_GLOBAL, '-');
  // Trim spaces and trailing dots/spaces
  base = base.trim().replace(TRAILING_DOTS_SPACES_REGEX, '');

  if (!base) {
    base = 'attachment';
  }

  if (base.length > MAX_FILE_NAME_LENGTH) {
    base = base.slice(0, MAX_FILE_NAME_LENGTH).replace(TRAILING_DOTS_SPACES_REGEX, '');
  }

  if (isReservedWindowsName(base)) {
    base = `_${base}`;
  }

  return `${base}${ext}`;
}

/**
 * Generates clash name for an attachment: e.g. "report 2.pdf", "report 3.pdf".
 */
export function formatAttachmentClashName(sanitizedName: string, clashIndex: number): string {
  if (clashIndex <= 1) return sanitizedName;

  const dotIdx = sanitizedName.lastIndexOf('.');
  const base = dotIdx >= 0 ? sanitizedName.slice(0, dotIdx) : sanitizedName;
  const ext = dotIdx >= 0 ? sanitizedName.slice(dotIdx) : '';

  return `${base} ${clashIndex}${ext}`;
}

/**
 * Computes relative path from a note to the vault root's `attachments/` folder.
 * e.g. note at root "Note.md" -> "attachments/name.png"
 * e.g. note in "Inbox/Note.md" -> "../attachments/name.png"
 * e.g. note in "Work/Projects/Note.md" -> "../../attachments/name.png"
 */
export function computeAttachmentRelativePath(noteRelPath: string, attachmentFileName: string): string {
  const dir = getParentDir(noteRelPath);
  if (!dir) {
    return `attachments/${attachmentFileName}`;
  }

  const depth = dir.split('/').filter(Boolean).length;
  const upSegments = Array(depth).fill('..').join('/');
  return `${upSegments}/attachments/${attachmentFileName}`;
}

/**
 * Percent-encodes relative path for markdown links while preserving path slashes.
 * e.g. "attachments/report 2.pdf" -> "attachments/report%202.pdf"
 */
export function encodeAttachmentPath(relativePath: string): string {
  return encodeURI(relativePath.replace(/\\/g, '/'));
}

/**
 * Decodes a percent-encoded attachment reference from markdown.
 * e.g. "attachments/report%202.pdf" -> "attachments/report 2.pdf"
 */
export function decodeAttachmentPath(encodedPath: string): string {
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

/**
 * Resolves a note-relative attachment reference back to its vault-relative path.
 * e.g. note "Work/Projects/Note.md" + "../../attachments/report 2.pdf" -> "attachments/report 2.pdf"
 */
export function resolveAttachmentVaultPath(noteRelPath: string, attachmentRef: string): string {
  const decodedRef = decodeAttachmentPath(attachmentRef.trim());
  const noteDir = getParentDir(noteRelPath);
  return resolvePosix(noteDir, decodedRef);
}

/**
 * Formats standard markdown for an attachment:
 * - Inline image: `![alt](encodedPath)`
 * - File chip: `[name](encodedPath)`
 */
export function formatAttachmentMarkdown(
  fileName: string,
  relativePath: string,
  isImage: boolean,
  imageWidth?: number | null,
  imageAlignment?: 'left' | 'center' | 'right'
): string {
  const encodedPath = encodeAttachmentPath(relativePath);
  if (isImage) {
    let descriptor = fileName;
    if (imageWidth) {
      descriptor += `|${imageWidth}`;
      if (imageAlignment && imageAlignment !== 'center') {
        descriptor += `|${imageAlignment}`;
      }
    } else if (imageAlignment && imageAlignment !== 'center') {
      descriptor += `||${imageAlignment}`;
    }
    return `![${descriptor}](${encodedPath})`;
  }
  return `[${fileName}](${encodedPath})`;
}

/**
 * Formats a custom protocol URL for local assets in the active vault.
 */
export function formatVaultAssetUrl(vaultRelPath: string): string {
  const clean = normalizeSlashes(vaultRelPath);
  return `wrriter-vault:///${clean}`;
}
