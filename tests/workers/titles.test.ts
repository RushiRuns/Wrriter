import { describe, it, expect } from 'vitest';
import { TitleList } from '../../src/workers/index/titles';

describe('TitleList (src/workers/index/titles.ts)', () => {
  it('manages titles in memory with fast lookup and retrieval', () => {
    const list = new TitleList();
    expect(list.size()).toBe(0);
    expect(list.getAll()).toEqual([]);

    list.init([
      { path: 'Note1.md', title: 'Note 1', mtime_ms: 100 },
      { path: 'Note2.md', title: 'Note 2', mtime_ms: 200 }
    ]);

    expect(list.size()).toBe(2);
    expect(list.get('Note1.md')?.title).toBe('Note 1');
    expect(list.get('Note2.md')?.title).toBe('Note 2');

    // Update
    list.set({ path: 'Note1.md', title: 'Note 1 Renamed', mtime_ms: 300 });
    expect(list.get('Note1.md')?.title).toBe('Note 1 Renamed');
    expect(list.size()).toBe(2);

    // Remove
    list.remove('Note2.md');
    expect(list.size()).toBe(1);
    expect(list.get('Note2.md')).toBeNull();
  });
});
