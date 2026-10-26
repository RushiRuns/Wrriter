import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DURATION_INSTANT,
  DURATION_FAST,
  DURATION_BASE,
  DURATION_SLOW,
  EASE_ARRIVE,
  EASE_MOVE,
  EASE_LEAVE,
  isSlowMotionActive,
  setSlowMotion,
  getEffectiveDuration,
  isReducedMotionActive,
  useReducedMotion
} from '../../src/renderer/motion';

describe('Motion Foundations', () => {
  beforeEach(() => {
    setSlowMotion(false);
  });

  afterEach(() => {
    setSlowMotion(false);
    vi.restoreAllMocks();
  });

  it('conforms strictly to the 4 speeds and 3 curves from Features 8', () => {
    expect(DURATION_INSTANT).toBe(0);
    expect(DURATION_FAST).toBe(100);
    expect(DURATION_BASE).toBe(180);
    expect(DURATION_SLOW).toBe(280);

    // No animation duration exceeds 300 ms
    expect(DURATION_SLOW).toBeLessThanOrEqual(300);

    expect(EASE_ARRIVE).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(EASE_MOVE).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(EASE_LEAVE).toBe('cubic-bezier(0.4, 0, 1, 1)');
  });

  it('toggles slow-motion 5x multiplier for development tuning', () => {
    expect(isSlowMotionActive()).toBe(false);
    expect(getEffectiveDuration(DURATION_FAST)).toBe(100);
    expect(getEffectiveDuration(DURATION_BASE)).toBe(180);

    setSlowMotion(true);
    expect(isSlowMotionActive()).toBe(true);
    expect(getEffectiveDuration(DURATION_FAST)).toBe(500);
    expect(getEffectiveDuration(DURATION_BASE)).toBe(900);
    expect(getEffectiveDuration(DURATION_SLOW)).toBe(1400);
    expect(getEffectiveDuration(DURATION_INSTANT)).toBe(0); // instant stays instant
  });

  it('honors reduced motion settings: full, reduced, and follow-windows', () => {
    // Mock window.matchMedia for Windows Animation Effects setting
    let reducedMatches = false;
    const listeners: ((e: any) => void)[] = [];

    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {};
    }

    globalThis.window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: reducedMatches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_, cb) => listeners.push(cb)),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    // When setting is explicitly 'reduced'
    expect(isReducedMotionActive('reduced')).toBe(true);

    // When setting is explicitly 'full'
    expect(isReducedMotionActive('full')).toBe(false);

    // When follow-windows is active and Windows Animation Effects is ON (reducedMatches = false)
    expect(isReducedMotionActive('follow-windows')).toBe(false);

    // When Windows Animation Effects is toggled OFF (reducedMatches = true)
    reducedMatches = true;
    expect(isReducedMotionActive('follow-windows')).toBe(true);
  });
});
