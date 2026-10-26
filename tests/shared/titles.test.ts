import { describe, it, expect } from 'vitest';
import {
  extractTitleFromFirstLine,
  formatDefaultTitle,
  shouldRenameFileOnLeave,
  deriveFileNameFromTitle
} from '../../src/shared/domain/titles';

describe('titles domain functions', () => {
  describe('extractTitleFromFirstLine', () => {
    it('extracts title without heading marks', () => {
      expect(extractTitleFromFirstLine('# Welcome to Wrriter')).toBe('Welcome to Wrriter');
      expect(extractTitleFromFirstLine('## Project Plan')).toBe('Project Plan');
      expect(extractTitleFromFirstLine('###### Deep Section')).toBe('Deep Section');
      expect(extractTitleFromFirstLine('Plain first line text')).toBe('Plain first line text');
      expect(extractTitleFromFirstLine('')).toBe('');
      expect(extractTitleFromFirstLine('   #   Spaced Title   ')).toBe('Spaced Title');
    });
  });

  describe('formatDefaultTitle', () => {
    it('returns Untitled when not present', () => {
      expect(formatDefaultTitle([])).toBe('Untitled');
      expect(formatDefaultTitle(['Project', 'Notes'])).toBe('Untitled');
    });

    it('returns Untitled 2, Untitled 3... incrementing on clashes', () => {
      expect(formatDefaultTitle(['Untitled'])).toBe('Untitled 2');
      expect(formatDefaultTitle(['untitled', 'Untitled 2'])).toBe('Untitled 3');
      expect(formatDefaultTitle(['Untitled', 'Untitled 2', 'Untitled 3'])).toBe('Untitled 4');
    });
  });

  describe('shouldRenameFileOnLeave', () => {
    it('returns true if names matched when opened and title changed', () => {
      expect(
        shouldRenameFileOnLeave({
          initialFileName: 'Groceries.md',
          initialTitle: 'Groceries',
          currentTitle: 'Supermarket Groceries'
        })
      ).toBe(true);
    });

    it('returns false if initial file name differed from title when opened', () => {
      expect(
        shouldRenameFileOnLeave({
          initialFileName: 'CustomName.md',
          initialTitle: 'Original Heading',
          currentTitle: 'Brand New Heading'
        })
      ).toBe(false);
    });

    it('returns false for journal notes or manual renames', () => {
      expect(
        shouldRenameFileOnLeave({
          initialFileName: '2026-10-26.md',
          initialTitle: 'Daily Log',
          currentTitle: 'Daily Log 2',
          isJournal: true
        })
      ).toBe(false);

      expect(
        shouldRenameFileOnLeave({
          initialFileName: 'Note.md',
          initialTitle: 'Note',
          currentTitle: 'Changed',
          isManualRenamed: true
        })
      ).toBe(false);
    });
  });

  describe('deriveFileNameFromTitle', () => {
    it('sanitizes forbidden characters and caps at 100 characters', () => {
      expect(deriveFileNameFromTitle('Hello: World?')).toBe('Hello World.md');
      const longTitle = 'A'.repeat(150);
      const fileName = deriveFileNameFromTitle(longTitle);
      expect(fileName.length).toBeLessThanOrEqual(103); // 100 base + .md
    });
  });
});
