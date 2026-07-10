# Ray Studio — Grok Skills (Project Scope)

These skills are installed at the project level (`.grok/skills/`) and are automatically available when working inside this repository.

They enforce the **Sprint 1 rules** and the deterministic pipeline defined in:
- `AGENTS.md`
- `docs/000-current-status.md`
- `project-status.json`
- `implementation-manifests/`
- `Ray Studio Engineering Constitution.md`

**Skills reinforce the existing deterministic workflow** (AGENTS.md → status → manifest → Constitution → spec → implementation → gates → reviews → merge → post-merge).

They do **not** replace the pipeline.

## Phased Introduction (Approved Approach)

Do not build everything at once. Introduce skills incrementally as the project justifies them.

**Phase 1 (Core — Immediate / Always Use)**
- Module Implementation
- Validation Runner (module-validation)
- Architecture Compliance Review
- Build & Repair
- Merge Readiness

**Phase 2 (Governance — Strongly Recommended Now)**
- Scope Guard
- Manifest Resolver (new — standardizes context loading)
- Repository Auditor
- Constitution Compliance Checker
- Documentation Synchronizer (documentation-sync)

**Phase 3 (Specialized Architecture Reviewers)**
- IPC Contract Reviewer
- Security Reviewer
- Performance Reviewer
- Dependency Boundary Checker (new)

**Phase 4+**
- AI-specific (Context Engineer, Prompt Optimizer, Memory Reviewer)
- Release / automation skills

## Recommended Priority Order

| Priority | Skill                        | Why |
|----------|------------------------------|-----|
| 1        | Module Implementation        | Used on every module |
| 2        | Validation Runner            | Objective acceptance checks |
| 3        | Architecture Compliance Review | Prevents drift |
| 4        | Build & Repair               | Fast recovery from implementation issues |
| 5        | Merge Readiness              | Governance gate |
| 6        | Scope Guard                  | Prevents scope creep |
| 7        | Manifest Resolver            | Standardizes context loading |
| 8        | Repository Auditor           | Continuous governance |
| 9        | Constitution Compliance Checker | Enforces project rules |
| 10       | Documentation Synchronizer   | Keeps living docs accurate |
| 11+      | IPC, Security, Performance, Dependency Boundary, AI-specific reviewers | Needed as later phases mature |

## Review vs Repair Separation (Important)

**Review skills** (never modify code):
- architecture-compliance-review, module-validation, merge-readiness, repository-auditor, scope-guard, constitution-compliance-checker, ipc-contract-reviewer, dependency-boundary-checker, security-review, electron-ui-review

**Repair / Implementation skills** (may modify code):
- module-implementation, build-repair, post-merge-finalizer (targeted governance updates only), manifest-resolver (read-only orchestration)

Keeping responsibilities separate preserves auditability.

## Current Skills (Aligned to Review)

**Phase 1 Core (present):**
- module-implementation
- module-validation (Validation Runner)
- architecture-compliance-review
- build-repair
- merge-readiness

**Phase 2 Governance (present + newly added per review):**
- scope-guard
- manifest-resolver (added)
- repository-auditor
- constitution-compliance-checker
- documentation-sync (Documentation Synchronizer — post-merge only)

**Phase 3 Reviewers (partially present + added):**
- ipc-contract-reviewer
- security-review
- dependency-boundary-checker (added)

**Newly Added per this Review:**
- manifest-resolver
- post-merge-finalizer
- dependency-boundary-checker

**Supporting (keep as needed):**
- repository-navigation, electron-ui-review, refactoring

## Usage

- Skills load automatically when intent matches the `description`.
- Explicit: `/module-implementation`, `/manifest-resolver`, `/scope-guard`, etc.
- TUI: skills menu.
- Always start implementation sessions with: Scope Guard + Manifest Resolver.

See individual `SKILL.md` for full responsibilities, output formats, and "review only" declarations.

## Usage

- Skills load automatically when intent matches the `description`.
- Explicit: `/module-implementation`, `/architecture-compliance-review`, etc.
- TUI: skills menu.

These skills implement the exact workflows requested for disciplined, zero-drift Sprint 1 execution.
One module. One review. All gates green.

See individual `SKILL.md` for full responsibilities and output formats.
