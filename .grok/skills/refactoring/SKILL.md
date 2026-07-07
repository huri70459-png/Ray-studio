---
name: refactoring
description: Use when the goal is to improve code quality, readability, maintainability, or performance without changing architecture, public contracts, or module ownership.
---

# Refactoring

**Strict guardrails.** Refactoring here is not free rein.

## Absolute Prohibitions (Do NOT)

- Change architecture (see Rule 1)
- Change public contracts (IPC signatures, exported module APIs, manifest boundaries)
- Change module ownership (which module owns a file or concern)
- Introduce new dependencies
- Alter frozen baselines
- Expand scope beyond the current module

## Allowed Improvements (only)

- Internal quality (extract small pure helpers, remove duplication)
- Readability (better names, smaller functions, clear comments)
- Maintainability (simplify control flow, reduce nesting)
- Performance (measured — only when a real bottleneck exists and is demonstrated)
- Test clarity or coverage within existing behavior
- Error handling that prevents data loss (within same contract)

## Process

1. Confirm via manifest + status that you are inside an approved active module.
2. Identify the narrow area to improve.
3. Ensure behavior is covered by existing tests (or add characterization test first).
4. Make the smallest diff possible.
5. Re-run build + typecheck + tests.
6. Document the intent in a ponytail: comment if shortcut taken.

## Output

- Before/after intent (one sentence)
- Diff summary
- Proof that public surface and architecture unchanged
- All gates still green

## When NOT to Refactor

- During initial implementation of a module (implement correctly first)
- When under time pressure that would risk correctness
- If it would require touching another module

Prefer deletion over clever code. Boring is good.

## Related

- module-implementation (rarely during first pass)
- build-repair
- architecture-compliance-review (must still pass after)
