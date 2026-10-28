import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../src/main/services/search-service';
import type { IndexClient } from '../../src/main/services/index-client';
import { ok } from '../../src/shared/result';

describe('SearchService (src/main/services/search-service.ts)', () => {
  it('delegates vault search queries to indexClient', async () => {
    const mockSearchResults = [
      {
        path: 'Work/Roadmap.md',
        title: 'Roadmap',
        folder: 'Work',
        mtime_ms: 5000,
        preview: 'Deliverables',
        snippet: '<mark>deliverables</mark>',
        rank: -1.5
      }
    ];

    const mockIndexClient = {
      search: vi.fn().mockResolvedValue(ok(mockSearchResults)),
      getTitleList: vi.fn().mockResolvedValue(ok([]))
    } as unknown as IndexClient;

    const searchService = new SearchService({ indexClient: mockIndexClient });
    const result = await searchService.search('tag:work deliverables', 25);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(mockSearchResults);
    }
    expect(mockIndexClient.search).toHaveBeenCalledWith('tag:work deliverables', 25);
  });

  it('runs quick switcher candidate matching against in-memory titles', async () => {
    const mockTitles = [
      { path: 'Weekly Plan.md', title: 'Weekly Plan', mtime_ms: 1000 },
      { path: 'Work/Project.md', title: 'Project Alpha', mtime_ms: 3000 },
      { path: 'Archive/Old.md', title: 'Old Archive', mtime_ms: 500 }
    ];

    const mockIndexClient = {
      search: vi.fn(),
      getTitleList: vi.fn().mockResolvedValue(ok(mockTitles))
    } as unknown as IndexClient;

    const searchService = new SearchService({ indexClient: mockIndexClient });

    // 1. Empty query -> recent notes
    const recentRes = await searchService.getQuickSwitcherResults('', 10);
    expect(recentRes.ok).toBe(true);
    if (recentRes.ok) {
      expect(recentRes.value.length).toBe(3);
      expect(recentRes.value[0]?.title).toBe('Project Alpha'); // highest mtime
    }

    // 2. Query matching title
    const matchRes = await searchService.getQuickSwitcherResults('week', 10);
    expect(matchRes.ok).toBe(true);
    if (matchRes.ok) {
      expect(matchRes.value.length).toBe(1);
      expect(matchRes.value[0]?.title).toBe('Weekly Plan');
    }

    // 3. No match -> create item
    const createRes = await searchService.getQuickSwitcherResults('NonExistent New Note', 10);
    expect(createRes.ok).toBe(true);
    if (createRes.ok) {
      expect(createRes.value.length).toBe(1);
      expect(createRes.value[0]?.type).toBe('create');
      expect(createRes.value[0]?.title).toBe('NonExistent New Note');
    }
  });
});
