---
name: dependency-boundary-checker
description: Use to detect forbidden imports, dependency inversions, ownership boundary violations, cyclic dependencies, and unapproved module interactions. Review-only skill focused on the layered architecture rules.
---

# Dependency Boundary Checker

**Review-only skill. Never modifies code.**

Specialized checker for Ray Studio's strict layered and module ownership model. Complements repository-auditor and constitution-compliance-checker with a narrow focus on import and dependency discipline.

## When to Invoke

- During or after any module implementation
- Before architecture-compliance-review
- Before merge-readiness
- When introducing new cross-package usage or IPC contracts
- Periodically to prevent gradual boundary erosion

## Checks (Mandatory)

- **Forbidden imports**: renderer code importing directly from packages/core/src/fs, watcher, project, etc. (must go through IPC contracts only)
- **Dependency inversions**: lower layers depending on higher layers, or apps depending on implementation details instead of contracts
- **Ownership boundaries**: code belonging to one module (per manifest) being edited or imported by another active module
- **Cyclic dependencies**: import cycles between packages or within a package
- **Unapproved interactions**: direct calls or imports between modules that are not declared as dependencies in the active manifest or roadmap
- **Contract bypass**: any direct use of internal service classes instead of the typed contracts registered via IPC Framework (013+)

## Process

1. Read the active module's implementation-manifest (required/forbidden/dependsOnModules).
2. Read project-status.json for approvedModules and one-active state.
3. Use targeted grep + read_file on import statements in apps/studio and packages/.
4. Trace key symbols across boundaries.
5. Compare against Constitution §5 (Monorepo Standards) and §7 (IPC Standards).
6. Report violations with exact file + line references.

## Output Format

**Dependency Boundary Check: PASS / FAIL**

**Forbidden Imports:**
- ...

**Dependency Inversions:**
- ...

**Ownership Violations:**
- ...

**Cycles Detected:**
- None | list with paths

**Unapproved Interactions:**
- ...

**Contract Bypasses (013+):**
- ...

**Required Fixes:**
- (none)
- OR concrete list

**Recommendation:**
- Safe to proceed to architecture review
- OR must fix before further review

## Related Skills

- repository-auditor
- constitution-compliance-checker
- architecture-compliance-review
- ipc-contract-reviewer (for contract boundary enforcement)
- scope-guard (to confirm scope before checking boundaries)
