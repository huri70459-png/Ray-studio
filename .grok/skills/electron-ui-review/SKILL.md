---
name: electron-ui-review
description: Use when implementing, reviewing, or modifying the Studio Shell UI (Electron main + React renderer surfaces, command palette, navigation, dark mode, layout).
---

# Electron UI Review

Specialized review for the desktop shell (Module 001 and dependents that touch renderer).

## Checks

- Layout & structure (topbar, nav rail, surfaces, command palette)
- Accessibility (keyboard nav, focus, ARIA where relevant, contrast)
- Navigation & routing (internal surface switching, command palette activation ⌘K / Ctrl+K)
- Dark mode / theming (Tailwind + custom CSS consistency)
- Performance (palette open <80ms target, no heavy render on every keystroke)
- Responsive behavior (within desktop constraints)
- IPC safety (all privileged actions go through preload contextBridge; no direct node/electron from renderer)
- Event handling hygiene (global listeners cleaned, no leaks)
- State management minimal and local to surfaces
- No console errors in dev, clean production build

## Process

1. Read apps/studio electron-main, preload, src/ components.
2. Review command registration and IPC handlers.
3. Test mentally or via dev: palette filtering, arrow/enter/esc, surface render switch.
4. Check tailwind + index.css for dark mode variables.
5. Verify preload exposes only narrow safe API.
6. Run build + manual smoke if possible.

## Output

- PASS / issues list per category above
- Specific file + line or component references
- Performance or safety risks called out
- Suggested minimal fixes (no arch changes)

Use in combination with architecture-compliance-review when touching UI surfaces.

## Related

- module-implementation (esp. 001)
- build-repair
- architecture-compliance-review
