---
name: constitution-compliance-checker
description: Use to verify security rules, renderer isolation, IPC ownership, module ownership, dependency direction, the one-active-module rule, Definition of Done, and overall Constitution compliance. Complements the constitution:check script.
---

# Constitution Compliance Checker

**Review-only skill. Use this skill to go beyond build quality and verify governance and architectural invariants from the Ray Studio Engineering Constitution.**

Run during implementation gates, before architecture-compliance-review, and before merge-readiness.

## When to Invoke

- After module-implementation claims gates are green
- Before architecture-compliance-review
- Before merge-readiness
- When constitution:check is run or when governance questions arise

## Checks (Mandatory)

- **Priorities & Ponytail**: Safety/Security/Correctness/Compliance first; ponytail ladder followed and shortcuts marked
- **Renderer Isolation** (Constitution §7): contextIsolation true, nodeIntegration false, sandbox, preload only exposes narrow APIs via contextBridge, no secrets or Node in renderer
- **IPC Ownership**: Channel registration, registry, contracts owned exclusively by the IPC framework (013). No ad-hoc channels elsewhere
- **Module Ownership & One Active Module**: Only the declared nextModule in project-status.json is being touched. No cross-module work
- **Dependency Direction**: packages/core is the shared leaf; apps/studio import via contracts only; no upward or forbidden dependencies
- **Definition of Done (§9)**: build clean, lint clean, typecheck clean, tests pass, docs per §8, no placeholders, structure/import rules followed, constitution:check considered, graph ingestion for lasting decisions
- **Frozen Baselines**: AGENTS.md, Constitution, implementation-manifests/, prompts/modules (Core), docs/00x untouched except via proper process
- **Script Check**: Run `pnpm constitution:check` and incorporate results (note pre-existing wiring gaps are expected early)

## Process

1. Read Constitution (focus §2, §5, §7, §9, §10).
2. Read AGENTS.md and current project-status.json.
3. Run the wired script: `pnpm constitution:check`.
4. Inspect key files for isolation, IPC, imports, active module.
5. For IPC-related work, cross-check against ipc-contract-reviewer findings.
6. Evaluate every check above.

## Output Format

**Constitution Compliance: PASS / FAIL**

**Priorities & Ponytail:** ...
**Renderer Isolation:** ...
**IPC Ownership:** ...
**Module Ownership / One-Active:** ...
**Dependency Direction:** ...
**Definition of Done:** ...
**Frozen Baselines:** ...

**constitution:check output summary:**
...

**Required Fixes:**
- ...

**Recommendation:**
- Ready for architecture-compliance-review
- OR blocked (list exact violations with references to Constitution sections)

## Related Skills

- architecture-compliance-review
- module-validation
- merge-readiness
- scope-guard
- repository-auditor
- ipc-contract-reviewer (when 013+)
