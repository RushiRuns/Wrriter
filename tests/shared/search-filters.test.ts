import { describe, it, expect } from 'vitest';
import {
  parseSearchQuery,
  hasFilters,
  isEmptyQuery,
  formatSearchQuery
} from '../../src/shared/domain/search-filters';

describe('Search Filters Domain (src/shared/domain/search-filters.ts)', () => {
  it('parses empty and whitespace queries cleanly', () => {
    const empty1 = parseSearchQuery('');
    expect(empty1.textQuery).toBe('');
    expect(empty1.words).toEqual([]);
    expect(empty1.tags).toEqual([]);
    expect(empty1.statuses).toEqual([]);
    expect(empty1.folders).toEqual([]);
    expect(isEmptyQuery(empty1)).toBe(true);

    const empty2 = parseSearchQuery('   \t  ');
    expect(isEmptyQuery(empty2)).toBe(true);
  });

  it('parses plain text words without filters', () => {
    const parsed = parseSearchQuery('weekly plan project meeting');
    expect(parsed.textQuery).toBe('weekly plan project meeting');
    expect(parsed.words).toEqual(['weekly', 'plan', 'project', 'meeting']);
    expect(parsed.tags).toEqual([]);
    expect(parsed.statuses).toEqual([]);
    expect(parsed.folders).toEqual([]);
    expect(hasFilters(parsed)).toBe(false);
  });

  it('parses tag:, status:, and folder: filters with unquoted values', () => {
    const parsed = parseSearchQuery('tag:work status:active folder:Projects roadmap design');
    expect(parsed.tags).toEqual(['work']);
    expect(parsed.statuses).toEqual(['active']);
    expect(parsed.folders).toEqual(['Projects']);
    expect(parsed.textQuery).toBe('roadmap design');
    expect(parsed.words).toEqual(['roadmap', 'design']);
    expect(hasFilters(parsed)).toBe(true);
  });

  it('parses quoted values in filters and quoted search phrases', () => {
    const parsed = parseSearchQuery('tag:"deep work" folder:"Work/2026 Archive" status:"in progress" "deliverable summary"');
    expect(parsed.tags).toEqual(['deep work']);
    expect(parsed.statuses).toEqual(['in progress']);
    expect(parsed.folders).toEqual(['Work/2026 Archive']);
    expect(parsed.textQuery).toBe('deliverable summary');
    expect(parsed.words).toEqual(['deliverable summary']);
  });

  it('normalizes folder slashes and tag # prefix', () => {
    const parsed = parseSearchQuery('folder:\\Work\\Projects\\ tag:#habit');
    expect(parsed.folders).toEqual(['Work/Projects']);
    expect(parsed.tags).toEqual(['habit']);
  });

  it('deduplicates duplicate filter entries case-insensitively', () => {
    const parsed = parseSearchQuery('tag:meeting tag:Meeting tag:MEETING status:draft status:Draft');
    expect(parsed.tags).toEqual(['meeting']);
    expect(parsed.statuses).toEqual(['draft']);
  });

  it('formats search queries back into canonical string representations', () => {
    const formatted = formatSearchQuery({
      folders: ['Work/Projects'],
      tags: ['deep work', 'goals'],
      statuses: ['in progress'],
      textQuery: 'annual budget'
    });
    expect(formatted).toBe('folder:Work/Projects tag:"deep work" tag:goals status:"in progress" annual budget');
  });
});
