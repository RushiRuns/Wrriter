/**
 * Image and attachment relative path calculation and rewriting (M3 Jobs).
 * Pure domain logic (no Node or DOM imports).
 */

/**
 * Normalises backslashes to forward slashes and trims leading/trailing slashes.
 */
export function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Returns directory path of a relative file path.
 * e.g. "Work/Projects/Note.md" -> "Work/Projects"
 * e.g. "Note.md" -> ""
 */
export function getParentDir(p: string): string {
  const norm = normalizeSlashes(p);
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}

/**
 * Computes a relative path from `fromDir` to `toPath` using POSIX path segments.
 */
export function computeRelativePosix(fromDir: string, toPath: string): string {
  const normFrom = normalizeSlashes(fromDir);
  const normTo = normalizeSlashes(toPath);

  if (!normFrom) return normTo;
  if (normFrom === normTo) return '';

  const fromParts = normFrom.split('/').filter(Boolean);
  const toParts = normTo.split('/').filter(Boolean);

  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const upCount = fromParts.length - common;
  const upSegments = Array(upCount).fill('..');
  const downSegments = toParts.slice(common);

  const resultParts = [...upSegments, ...downSegments];
  return resultParts.join('/');
}

/**
 * Resolves a relative path from a base directory.
 * e.g. resolvePosix("Folder/Sub", "../attachments/img.png") -> "Folder/attachments/img.png"
 */
export function resolvePosix(baseDir: string, relPath: string): string {
  const normBase = normalizeSlashes(baseDir);
  const normRel = relPath.replace(/\\/g, '/');

  if (normRel.startsWith('/')) {
    return normalizeSlashes(normRel);
  }

  const baseParts = normBase ? normBase.split('/').filter(Boolean) : [];
  const relParts = normRel.split('/').filter(Boolean);

  const stack = [...baseParts];
  for (const part of relParts) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}

/**
 * Checks whether an image target is an external web URL or data URI.
 */
export function isExternalUrl(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  return /^(https?:\/\/|data:|file:\/\/|wrriter-vault:\/\/)/i.test(target.trim());
}

/**
 * Re-bases a relative image/attachment path when its source note moves from `oldDir` to `newDir`.
 * If the target is an external URL, it is returned unchanged.
 */
export function rebaseRelativeImagePath(
  oldDir: string,
  newDir: string,
  targetPath: string
): string {
  if (!targetPath || isExternalUrl(targetPath)) {
    return targetPath;
  }

  const normOld = normalizeSlashes(oldDir);
  const normNew = normalizeSlashes(newDir);

  if (normOld === normNew) {
    return targetPath;
  }

  // 1. Resolve absolute vault target from oldDir
  const absoluteVaultTarget = resolvePosix(normOld, targetPath);

  // 2. Compute relative path from newDir to absoluteVaultTarget
  const newRelative = computeRelativePosix(normNew, absoluteVaultTarget);
  return newRelative;
}

/**
 * Rewrites folder segment in a path.
 * e.g. rewriteFolderPrefix("Projects/Alpha/doc.md", "Projects/Alpha", "Projects/Beta") -> "Projects/Beta/doc.md"
 */
export function rewriteFolderPrefix(
  filePath: string,
  oldFolder: string,
  newFolder: string
): string {
  const normPath = normalizeSlashes(filePath);
  const normOld = normalizeSlashes(oldFolder);
  const normNew = normalizeSlashes(newFolder);

  if (normPath === normOld) {
    return normNew;
  }

  if (normPath.startsWith(`${normOld}/`)) {
    return `${normNew}/${normPath.slice(normOld.length + 1)}`;
  }

  return filePath;
}

/**
 * Rewrites markdown image tags `![alt](href)` in text using a path rewriter.
 */
export function rewriteImageHrefsInText(
  text: string,
  rewriter: (rawHref: string) => string
): { changed: boolean; newText: string } {
  if (!text || typeof text !== 'string') {
    return { changed: false, newText: text };
  }

  // Regex matching ![alt](href)
  const imgRegex = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
  let changed = false;

  const newText = text.replace(imgRegex, (fullMatch, alt, href) => {
    const trimmedHref = href.trim();
    const updatedHref = rewriter(trimmedHref);
    if (updatedHref !== trimmedHref) {
      changed = true;
      return `![${alt}](${updatedHref})`;
    }
    return fullMatch;
  });

  return { changed, newText };
}
