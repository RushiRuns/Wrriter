import { describe, expect, it } from 'vitest';
import { SystemClock, TestClock } from '../../src/shared/clock';

describe('Clock implementations', () => {
  it('SystemClock provides current time and local today string in YYYY-MM-DD format', () => {
    const clock = new SystemClock();
    const now = clock.now();
    expect(now).toBeInstanceOf(Date);

    const today = clock.today();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const iso = clock.nowIso();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('TestClock provides deterministic time and allows advancing time', () => {
    const clock = new TestClock('2026-10-26T10:00:00.000Z');
    expect(clock.nowIso()).toBe('2026-10-26T10:00:00.000Z');

    clock.advanceByMs(5000);
    expect(clock.nowIso()).toBe('2026-10-26T10:00:05.000Z');

    clock.setTime('2027-01-01T00:00:00.000Z');
    expect(clock.nowIso()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('TestClock correctly formats local today date', () => {
    const clock = new TestClock(new Date(2026, 9, 26)); // October 26, 2026
    expect(clock.today()).toBe('2026-10-26');
  });
});
