---
name: module-implementation
description: Use when starting any implementation or coding session for a Ray Studio module, or when tasked with building per the approved architecture and deterministic pipeline.
---

# Module Implementation (Highest Priority)

**Use this skill for every coding session during Sprint 1 and beyond.**

This skill enforces the strict Sprint 1 rules and the deterministic implementation workflow. It exists to validate foundations and prevent architectural drift.

## Deterministic Pipeline (NO SHORTCUTS — execute exactly)

AGENTS.md
        ↓
docs/000-current-status.md
        ↓
project-status.json
        ↓
implementation-manifest (implementation-manifests/<module-id>.json)
        ↓
Engineering Constitution (Ray Studio Engineering Constitution.md)
        ↓
Module Specification (prompts/modules/<id>-*.md)
        ↓
Implementation Template (prompts/templates/implementation.md)
        ↓
Repository (graph tools first, then minimal targeted reads)
        ↓
Implement **only** the active module
        ↓
Run build
        ↓
Run typecheck
        ↓
Run tests
        ↓
Produce summary + evidence
        ↓
Stop

## Rules (Strictly Enforced)

- **Rule 1**: No architecture changes during implementation unless:
  - The implementation exposes a real architectural defect, **or**
  - An ADR is approved.
- **Rule 2**: Only one implementation module is active at any time.
  - Never overlap (e.g. 001 + 009, 009 + 010).
  - Each module must reach merge-ready state before the next begins.
- **Rule 3**: Every session starts with the exact pipeline above.
- **Rule 4**: Every completed module produces objective evidence.

## 7 Explicit Gates (module is NOT done until all green)

| Gate | Requirement          |
|------|----------------------|
| 1    | Code compiles        |
| 2    | Lint passes          |
| 3    | Typecheck passes     |
| 4    | Unit tests pass      |
| 5    | Architecture review passes |
| 6    | Documentation updated |
| 7    | Ready to merge       |

## Scope Discipline

- Load the manifest first. Respect `required`, `optional`, `forbidden`, `dependsOnModules`.
- Confirm `nextModule` and `approvedModules` from project-status.json.
- Implement **only** within the declared module boundaries.
- Use ponytail ladder + Constitution priorities (Safety/Security/Correctness first).
- Production-ready code only. No placeholders.

## Required Artifacts (minimum)

- Implementation summary
- Files changed
- Build status
- Typecheck status
- Test results
- Architecture compliance notes (or handoff to separate review)
- Known risks (if any)

## Output Format

At end of session:

**Module <ID> Implementation Complete**

- Status: All 7 gates green / blocked at <gate>
- Files modified: ...
- Commands run: `pnpm ...` (or equivalent)
- Evidence: ...
- Risks: ...
- Next: Awaiting architecture review (per separate role) or merge readiness.

## Stop

Produce the artifacts above, then **stop**. Do not proceed to another module.

## Related Skills

- architecture-compliance-review (for Gate 5)
- build-repair
- module-validation
- merge-readiness
- repository-navigation

**This skill is the primary entry point for all Sprint 1 work.**
