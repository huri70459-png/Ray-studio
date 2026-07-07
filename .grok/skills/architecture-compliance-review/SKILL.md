---
name: architecture-compliance-review
description: Use when an implementation module is complete and requires architecture compliance verification, or before any merge decision. This skill performs review only.
---

# Architecture Compliance Review

**This skill only reviews. It does not implement or edit code.**

Separate implementation from review (as recommended for quality). Use after module-implementation and before merge-readiness.

## When to Invoke

- After a module claims "implementation complete"
- Before merging any module
- When asked to "review architecture", "check compliance", "validate against Constitution"
- Periodically during long implementation to catch drift early

## Checks (mandatory)

- Constitution compliance (priorities, ponytail ladder, §4 token opt, §5 monorepo, §7 UI/IPC/perf, §9 DoD)
- Dependency direction (no upward or forbidden dependencies)
- Ownership boundaries (per module manifests + docs/004)
- IPC rules (untrusted renderer never bypasses typed boundary; contracts respected)
- Security (no secret leakage, proper isolation, validation at boundaries)
- Performance budgets (command palette <80ms target, etc. as specified)
- Scope creep (only touches files allowed by current manifest + approvedModules)
- Frozen baseline violations (AGENTS.md, Constitution, manifests, templates, specs)
- Layering (no skipping Layer 1-3; no direct edits to frozen artifacts unless proven insufficient by impl)

## Process

1. Read the current module's implementation-manifest.
2. Read the Module Spec and paired validation spec.
3. Read Constitution and relevant docs.
4. Inspect changed files + relevant graph symbols.
5. Run targeted checks (build/typecheck may be assumed green from prior skill).
6. Evaluate against each check above.

## Output Format (exact)

**PASS**

or

**FAIL**

**Reasons:**
- ...

**Architecture Drift:**
- None detected
- OR list of specific violations with file/line references

**Required Fixes:**
- (none)
- OR concrete list

**Recommendation:**
- Ready for merge-readiness skill
- OR blocked until fixes + re-review

If FAIL, the implementation agent must address **Required Fixes** before re-submission. No merge.

## Scope

- Review only the active module.
- Do not propose new architecture.
- Flag any deviation from frozen baselines immediately.
- Note any real defects exposed by implementation that may justify an ADR.

## Related

- module-implementation (produces the code under review)
- module-validation
- merge-readiness (consumes this review)
- security-review (can be composed)
