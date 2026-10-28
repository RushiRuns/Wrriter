/**
 * Pure domain logic for Drag and Drop processing (M4: Capture and files).
 * Strictly pure logic: no Node.js, Electron, or DOM imports (ARCHITECTURE.md rule 4).
 */

import { formatAttachmentMarkdown, isInlineImageExtension } from './attachments';

export interface BrowserLinkPayload {
  readonly url: string;
  readonly title: string;
}

export interface BrowserImagePayload {
  readonly imageUrl: string;
  readonly altText: string;
}

/**
 * Parses browser dropped link data (tested across Chrome, Edge, and Firefox).
 * Extracts URL and page title when provided by the browser.
 */
export function parseBrowserLinkDrop(
  html = '',
  plainText = '',
  uriList = '',
  mozUrl = ''
): BrowserLinkPayload | null {
  // 1. Firefox specific: text/x-moz-url contains "URL\nTitle"
  if (mozUrl && mozUrl.trim()) {
    const lines = mozUrl.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const url = lines[0];
    if (url && /^https?:\/\//i.test(url)) {
      const title = lines[1] || '';
      return { url, title: title !== url ? title : '' };
    }
  }

  // 2. HTML drop from Chrome / Edge / Firefox: <a href="url">Title</a>
  if (html && html.trim()) {
    const anchorMatch = html.match(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/i);
    if (anchorMatch && anchorMatch[1] !== undefined) {
      const url = anchorMatch[1].trim();
      const rawTitle = (anchorMatch[2] ?? '').replace(/<[^>]+>/g, '').trim();
      return {
        url,
        title: rawTitle && rawTitle !== url ? rawTitle : ''
      };
    }
  }

  // 3. text/uri-list
  if (uriList && uriList.trim()) {
    const firstLine = uriList.split(/\r?\n/).map((l) => l.trim()).find((l) => !l.startsWith('#'));
    if (firstLine && /^https?:\/\//i.test(firstLine)) {
      return { url: firstLine, title: '' };
    }
  }

  // 4. Plain text URL fallback
  const trimmedText = plainText.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmedText)) {
    return { url: trimmedText, title: '' };
  }

  return null;
}

/**
 * Parses browser dropped image data (HTML <img src="..."> or image URL).
 */
export function parseBrowserImageDrop(
  html = '',
  plainText = ''
): BrowserImagePayload | null {
  if (html && html.trim()) {
    const imgMatch = html.match(/<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/i);
    if (imgMatch && imgMatch[1] !== undefined) {
      const imageUrl = imgMatch[1].trim();
      const altMatch = imgMatch[0].match(/\balt=["']([^"']*)["']/i);
      const altText = altMatch?.[1]?.trim() || '';
      return { imageUrl, altText };
    }
  }

  const trimmedText = plainText.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmedText)) {
    const pathname = trimmedText.split('?')[0]?.split('#')[0] || '';
    if (isInlineImageExtension(pathname)) {
      return { imageUrl: trimmedText, altText: '' };
    }
  }

  return null;
}

/**
 * Formats multiple dropped attachments into separate lines in Explorer's order.
 */
export function formatDroppedFilesMarkdown(
  items: ReadonlyArray<{
    readonly fileName: string;
    readonly relativePath: string;
    readonly isImage: boolean;
  }>
): string {
  if (!items || items.length === 0) return '';
  return items
    .map((item) => formatAttachmentMarkdown(item.fileName, item.relativePath, item.isImage))
    .join('\n\n');
}

/**
 * Derives default note title from a dropped file name (without extension).
 * e.g. "quarterly-report.pdf" -> "quarterly-report"
 */
export function deriveNoteTitleFromFileName(fileName: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  const base = dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;
  return base.trim() || 'Untitled';
}
