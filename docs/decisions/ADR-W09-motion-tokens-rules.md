# ADR-W09: Motion Tokens, Reduced Motion, and Animation Rules

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 8, UI Hand-off)

## Context
Excessive, slow, or springy animations cause user fatigue, disrupt fast note-taking workflows, and trigger accessibility issues for users sensitive to motion.

## Decision
1. **Four Speeds and Three Curves**: All animations strictly select from the 4 duration tokens (0 ms, 100 ms, 180 ms, 280 ms) and 3 easing curves defined in Features 8. No animation exceeds 300 ms.
2. **Transform & Opacity Only**: Animations are restricted to `transform` and `opacity` properties to ensure full GPU hardware acceleration, with exceptions only for specific structural accordion expands (e.g. folder expand/collapse).
3. **Never Animated**: Typing, undo, redo, scrolling, dragging, resizing, note switching, tab switching, and search query results are never animated.
4. **Motion Technology**: CSS transitions and the Web Animations API only. Zero JavaScript timer-based animation libraries.
5. **Reduced Motion**: Respects both the Windows system "Animation effects" setting and user in-app preference. Reduced motion replaces transitions with instantaneous state changes or subtle cross-fades.

## Consequences
- Fluid, premium feel that never impedes high-speed typing or navigation.
- Consistent 60/120 FPS rendering with zero dropped frames on budget hardware.
- Full compliance with accessibility standards.
