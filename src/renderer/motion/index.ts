import { useState, useEffect } from 'react';

/**
 * Motion speeds and curves defined in Features 8 and UI hand-off 2.
 * Strictly 4 speeds and 3 curves. No animation exceeds 300 ms.
 */
export const DURATION_INSTANT = 0;
export const DURATION_FAST = 100;
export const DURATION_BASE = 180;
export const DURATION_SLOW = 280;

export const EASE_ARRIVE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_MOVE = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const EASE_LEAVE = 'cubic-bezier(0.4, 0, 1, 1)';

/**
 * Motion mode setting from SCHEMA.md:
 * 'follow-windows' | 'reduced' | 'full'
 */
export type MotionSetting = 'follow-windows' | 'reduced' | 'full';

// Slow-motion development toggle state
let isSlowMotionDev = false;

export function isSlowMotionActive(): boolean {
  return isSlowMotionDev;
}

export function setSlowMotion(enabled: boolean): void {
  isSlowMotionDev = enabled;
  if (typeof document !== 'undefined') {
    const root = document.querySelector('.wr');
    if (root) {
      if (enabled) {
        root.setAttribute('data-slow-motion', 'true');
      } else {
        root.removeAttribute('data-slow-motion');
      }
    }
  }
}

export function getEffectiveDuration(durationMs: number): number {
  if (durationMs === 0) return 0;
  return isSlowMotionDev ? durationMs * 5 : durationMs;
}

/**
 * Synchronous check for reduced motion state.
 */
export function isReducedMotionActive(setting: MotionSetting = 'follow-windows'): boolean {
  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Custom React hook detecting reduced motion:
 * Respects both the Windows system "Animation effects" setting (prefers-reduced-motion)
 * and the user's in-app motion preference.
 */
export function useReducedMotion(setting: MotionSetting = 'follow-windows'): boolean {
  const [systemReduced, setSystemReduced] = useState(() => isReducedMotionActive('follow-windows'));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemReduced(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  return systemReduced;
}

/**
 * FLIP glide helper:
 * Measures previous rect vs current rect, inverts via GPU transform, and glides smoothly.
 * Restricts animation to transform only, avoiding text re-wrapping or layout reflow.
 */
export function flipGlide(
  element: HTMLElement,
  firstRect: DOMRect,
  options: {
    duration?: number;
    easing?: string;
    onFinish?: () => void;
  } = {}
): Animation | null {
  if (typeof window === 'undefined' || !element.animate) return null;

  const lastRect = element.getBoundingClientRect();
  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;

  // If element has not moved, no animation needed
  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
    options.onFinish?.();
    return null;
  }

  const duration = getEffectiveDuration(options.duration ?? DURATION_BASE);
  const easing = options.easing ?? EASE_MOVE;

  const animation = element.animate(
    [
      { transform: `translate(${deltaX}px, ${deltaY}px)` },
      { transform: 'translate(0, 0)' }
    ],
    {
      duration,
      easing,
      fill: 'none'
    }
  );

  if (options.onFinish) {
    animation.onfinish = () => options.onFinish?.();
  }

  return animation;
}

export {
  crossFadeTransition,
  broadcastThemeChange,
  subscribeThemeSync,
  type ThemeSyncMessage
} from './theme-transition';

