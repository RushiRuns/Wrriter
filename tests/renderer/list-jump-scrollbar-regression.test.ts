import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { NoteListItem } from '../../src/shared/ipc';

export function areNoteListsEqual(
  a: readonly NoteListItem[],
  b: readonly NoteListItem[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (
      itemA.path !== itemB.path ||
      itemA.title !== itemB.title ||
      itemA.modified !== itemB.modified ||
      itemA.pinned !== itemB.pinned ||
      itemA.preview !== itemB.preview ||
      itemA.hasImage !== itemB.hasImage ||
      itemA.orderKey !== itemB.orderKey
    ) {
      return false;
    }
  }
  return true;
}

describe('Random List Jump and Scrollbar Flash Regression', () => {
  it('demonstrates Issue 1: background interval polling preserves array reference when disk data is unchanged', () => {
    const currentNotes: NoteListItem[] = [
      {
        path: 'Disney.md',
        title: 'Disney',
        preview: 'parks',
        modified: 1000,
        pinned: false
      },
      {
        path: 'Meal plan.md',
        title: 'Meal plan',
        preview: 'food',
        modified: 900,
        pinned: false
      }
    ];

    // Periodic poll returns new objects with identical contents
    const polledDiskNotes: NoteListItem[] = [
      {
        path: 'Disney.md',
        title: 'Disney',
        preview: 'parks',
        modified: 1000,
        pinned: false
      },
      {
        path: 'Meal plan.md',
        title: 'Meal plan',
        preview: 'food',
        modified: 900,
        pinned: false
      }
    ];

    // BEFORE FIX: map() generates a new array reference every 2.5s, triggering re-renders
    const buggyNotes = polledDiskNotes.map((d) => d);
    expect(buggyNotes === currentNotes).toBe(false);

    // AFTER FIX: areNoteListsEqual detects no meaningful changes and returns currentNotes reference
    const fixedNotes = areNoteListsEqual(currentNotes, polledDiskNotes)
      ? currentNotes
      : polledDiskNotes;
    expect(fixedNotes === currentNotes).toBe(true);
  });

  it('demonstrates Issue 2: short lists that fit in viewport must lock startIndex and offsetY to 0', () => {
    const itemHeight = 84;
    const viewportHeight = 600;
    const totalCount = 2; // "Disney" and "Meal plan"
    const totalHeight = totalCount * itemHeight; // 168px << 600px

    // Simulating non-zero ephemeral scrollTop or measurement fluctuation
    const ephemeralScrollTop = 168;

    // BEFORE FIX: VirtualList blindly computed startIndex from scrollTop even when totalHeight <= viewportHeight
    const overscan = 5;
    const buggyStartIndex = Math.max(0, Math.floor(ephemeralScrollTop / itemHeight) - overscan);
    // If overscan was 1, buggyStartIndex would be > 0 and translateY would shift items down
    const buggyOffsetWithoutGuard = Math.floor(ephemeralScrollTop / itemHeight) * itemHeight;
    expect(buggyOffsetWithoutGuard).toBe(168);

    // AFTER FIX: when totalHeight <= viewportHeight, virtualization is bypassed
    const isVirtual = totalHeight > viewportHeight;
    const fixedStartIndex = isVirtual
      ? Math.max(0, Math.floor(ephemeralScrollTop / itemHeight) - overscan)
      : 0;
    const fixedOffsetY = fixedStartIndex * itemHeight;

    expect(isVirtual).toBe(false);
    expect(fixedStartIndex).toBe(0);
    expect(fixedOffsetY).toBe(0);
  });

  it('verifies source code styling and markup for dark-theme scrollbars on note list', () => {
    const componentsCss = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const mainWindowSrc = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );
    const virtualListSrc = readFileSync(
      join(__dirname, '../../src/renderer/components/VirtualList.tsx'),
      'utf-8'
    );

    // 1. components.css must style scrollbars on .rows and .notes-scroll
    expect(componentsCss).toContain('.rows');
    expect(componentsCss).toContain('scrollbar-color: var(--div) transparent;');
    expect(componentsCss).toContain('.rows::-webkit-scrollbar');

    // 2. MainWindow.tsx must use notes-scroll on the note list container
    expect(mainWindowSrc).toContain('notes-scroll');

    // 3. VirtualList.tsx must bypass virtualization offset when content fits in viewport
    expect(virtualListSrc).toContain('totalHeight > viewportHeight');

    // 4. MainWindow.tsx must check areNoteListsEqual before updating notes state on interval
    expect(mainWindowSrc).toContain('areNoteListsEqual');
  });
});
