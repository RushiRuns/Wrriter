# ADR-W13: Renderer State Management (Plain React State and Context)

Status: Accepted  
Decided: Setup (Approved by Krishna)

## Context
Wrriter's renderer layer needs state management for UI coordination across components (tabs, selected folder, pane widths, settings).
Two options were evaluated:
1. **Zustand**: External state store library.
2. **Plain React state and Context**: Native React primitives (`useState`, `useReducer`, `createContext`, `useContext`).

Key structural factors in Wrriter's architecture:
- Note lists come from the SQLite index worker via IPC.
- Active note text lives inside the TipTap editor instance, not in shared renderer state.
- The state shared across the renderer is minimal (tabs, selected folder, pane widths, settings).
- `DEPENDENCIES.md` policy dictates keeping dependencies minimal ("Could 20 lines of TypeScript do it? Then write them.").

## Decision
Adopt **Plain React state and Context**. Do not use Zustand.

1. **Controller Encapsulation**: Controllers hide state behind `use<Feature>` custom hooks (e.g., `useTabs()`, `usePanes()`, `useSettings()`). Components consume these hooks rather than raw context directly. If Zustand is ever needed in the future, only the internal hook implementation changes without touching components.
2. **Keypress Locality Rule**: Anything that changes on a keypress (saved state, word/character counts, cursor position) MUST live in the component that displays it, NEVER in a context shared with other components. This prevents tree-wide re-renders during fast typing.
3. **Revisit Criteria**: Revisit this decision with a new ADR only if the keypress benchmark (Features 8: keypress to painted glyph under 16 ms) or a React re-render check misses because of shared state.

## Consequences
- Zero external dependencies added for state management, saving package weight, bundle size, and upgrade overhead.
- Clean hook-based controller abstractions in `src/renderer/controllers/`.
- Strict enforcement of component-local state for high-frequency input to guarantee sub-16 ms typing responsiveness.
