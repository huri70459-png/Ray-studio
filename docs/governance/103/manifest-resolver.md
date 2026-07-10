# Manifest Resolver Output — Module 103

**Date:** 2026-07-10  
**Mode:** Governance preparation (resolver run against newly authored manifest)  
**Manifest:** `implementation-manifests/103-tree-sitter-parser.json`  
**Status:** ✅ Resolved for implementation readiness context (code not authorized)

---

## Manifest Resolved

**Active Module:** 103 – Tree-sitter Parser  
**Status:** Governance Ready (implementation **not** authorized)  
**Slice:** B.2-foundation-parser  
**Phase:** B (D1 first target)  
**Package:** `@ray-studio/ingestion`  
**Manifest:** `implementation-manifests/103-tree-sitter-parser.json`

---

## Required (load exactly these for implementation/validation)

| Path | Role |
|------|------|
| `prompts/modules/103-tree-sitter-parser.md` | Layer 2 Ready specification |
| `prompts/templates/implementation.md` | Layer 3 implementation template |
| `prompts/validation/103-tree-sitter-parser.validation.md` | Layer 4 validation package |

**Plus always (AGENTS.md pipeline):**

| Path | Role |
|------|------|
| `AGENTS.md` | Agent entry / deterministic order |
| `Ray Studio Engineering Constitution.md` | Layer 1 |
| `docs/000-current-status.md` | Living status (read-only; frozen this session) |
| `project-status.json` | Machine status (read-only; frozen this session) |

---

## Optional (load only when signalled)

- `docs/003-monorepo-architecture.md` — `packages/ingestion` placement  
- `docs/002-system-architecture.md` — system context  
- `docs/phase-b2-sequencing-decision.md` — D1 authority  
- `docs/governance/103/*` — this governance package  
- `prompts/modules/104-symbol-extractor.md` — downstream consumer shape (do not implement)  
- `history/phase-a-completion.md`, `history/101.md` — prior freezes  

---

## Forbidden (never touch / never implement under 103)

- `prompts/modules/102-*.md`, `105-*.md`, `201-*.md`, `301-*.md` as implementation targets  
- `packages/core/src/**` (all frozen domain trees including 101 context)  
- `apps/studio/**`  
- `packages/gateway/**`, `packages/mcp/**`  
- Memory / Provider runtime work  

---

## Depends On Modules

| Field | Value |
|-------|--------|
| `dependsOnModules` | `[]` (empty) |
| Rationale | 103 is foundation; no prior *module* hard-dep. Core Platform is ambient/frozen and must not be modified. |
| Soft reads | Frozen platform + 104 Draft for API foresight only |

---

## Allowed write paths (implementation session only)

When **implementation** is later authorized:

- `packages/ingestion/**` only (parser + package wiring)

Governance prep writes were limited to:

- Ready spec, Layer 4, manifest, `docs/governance/103/**`

---

## Frozen baselines (immutable)

- Constitution, AGENTS.md (architectural baseline)  
- Core Platform 001–016 sources and 101 B.1  
- `planrev.md`, `phase-b2-sequencing-decision-proposal.md`  
- Owner-frozen status set: handoff, 000-current-status, project-status (unless owner requests update)  
- `docs/phase-b2-sequencing-decision.md` (recorded decision — do not rewrite strategy)

---

## One Active Module Rule

Only **103** may be the implementation target in a future coding session.  
This resolver output does **not** start that session.

---

## Next Steps for Caller

| Caller | Action |
|--------|--------|
| Governance prep (this auth) | Complete remaining reports; **stop** |
| module-implementation | **Blocked** until separate implementation authorization |
| module-validation | Run only **after** implementation exists |
| architecture-compliance-review | After Layer 4 green on real code |

**Do not load anything outside this package for 103 implementation work.**
