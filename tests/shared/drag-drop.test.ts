import { describe, it, expect } from 'vitest';
import {
  parseBrowserLinkDrop,
  parseBrowserImageDrop,
  formatDroppedFilesMarkdown,
  deriveNoteTitleFromFileName
} from '../../src/shared/domain/drag-drop';

describe('Domain: Drag and Drop Parsing & Formatting', () => {
  describe('parseBrowserLinkDrop', () => {
    it('parses Firefox text/x-moz-url format with title', () => {
      const mozUrl = 'https://example.com/article\nExample Article Title';
      const parsed = parseBrowserLinkDrop('', '', '', mozUrl);
      expect(parsed).toEqual({
        url: 'https://example.com/article',
        title: 'Example Article Title'
      });
    });

    it('parses Chrome and Edge HTML anchor format with title', () => {
      const html = '<meta charset="utf-8"><a href="https://github.com/org/repo">GitHub Project Repo</a>';
      const parsed = parseBrowserLinkDrop(html);
      expect(parsed).toEqual({
        url: 'https://github.com/org/repo',
        title: 'GitHub Project Repo'
      });
    });

    it('falls back to text/uri-list', () => {
      const uriList = '# Comment\nhttps://developer.mozilla.org/en-US/\n';
      const parsed = parseBrowserLinkDrop('', '', uriList);
      expect(parsed).toEqual({
        url: 'https://developer.mozilla.org/en-US/',
        title: ''
      });
    });

    it('falls back to plain text URL', () => {
      const text = 'https://wrriter.app/docs';
      const parsed = parseBrowserLinkDrop('', text);
      expect(parsed).toEqual({
        url: 'https://wrriter.app/docs',
        title: ''
      });
    });

    it('returns null for non-link plain text', () => {
      const text = 'Just some arbitrary paragraph of text that is not a link';
      const parsed = parseBrowserLinkDrop('', text);
      expect(parsed).toBeNull();
    });
  });

  describe('parseBrowserImageDrop', () => {
    it('extracts image URL and alt text from HTML <img>', () => {
      const html = '<img src="https://example.com/diagram.png" alt="System Architecture Diagram" width="500">';
      const parsed = parseBrowserImageDrop(html);
      expect(parsed).toEqual({
        imageUrl: 'https://example.com/diagram.png',
        altText: 'System Architecture Diagram'
      });
    });

    it('extracts plain text image URL ending with image extension', () => {
      const text = 'https://images.unsplash.com/photo-123.jpg';
      const parsed = parseBrowserImageDrop('', text);
      expect(parsed).toEqual({
        imageUrl: 'https://images.unsplash.com/photo-123.jpg',
        altText: ''
      });
    });

    it('returns null for web pages that are not direct images', () => {
      const text = 'https://example.com/index.html';
      const parsed = parseBrowserImageDrop('', text);
      expect(parsed).toBeNull();
    });
  });

  describe('formatDroppedFilesMarkdown', () => {
    it('formats multiple dropped files one per line in order', () => {
      const files = [
        { fileName: 'diagram.png', relativePath: 'attachments/diagram.png', isImage: true },
        { fileName: 'spec.pdf', relativePath: 'attachments/spec.pdf', isImage: false },
        { fileName: 'photo.webp', relativePath: 'attachments/photo.webp', isImage: true }
      ];

      const md = formatDroppedFilesMarkdown(files);
      const expected =
        '![diagram.png](attachments/diagram.png)\n\n' +
        '[spec.pdf](attachments/spec.pdf)\n\n' +
        '![photo.webp](attachments/photo.webp)';

      expect(md).toBe(expected);
    });

    it('returns empty string if no files provided', () => {
      expect(formatDroppedFilesMarkdown([])).toBe('');
    });
  });

  describe('deriveNoteTitleFromFileName', () => {
    it('strips extension and handles various file names', () => {
      expect(deriveNoteTitleFromFileName('quarterly-report.pdf')).toBe('quarterly-report');
      expect(deriveNoteTitleFromFileName('photo.jpeg')).toBe('photo');
      expect(deriveNoteTitleFromFileName('archive.tar.gz')).toBe('archive.tar');
      expect(deriveNoteTitleFromFileName('README')).toBe('README');
      expect(deriveNoteTitleFromFileName('.gitignore')).toBe('Untitled');
    });
  });
});
