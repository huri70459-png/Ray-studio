---
name: scope-guard
description: Use before writing any code for a module. Produces an explicit Scope Declaration listing the active module, allowed paths, may-read items, and forbidden areas. Enforces one-active-module rule and manifest boundaries.
---

# Scope Guard

**Run this as the very first step of any implementation or edit session.**

It produces a clear declaration that must be respected for the entire session. This prevents accidental scope expansion, especially important for the keystone 013 IPC Framework and beyond.

## When to Invoke

- At the absolute start of any module-implementation session
- Before any significant edit or refactoring that touches code
- When the user or agent proposes work on a new area
- As a self-check mid-session if scope feels unclear

## Inputs (Mandatory — Read These First)

1. AGENTS.md
2. docs/000-current-status.md
3. project-status.json (confirm `nextModule`, `approvedModules`, `frozenBaselines`)
4. implementation-manifests/<active-module>.json (required / optional / forbidden)

## Output Format (Exact Style — Emit This Early)

```
Active Module:
013 IPC Framework

Allowed:
✓ packages/core/src/ipc/**
✓ apps/studio/electron-main/** (IPC wiring + privileged service init only)
✓ apps/studio/src/** (thin shims using contracts only — no direct service construction)

May Read:
✓ Ray Studio Engineering Constitution.md
✓ 013 Specification + Validation Spec
✓ implementation-manifests/013-ipc-framework.json
✓ AGENTS.md
✓ docs/000-current-status.md
✓ project-status.json
✓ Relevant history/ and docs/ for context only

Forbidden:
✗ SQLite / 016 or any DB implementation
✗ Context Engine (1xx modules)
✗ Memory / Provider layers
✗ Any other frozen module code
✗ Ad-hoc IPC channel registration outside the registry
✗ Direct node:fs or watcher in renderer
```

## Rules (Strict)

- Only the declared active module (from project-status.json nextModule) may be implemented.
- Respect the manifest's `required`, `optional`, `forbidden` lists exactly.
- No work on 016, Context Engine, or higher until 013 completes the full governance cycle (per explicit authorization).
- Updates to status / history files happen **only** at the documented gates (never during implementation).
- If the declaration would be violated, stop and report immediately.

## Process

1. Read the four inputs above.
2. Resolve the current active module id + name.
3. Emit the Scope Declaration block (copy style above).
4. State: "This session is now constrained to the declaration above."
5. If any proposed action would violate, call out the violation explicitly.

## Related Skills

- module-implementation (primary caller — must run scope-guard first)
- constitution-compliance-checker
- repository-auditor
- merge-readiness (will verify scope was respected)
