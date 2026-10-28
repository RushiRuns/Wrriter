import { describe, it, expect } from 'vitest';
import {
  matchQuickSwitcher,
  scoreTitleMatch,
  getFolderFromPath,
  type QuickSwitcherSourceNote
} from '../../src/shared/domain/quick-switcher';

describe('Quick Switcher Domain (src/shared/domain/quick-switcher.ts)', () => {
  const sampleNotes: QuickSwitcherSourceNote[] = [
    { path: 'Weekly Plan.md', title: 'Weekly Plan', mtime_ms: 1000 },
    { path: 'Work/Project Alpha.md', title: 'Project Alpha', mtime_ms: 5000 },
    { path: 'Work/Meeting Notes.md', title: 'Meeting Notes', mtime_ms: 3000 },
    { path: 'Personal/Habits.md', title: 'Habits Tracker', mtime_ms: 4000 },
    { path: 'Ideas/App Concept.md', title: 'App Concept', mtime_ms: 2000 }
  ];

  it('correctly extracts folder names from note paths', () => {
    expect(getFolderFromPath('Weekly Plan.md')).toBe('');
    expect(getFolderFromPath('Work/Project Alpha.md')).toBe('Work');
    expect(getFolderFromPath('Work/2026/Q1/Roadmap.md')).toBe('Work/2026/Q1');
  });

  it('returns recent notes sorted by modified time descending when query is empty', () => {
    const results = matchQuickSwitcher(sampleNotes, '');
    expect(results.length).toBe(5);
    expect(results[0]?.title).toBe('Project Alpha'); // mtime 5000
    expect(results[1]?.title).toBe('Habits Tracker'); // mtime 4000
    expect(results[2]?.title).toBe('Meeting Notes'); // mtime 3000
    expect(results.every((r) => r.type === 'note')).toBe(true);
  });

  it('scores exact and prefix matches above substring and subsequence matches', () => {
    const exactScore = scoreTitleMatch('weekly plan', 'Weekly Plan');
    const prefixScore = scoreTitleMatch('week', 'Weekly Plan');
    const wordScore = scoreTitleMatch('plan', 'Weekly Plan');
    const subseqScore = scoreTitleMatch('wkp', 'Weekly Plan');

    expect(exactScore).toBeGreaterThan(prefixScore);
    expect(prefixScore).toBeGreaterThan(wordScore);
    expect(wordScore).toBeGreaterThan(subseqScore);
    expect(subseqScore).toBeGreaterThan(0);
  });

  it('matches notes using loose title matching (prefix, word start, acronym, subsequence)', () => {
    // 1. Prefix match
    const resPrefix = matchQuickSwitcher(sampleNotes, 'proj');
    expect(resPrefix.length).toBe(1);
    expect(resPrefix[0]?.title).toBe('Project Alpha');

    // 2. Word match
    const resWord = matchQuickSwitcher(sampleNotes, 'alpha');
    expect(resWord.length).toBe(1);
    expect(resWord[0]?.title).toBe('Project Alpha');

    // 3. Acronym match ("wp" -> "Weekly Plan")
    const resAcronym = matchQuickSwitcher(sampleNotes, 'wp');
    expect(resAcronym.some((r) => r.title === 'Weekly Plan')).toBe(true);

    // 4. Subsequence fuzzy match ("con" -> "App Concept")
    const resSubseq = matchQuickSwitcher(sampleNotes, 'con');
    expect(resSubseq.some((r) => r.title === 'App Concept')).toBe(true);
  });

  it('offers Create "what you typed" when nothing matches', () => {
    const results = matchQuickSwitcher(sampleNotes, 'Quantum Physics Research');
    expect(results.length).toBe(1);
    expect(results[0]?.type).toBe('create');
    expect(results[0]?.title).toBe('Quantum Physics Research');
    expect(results[0]?.path).toBe('Quantum Physics Research.md');
  });

  it('Performance Gate: matches against 50,000 in-memory notes in under 30 ms (PERFORMANCE.md)', () => {
    // Generate 50,000 simulated in-memory notes
    const largeList: QuickSwitcherSourceNote[] = [];
    for (let i = 0; i < 50000; i++) {
      largeList.push({
        path: `Folder${i % 100}/Note-${i}.md`,
        title: `Document ${i} - Title Note Analysis`,
        mtime_ms: 1000000 + (i % 50000)
      });
    }

    // Benchmark 1: Empty query (recent notes)
    const t0 = performance.now();
    const recentRes = matchQuickSwitcher(largeList, '', 30);
    const emptyDuration = performance.now() - t0;

    expect(recentRes.length).toBe(30);
    expect(emptyDuration).toBeLessThan(30);

    // Benchmark 2: Non-empty query (loose title search over 50,000 notes)
    const t1 = performance.now();
    const searchRes = matchQuickSwitcher(largeList, 'doc 49', 30);
    const searchDuration = performance.now() - t1;

    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchDuration).toBeLessThan(30); // Ceiling: 30 ms
  });
});
