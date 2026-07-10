---
name: documentation-sync
description: Documentation Synchronizer. Use only after merge-readiness approval + merge. Updates exactly project-status.json, history/<module>.md, docs/000-current-status.md, and docs/handoff.md. Never touches specs or frozen baselines.
---

# Documentation Sync

Automatically keeps living docs aligned with delivered code.

## What It Updates (Post-Merge Only — Exactly These)

- project-status.json (machine-readable status + mergeMetadata)
- history/<module>.md (implementation record)
- docs/000-current-status.md (phase, module table, next action)
- docs/handoff.md (reality + cadence updates)

Nothing else. Never touch specs, Constitution, manifests, prompts, or implementation code.

## Rules

- **Only** the four files listed above may be touched, and **only after merge-readiness has approved** and the fast-forward merge + tag have completed.
- **Never** modify frozen baselines (Constitution, AGENTS.md, manifests, prompts/, docs/00x, etc.).
- Only reflect what was actually implemented and passed all gates.
- Keep tone factual. Link to evidence (build logs, test results, commit, tag) where useful.
- Do not add new architectural claims or change specs.
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

- **Only after merge-readiness** has given final approval and the module has been merged + tagged.
- After any post-merge status or handoff update required by the deterministic pipeline.
- Never during active implementation.

## Related

- module-implementation
- merge-readiness
- module-validation
