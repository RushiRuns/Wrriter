/**
 * Job plans domain logic (M3 Jobs that keep links working).
 * Pure domain functions calculating what changes across notes.
 */

import { parseWikilinkContent, formatWikilink, isUnknownWikilink } from './wikilinks';
import {
  rebaseRelativeImagePath,
  rewriteFolderPrefix,
  rewriteImageHrefsInText,
  getParentDir,
  normalizeSlashes
} from './image-paths';
import { parseFrontmatter, updateFrontmatter } from './frontmatter';
import { renameTagInList } from './tags';

export interface NoteRenameJobParams {
  readonly oldTitle: string;
  readonly newTitle: string;
  readonly oldPath: string; // Relative path without .md, e.g. "Work/OldNote"
  readonly newPath: string; // Relative path without .md, e.g. "Work/NewNote"
}

export interface FolderRenameJobParams {
  readonly oldFolderRelPath: string; // e.g. "Projects/Alpha"
  readonly newFolderRelPath: string; // e.g. "Projects/Beta"
}

export interface NoteMoveJobParams {
  readonly oldNoteRelPath: string; // e.g. "Work/Note.md"
  readonly newNoteRelPath: string; // e.g. "Archive/Note.md"
}

export interface TagRenameJobParams {
  readonly oldTag: string;
  readonly newTag: string;
}

/**
 * Rewrites wikilinks in text matching a target name or target path.
 * Only the link target is rewritten; display text (|alias) and headings (#heading) are preserved.
 * Unknown forms such as [[Note#^id]] and embeds ![[...]] are kept byte for byte.
 */
export function planNoteRenameLinks(
  text: string,
  params: NoteRenameJobParams
): { changed: boolean; newText: string } {
  if (!text || typeof text !== 'string') {
    return { changed: false, newText: text };
  }

  const normOldTitle = params.oldTitle.toLowerCase().trim();
  const normOldPath = normalizeSlashes(params.oldPath).toLowerCase();
  const normNewTitle = params.newTitle.trim();
  const normNewPath = normalizeSlashes(params.newPath);

  let changed = false;

  // 1. Rewrite wikilinks [[...]]
  // Regex matches [[...]] NOT preceded by '!'
  const wikiRegex = /(^|[^!])\[\[([^\]\n]+)\]\]/g;

  let intermediateText = text.replace(wikiRegex, (fullMatch, prefix, inner) => {
    // Check if inner is an unknown form like #^id
    if (isUnknownWikilink(inner)) {
      return fullMatch;
    }

    const parsed = parseWikilinkContent(inner);
    if (!parsed) {
      return fullMatch;
    }

    const targetLower = parsed.target.toLowerCase();
    const noteNameLower = parsed.noteName.toLowerCase();

    let newTarget: string | null = null;

    if (targetLower === normOldPath) {
      // Path-style link: [[Folder/OldNote]] -> [[Folder/NewNote]]
      newTarget = normNewPath;
    } else if (noteNameLower === normOldTitle) {
      // Plain link or disambiguated note name: [[OldNote]] -> [[NewNote]]
      if (parsed.folder) {
        newTarget = `${parsed.folder}/${normNewTitle}`;
      } else {
        newTarget = normNewTitle;
      }
    }

    if (newTarget !== null && newTarget !== parsed.target) {
      changed = true;
      const formatted = formatWikilink(newTarget, {
        heading: parsed.heading,
        alias: parsed.alias
      });
      return `${prefix}${formatted}`;
    }

    return fullMatch;
  });

  // 2. Rewrite vault markdown links [text](oldPath.md)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)\n]+)\)/g;
  const oldMdFile = `${normOldPath}.md`;
  const oldFileName = `${normOldTitle}.md`;

  const newText = intermediateText.replace(mdLinkRegex, (fullMatch, linkText, href) => {
    const cleanHref = href.trim().replace(/\\/g, '/');
    const lowerHref = cleanHref.toLowerCase();

    // Check if href links to the old note
    let newHref: string | null = null;
    if (lowerHref === oldMdFile || lowerHref === `./${oldMdFile}`) {
      newHref = `${normNewPath}.md`;
    } else if (lowerHref.endsWith(`/${oldFileName}`)) {
      newHref = cleanHref.slice(0, cleanHref.length - oldFileName.length) + `${normNewTitle}.md`;
    } else if (lowerHref === oldFileName) {
      newHref = `${normNewTitle}.md`;
    }

    if (newHref !== null && newHref !== cleanHref) {
      changed = true;
      return `[${linkText}](${newHref})`;
    }

    return fullMatch;
  });

  return { changed, newText };
}

/**
 * Rewrites path-style wikilinks and relative image paths when a folder is renamed.
 */
