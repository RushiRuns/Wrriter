import { describe, it, expect } from 'vitest';
import { generateKeyBetween, sortNotesWithManualOrder } from '../../src/shared/domain/ordering';

describe('Domain: Fractional Indexing (Ordering)', () => {
  it('generates an initial key when list is empty', () => {
    const key = generateKeyBetween(null, null);
    expect(key).toBe('a0');
  });

  it('generates a key strictly between two items', () => {
    const k1 = 'a0';
    const k3 = 'a2';
    const k2 = generateKeyBetween(k1, k3);

    expect(k1 < k2).toBe(true);
    expect(k2 < k3).toBe(true);
  });

  it('generates keys before the first item', () => {
    const first = 'a0';
    const beforeFirst = generateKeyBetween(null, first);
    expect(beforeFirst < first).toBe(true);
  });

  it('generates keys after the last item', () => {
    const last = 'z';
    const afterLast = generateKeyBetween(last, null);
    expect(afterLast > last).toBe(true);
  });

  it('handles repeated mid-insertions without key collision', () => {
    let prev = 'a0';
    const next = 'a1';
    const keys: string[] = [];

    for (let i = 0; i < 10; i++) {
      const mid = generateKeyBetween(prev, next);
      expect(prev < mid).toBe(true);
      expect(mid < next).toBe(true);
      keys.push(mid);
      prev = mid;
    }

    // Verify all keys are strictly sorted
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i]! < keys[i + 1]!).toBe(true);
    }
  });

  it('sorts notes per SCHEMA.md rule: unranked at top by modified desc, ranked by key asc', () => {
    const notes = [
      { path: 'note-c.md', modified: 1000 },
      { path: 'note-a.md', modified: 3000 },
      { path: 'note-unranked-new.md', modified: 5000 },
      { path: 'note-b.md', modified: 2000 },
      { path: 'note-unranked-old.md', modified: 4000 }
    ];

    const orderMap: Record<string, string> = {
      'note-a.md': 'k1',
      'note-b.md': 'k2',
      'note-c.md': 'k3'
    };

    const sorted = sortNotesWithManualOrder(notes, orderMap);

    // Unranked notes appear at the top sorted by modified descending
    expect(sorted[0]?.path).toBe('note-unranked-new.md'); // modified 5000
    expect(sorted[1]?.path).toBe('note-unranked-old.md'); // modified 4000

    // Ranked notes follow sorted by key ascending
    expect(sorted[2]?.path).toBe('note-a.md'); // key k1
    expect(sorted[3]?.path).toBe('note-b.md'); // key k2
    expect(sorted[4]?.path).toBe('note-c.md'); // key k3
  });
});
