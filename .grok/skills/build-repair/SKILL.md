---
name: build-repair
description: Use when build, lint, typecheck, or tests are failing after implementation, or when repairing a module to reach green gates.
---

# Build & Repair

**Run after implementation or when any gate is red. Stop only when all relevant gates are green.**

This skill saves enormous time by providing a repeatable repair loop.

## Workflow (repeat until green)

1. Run build
2. Fix all compiler errors
3. Run lint
4. Fix all lint issues
5. Run typecheck
6. Run tests
7. Repeat from top if any failure
8. Stop only when everything is green

## Commands (project defaults — adapt from package.json / turbo)

From repo root or app/studio:

- Build: `pnpm build` or `turbo build --filter=studio` or `cd apps/studio && pnpm build`
- Lint: scoped `pnpm lint` (see apps/studio/package.json for "lint": "eslint \"src\" \"electron-main\"")
- Typecheck: `pnpm typecheck` or `tsc --noEmit` (use tsconfig variants)
- Test: `pnpm test` or `vitest run`

Always prefer workspace-aware commands. Fix root cause, not symptoms.

## Principles

- Ponytail ladder applies: prefer minimal fix.
- Fix in the shared function when multiple callers affected (root cause).
- Do not introduce architecture changes while repairing.
- Preserve typed contracts and IPC boundaries.
- After fixes, re-run the full relevant gate sequence.

## When to Stop

Only when:
- Build succeeds with no errors
- Lint clean (0 errors/warnings in scope)
- Typecheck clean
- Tests pass (all relevant suites)

Produce a short repair log: what was broken + what fixed.

## Related Skills

- module-implementation (primary caller)
- module-validation
- electron-ui-review (for renderer issues)
