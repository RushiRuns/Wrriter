# ADR-W08: Design Tokens from UI Reference and Automated Build Checks

Status: Accepted  
Decided: Setup / M1 Scaffold (UI Hand-off, ARCHITECTURE.md)

## Context
Ad-hoc styling, hardcoded hex values, arbitrary font sizes, and unconstrained spacing lead to visual inconsistency, theme bugs, and poor contrast accessibility.

## Decision
1. **Single Source of Truth**: All design values (colors, typography, spacing, border radii, shadows) are defined as CSS custom properties in `src/renderer/styles/tokens.css`, ported directly from the UI reference style code.
2. **Zero Hardcoded CSS Values**: No raw hex codes, literal pixel sizes, or arbitrary font styles outside `tokens.css`.
3. **Theming**: App root manages `data-theme` (`light`, `dark`, `system`) and `data-accent` (`yellow`, `red`, `blue`, `green`, `purple`). Inside the editor pane, accents are restricted to callouts, tags, and specific color elements.
4. **Automated Build Checks**: Small build-time scripts enforce token discipline:
   - Token check: flags any CSS property using raw colors or unapproved spacing scales.
   - Contrast check: ensures 4.5:1 text contrast and 3:1 graphical element contrast across both themes and all 5 accent palettes.
   - Long-dash check: rejects en-dashes/em-dashes in app interface text.

## Consequences
- Guaranteed visual fidelity with the approved UI design and mockup screenshots.
- Zero theme regression or inaccessible low-contrast text combinations.
- Elimination of bulky external UI component libraries.
