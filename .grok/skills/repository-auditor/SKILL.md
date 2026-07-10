---
name: repository-auditor
description: Use when you need to detect architectural drift, dependency violations, layer violations, unauthorized imports, verify module boundaries, or detect cyclic dependencies. Performs review and reporting only.
---

# Repository Auditor

**This skill performs review and reporting only. It does not implement or edit code.**

Use to preserve governance as the project grows. Run before/after implementation, pre-merge, or when drift is suspected.

## When to Invoke

- Periodically or before architecture-compliance-review
- Before merge-readiness
- When adding new modules or cross-cutting changes
- On suspicion of scope creep or import rule violations

## Checks (Mandatory)

- **Architectural drift**: code vs frozen baselines (Constitution, AGENTS.md, manifests, prompts/modules for Core, docs/00x)
- **Dependency violations**: renderer importing privileged packages/core/src/* directly (bypassing IPC); upward dependencies; cross-package cycles
- **Layer violations**: skipping layers, direct edits to frozen artifacts, ad-hoc logic in wrong packages
- **Unauthorized imports / ad-hoc channels**: grep for raw ipcMain, ipcRenderer, contextBridge exposure, or string channels outside approved contracts + preload/main wiring
- **Module boundaries**: only files allowed by current implementation-manifest + project-status.json approvedModules + one-active-module
- **Cyclic dependencies**: note import cycles via targeted grep + package.json analysis (no heavy tools unless already present)

## Process

1. Read project-status.json (nextModule, approvedModules, frozenBaselines).
2. Read the active module's implementation-manifest.
3. Read Constitution §5 (monorepo), §7 (IPC), relevant AGENTS.md rules.
4. Use grep + read_file (graph-first where possible) to scan imports in apps/studio/src and electron-main vs packages/core.
5. Specifically search for channel strings, direct fs/watcher imports in renderer, etc.
6. Cross-check against 013+ IPC rules if applicable.
7. Produce report.

## Output Format

**REPOSITORY AUDIT REPORT**

**Drift:** None | list with file references

**Dependency / Layer Violations:**
- ...

**Unauthorized / Ad-hoc:**
- ...

**Boundary / Active Module:**
- ...

**Cycles:**
- None detected | ...

**Required Fixes:**
- (none)
- OR concrete list with locations

**Recommendation:**
- Clean for architecture-compliance-review
- OR blocked until fixes

Never propose code changes. Flag only.

## Related Skills

- architecture-compliance-review
- constitution-compliance-checker
- scope-guard
- security-review
- module-validation
