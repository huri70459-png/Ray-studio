---
name: documentation-sync
description: Use when implementation or refactoring is complete and documentation must be updated to match reality (README, current-status, handoff, summaries, API notes) without changing architecture or specs.
---

# Documentation Sync

Automatically keeps living docs aligned with delivered code.

## What It Updates (as needed)

- README.md (high-level status, build instructions, quick start)
- docs/000-current-status.md (phase, module table, next action)
- docs/handoff.md (reality + cadence updates)
- Implementation summary artifacts (per module)
- Any API or contract docs touched by the change
- Session handoff notes when relevant

## Rules

- **Never** modify frozen baselines:
  - Ray Studio Engineering Constitution.md
  - AGENTS.md
  - implementation-manifests/
  - prompts/modules/ or templates/
  - docs/00x foundational architecture docs
- Only reflect what was actually implemented and passed gates.
- Keep tone factual. Link to evidence (build logs, test results) where useful.
- Do not add new architectural claims.
- Update "lastUpdated" or dates where the file carries them.
- Preserve the Sprint 1 objective: "Implement the approved architecture with zero architectural drift."

## Process

1. Identify files changed in the module.
2. Determine which docs reference the affected areas.
3. Make minimal, accurate updates.
4. Cross-check against module manifest and current-status module table.
5. Verify no spec or architecture drift introduced in docs.

## Output

List of docs touched + one-sentence summary of what was synchronized for each.

Example:
- docs/000-current-status.md: marked Module 001 implementation complete + gates status
- README.md: added note on running the studio shell

## When to Use

- End of a successful module-implementation + gates
- After refactoring that improves internal quality
- After any merge that changes observable behavior or build steps

## Related

- module-implementation
- merge-readiness
- module-validation