export function planFolderRenameLinks(
  text: string,
  params: FolderRenameJobParams,
  noteRelPath?: string
): { changed: boolean; newText: string } {
  if (!text || typeof text !== 'string') {
    return { changed: false, newText: text };
  }

  const oldFolder = normalizeSlashes(params.oldFolderRelPath);
  const newFolder = normalizeSlashes(params.newFolderRelPath);

  if (oldFolder === newFolder) {
    return { changed: false, newText: text };
  }

  let changed = false;

  // 1. Rewrite path-style wikilinks [[oldFolder/...]] -> [[newFolder/...]]
  const wikiRegex = /(^|[^!])\[\[([^\]\n]+)\]\]/g;
  let intermediate = text.replace(wikiRegex, (fullMatch, prefix, inner) => {
    if (isUnknownWikilink(inner)) return fullMatch;
    const parsed = parseWikilinkContent(inner);
    if (!parsed) return fullMatch;

    const normTarget = normalizeSlashes(parsed.target);
    if (normTarget.startsWith(`${oldFolder}/`) || normTarget === oldFolder) {
      const updatedTarget = rewriteFolderPrefix(normTarget, oldFolder, newFolder);
      if (updatedTarget !== normTarget) {
        changed = true;
        const formatted = formatWikilink(updatedTarget, {
          heading: parsed.heading,
          alias: parsed.alias
        });
        return `${prefix}${formatted}`;
      }
    }
    return fullMatch;
  });

  // 2. Rewrite markdown links and image paths
  const mdLinkRegex = /(!?)\[([^\]]*)\]\(([^)\n]+)\)/g;
  const newText = intermediate.replace(mdLinkRegex, (fullMatch, isBang, label, href) => {
    const cleanHref = href.trim().replace(/\\/g, '/');
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanHref)) {
      return fullMatch;
    }

    const normHref = normalizeSlashes(cleanHref);
    if (normHref.startsWith(`${oldFolder}/`) || normHref === oldFolder) {
      const updatedHref = rewriteFolderPrefix(normHref, oldFolder, newFolder);
      if (updatedHref !== normHref) {
        changed = true;
        return `${isBang}[${label}](${updatedHref})`;
      }
    }

    return fullMatch;
  });

  return { changed, newText };
}

/**
 * Rewrites path-style links and relative image paths when a note is moved between folders.
 */
export function planNoteMoveLinks(
  text: string,
  params: NoteMoveJobParams,
  isMovedNote: boolean
): { changed: boolean; newText: string } {
  if (!text || typeof text !== 'string') {
    return { changed: false, newText: text };
  }

  const oldPathWithoutMd = normalizeSlashes(params.oldNoteRelPath).replace(/\.md$/i, '');
  const newPathWithoutMd = normalizeSlashes(params.newNoteRelPath).replace(/\.md$/i, '');
  const oldDir = getParentDir(params.oldNoteRelPath);
  const newDir = getParentDir(params.newNoteRelPath);

  let changed = false;
  let currentText = text;

  // 1. If this is another note linking to the moved note via path-style wikilink:
  if (!isMovedNote) {
    const wikiRegex = /(^|[^!])\[\[([^\]\n]+)\]\]/g;
    currentText = currentText.replace(wikiRegex, (fullMatch, prefix, inner) => {
      if (isUnknownWikilink(inner)) return fullMatch;
      const parsed = parseWikilinkContent(inner);
      if (!parsed) return fullMatch;

      const normTarget = normalizeSlashes(parsed.target);
      if (normTarget.toLowerCase() === oldPathWithoutMd.toLowerCase()) {
        changed = true;
        const formatted = formatWikilink(newPathWithoutMd, {
          heading: parsed.heading,
          alias: parsed.alias
        });
        return `${prefix}${formatted}`;
      }
      return fullMatch;
    });
  }

  // 2. If this is the moved note itself, rebase its relative image paths:
  if (isMovedNote && oldDir !== newDir) {
    const imgRes = rewriteImageHrefsInText(currentText, (rawHref) => {
      return rebaseRelativeImagePath(oldDir, newDir, rawHref);
    });
    if (imgRes.changed) {
      changed = true;
      currentText = imgRes.newText;
    }
  }

  return { changed, newText: currentText };
}

/**
 * Rewrites tags in note frontmatter for tag.rename jobs.
 */
export function planTagRename(
  text: string,
  params: TagRenameJobParams
): { changed: boolean; newText: string } {
  const fm = parseFrontmatter(text);
  if (fm.isBroken) {
    return { changed: false, newText: text };
  }

  const updatedTags = renameTagInList(fm.tags, params.oldTag, params.newTag);
  const newText = updateFrontmatter(text, { tags: updatedTags });
  return {
    changed: newText !== text,
    newText
  };
}
