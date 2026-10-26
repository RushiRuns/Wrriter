# ADR-W06: Frameless Window Shell and Window Check on Windows 10 and 11

Status: Accepted  
Decided: Day-One Check (M1 Setup)

## Context
Wrriter's design features a frameless window with a 40px toolbar and three drawn circular window buttons (close, minimize, maximize), with 16 px rounded corners from the Editor view mockup.
On Windows:
1. Windows 11 (Build 22000+) provides native window rounding at the DWM compositor level.
2. Windows 10 does not support DWM corner rounding for frameless windows without setting `transparent: true`.
3. If an Electron window sets `transparent: true` on Windows, native window behaviors break: resizing from edges is disabled, double-click on titlebar to maximize is lost, and Aero snap / Windows snapping is degraded or broken.
4. Custom drawn HTML buttons cannot trigger Windows 11's native Snap Layouts flyout on hover without native titlebar overlay.

## Decision
1. **Prioritize Native Snapping and Resizing**: Use Electron `frame: false` with default `thickFrame: true` and non-transparent background (`backgroundColor: '#18181A'`).
2. **Window Controls**: The 40 px toolbar is marked `-webkit-app-region: drag`, while the three drawn circular buttons are marked `-webkit-app-region: no-drag`.
3. **Corner Fallback on Windows 10 (Question 1 Outcome)**: Approved per Versions doc Question 1 recommendation. If the M1 window check shows Windows 10 cannot have 16 px corners and also resize, maximise and snap properly, then resizing, maximising and snapping win and Wrriter uses Windows' own square corners. On Windows 11, standard DWM system corner rounding applies.
4. **Snap Layouts Flyout**: Acknowledge that the Snap Layouts flyout does not appear when hovering over the custom drawn HTML maximize button; standard keyboard shortcuts (`Win + Left/Right/Up/Down`) and edge dragging retain full Aero snap functionality.

## Consequences
- Windows 10 and Windows 11 both maintain full window ergonomics: edge/corner resizing, double-click toolbar maximize, and snap-to-edge.
- Windows 10 uses its native square window boundaries to preserve native Aero snapping and edge resizing without transparency bugs.
- No white flash on start (window shown only on `ready-to-show`).
- Window shell renders the 16 px border-radius inside its client area seamlessly.
