---
name: merge-readiness
description: Use when a module has passed implementation, build-repair, validation, and architecture review and you are preparing the final decision to merge.
---

# Merge Readiness

**Before merging any module, run this skill.**

Verifies all objective evidence required by Sprint 1 rules and the 7 gates.

## Verify (in order)

- Build (Gate 1 + 2)
- Tests (Gate 4)
- Typecheck (Gate 3)
- Architecture review (Gate 5) — must have PASS from architecture-compliance-review
- Documentation updated (Gate 6) — README, 000-current-status, handoff, implementation summary, relevant specs if touched
- Version / package consistency (if applicable)
- Changelog or summary artifacts
- Known risks documented and accepted (or none)

## Cross-checks

- Only one module was touched (per Rule 2)
- No forbidden files modified
- No drift from frozen baselines
- All dependsOnModules are in compatible state (if applicable)
- IPC contracts and ownership respected
- Evidence package complete (summary, files changed, statuses)

## Output Format

**Merge Approved**

or

**Blocked**

**Blockers:**
- ...

**Evidence Summary:**
- Build: green
- ...
- Arch review: PASS (ref: ...)
- Docs: updated

**Risks:**
- ...

**Recommendation:** Merge now | Address blockers first then re-run

Only output "Merge Approved" when every item is verified clean. Otherwise list exact blockers.

## Related Skills

- module-implementation
- build-repair
- module-validation
- architecture-compliance-review
