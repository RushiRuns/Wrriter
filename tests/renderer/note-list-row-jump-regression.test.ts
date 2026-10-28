import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shouldAnimateReorder } from '../../src/renderer/components/VirtualList';

describe('Note List Row Jump on Click/Edit Regression', () => {
  it('detects that clicking an item (selection change) does not change key order and must not animate', () => {
    // 3 notes in list
    const prevKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    // User clicks on note-2: keys and their order remain identical
    const currentKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    // Before fix: VirtualList unconditionally triggered flipGlide on every render
    // After fix: shouldAnimateReorder returns false, preventing flipGlide and avoiding upward jump
    expect(shouldAnimateReorder(prevKeys, currentKeys)).toBe(false);
  });

  it('detects that editing an item (title/content edit) does not change key order and must not animate', () => {
    const prevKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    // User edits note-2 in editor: keys and order remain identical
    const currentKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    expect(shouldAnimateReorder(prevKeys, currentKeys)).toBe(false);
  });

  it('detects that true reordering (manual sort, pin, drag) changes key order and must animate', () => {
    const prevKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    // User sorts by modified or drags note-2 to top
    const reorderedKeys = ['note-2.md', 'note-1.md', 'note-3.md'];

    expect(shouldAnimateReorder(prevKeys, reorderedKeys)).toBe(true);
  });

  it('detects that pinning/unpinning or deleting changes list length and must animate', () => {
    const prevKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    // note-2 was pinned and moved out of unpinned list
    const unpinnedKeysAfterPin = ['note-1.md', 'note-3.md'];

    expect(shouldAnimateReorder(prevKeys, unpinnedKeysAfterPin)).toBe(true);
  });

  it('does not animate on initial mount when prevKeys is empty', () => {
    const prevKeys: string[] = [];
    const currentKeys = ['note-1.md', 'note-2.md', 'note-3.md'];

    expect(shouldAnimateReorder(prevKeys, currentKeys)).toBe(false);
  });

  it('verifies VirtualList.tsx captures clean rects before flipGlide and guards with shouldAnimateReorder', () => {
    const source = readFileSync(
      join(__dirname, '../../src/renderer/components/VirtualList.tsx'),
      'utf-8'
    );

    // VirtualList must export shouldAnimateReorder and guard FLIP glide
    expect(source).toContain('shouldAnimateReorder');
    expect(source).toContain('prevKeysRef');

    // Sampling getBoundingClientRect must occur BEFORE calling flipGlide
    // to prevent active transform pollution from element.animate()
    const sampleIdx = source.indexOf('newRects.set(key, element.getBoundingClientRect())');
    const glideIdx = source.indexOf('flipGlide(element, prevRect)');

    expect(sampleIdx).toBeGreaterThan(-1);
    expect(glideIdx).toBeGreaterThan(-1);
    expect(sampleIdx).toBeLessThan(glideIdx);
  });
});
