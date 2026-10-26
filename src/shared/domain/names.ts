/**
 * Domain rules for file and folder names on Windows.
 * Strictly pure logic: no Node.js or DOM imports (ARCHITECTURE.md rule 4).
 */

const WINDOWS_FORBIDDEN_CHARS_PATTERN = /[\\/:*?"<>|]/;
const WINDOWS_FORBIDDEN_CHARS_GLOBAL = /[\\/:*?"<>|]/g;
const TRAILING_DOTS_SPACES_REGEX = /[. ]+$/;

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

export const MAX_FILE_NAME_LENGTH = 100;
export const WINDOWS_MAX_PATH_TRADITIONAL = 260;

/**
 * Checks if a name is a reserved Windows device name (case-insensitive, ignores extension).
 */
export function isReservedWindowsName(name: string): boolean {
  if (!name) return false;
  const base = name.split('.')[0]?.toUpperCase() ?? '';
  return WINDOWS_RESERVED_NAMES.has(base);
}

/**
 * Validates whether a file or folder name is valid on Windows.
 */
export function isValidFileName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  if (name.length > MAX_FILE_NAME_LENGTH) return false;
  if (WINDOWS_FORBIDDEN_CHARS_PATTERN.test(name)) return false;
  if (name.endsWith('.') || name.endsWith(' ')) return false;
  if (isReservedWindowsName(name)) return false;
  return true;
}

/**
 * Returns a user-friendly error message if a file or folder name is invalid on Windows, or null if valid.
 */
export function getFileNameValidationError(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Name cannot be empty';
  }
  if (name.length > MAX_FILE_NAME_LENGTH) {
    return `Name cannot exceed ${MAX_FILE_NAME_LENGTH} characters`;
  }
  if (WINDOWS_FORBIDDEN_CHARS_PATTERN.test(name)) {
    return 'Name cannot contain any of these characters: \\ / : * ? " < > |';
  }
  if (name.endsWith('.') || name.endsWith(' ')) {
    return 'Name cannot end with a period or space';
  }
  if (isReservedWindowsName(name)) {
    return `"${name}" is a reserved device name in Windows`;
  }
  return null;
}

/**
 * Sanitizes an arbitrary title into a safe Windows file name:
 * 1. Strips forbidden characters (\ / : * ? " < > |)
 * 2. Trims leading and trailing whitespace
 * 3. Trims trailing dots
 * 4. Truncates to max 100 characters
 * 5. Handles reserved names by appending a safe suffix
 * 6. Defaults to 'Untitled' if empty
 */
export function sanitizeFileName(title: string): string {
  if (!title) return 'Untitled';

  let clean = title.replace(WINDOWS_FORBIDDEN_CHARS_GLOBAL, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  clean = clean.replace(TRAILING_DOTS_SPACES_REGEX, '');

  if (!clean) {
    clean = 'Untitled';
  }

  // 100-character cap on file name
  if (clean.length > MAX_FILE_NAME_LENGTH) {
    clean = clean.slice(0, MAX_FILE_NAME_LENGTH).replace(TRAILING_DOTS_SPACES_REGEX, '');
  }

  // If reserved name, prepend underscore to ensure valid file creation
  if (isReservedWindowsName(clean)) {
    clean = `_${clean}`;
  }

  return clean;
}

/**
 * Generates clash name: e.g. "Note 2.md", "Groceries 3.md"
 */
export function formatClashName(title: string, index: number, ext = '.md'): string {
  if (index <= 1) return `${title}${ext}`;
  return `${title} ${index}${ext}`;
}

/**
 * Windows case-insensitive name comparison.
 */
export function areNamesEqualCaseInsensitive(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

/**
 * Checks if a relative path is a dot-folder (hidden from view/scan),
 * with the sole exception of the official .wrriter metadata directory.
 */
export function isIgnoredDotPath(relativePath: string): boolean {
  const parts = relativePath.split(/[/\\]/);
  return parts.some(part => part.startsWith('.') && part !== '.wrriter');
}

/**
 * Checks if a path points to the attachments/ directory, which is hidden from the folder tree.
 */
export function isAttachmentsFolder(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  return normalized === 'attachments' || normalized.startsWith('attachments/');
}
