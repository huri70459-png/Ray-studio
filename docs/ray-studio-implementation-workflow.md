# Ray Studio — Implementation Workflow (Blueprint + Adoption)

**Source:** `Blueprint for implementaion-plan.md` + user refinements (2026-07-07)  
**Status:** Updated with latest user refinement (insert Current Status immediately after AGENTS.md):
- New order: AGENTS.md → Current Status → implementation-manifests/ → Constitution → ...
- Deterministic pipeline now explicitly documented.
- Current Status is the place that tells agents phase / frozen / next / do-not-touch.
Implementation-manifests/ + 7 manifests already exist. AGENTS.md, templates, and this doc updated.

**Related:** Ray Studio Engineering Constitution (Layer 1), prompts/modules/ (Layer 2), prompts/validation/ (Layer 4), prompts/templates/ (L3 + validation), AGENTS.md, implementation-manifests/

---

## The Layered Implementation Pipeline (Updated)

```
AGENTS.md
        │
        ▼
docs/000-current-status.md     ← Know the phase, frozen items, next work, what not to touch
        │
        ▼
implementation-manifests/<module>.json
        │
        ▼
Engineering Constitution (Layer 1)
        │
        ▼
Module Specification (Layer 2)
        │
        ▼
Implementation Template (Layer 3)
        │
        ▼
Repository Graph (Codebase Memory MCP)
        │
        ▼
Implementation
        │
        ▼
Validation (Layer 4)
        │
        ▼
Merge
```

**Critical insertion**: Current Status is read *immediately after AGENTS.md* and *before* the module manifest.

This gives the agent immediate awareness of:
- Current phase of the repository
- Which modules are frozen / approved
- Which module is next
- What should **not** be touched yet

The manifest then provides the precise per-module context contract.

The live repository (`AGENTS.md` + `docs/` + `prompts/` + `implementation-manifests/`) is the primary context source.

## Deterministic Pipeline (No Interpretation)

When instructed:

**Implement Module: 011 File System Service**

The agent must read **exactly** in this order:

1. AGENTS.md
2. docs/000-current-status.md
3. implementation-manifests/011-file-system-service.json
4. Ray Studio Engineering Constitution.md
5. prompts/modules/011-file-system-service.md
6. prompts/templates/implementation.md

**Rules:**
- Implement **only** Module 011.
- Do not modify unrelated modules.
- Produce production-ready code.
- Include tests.
- Stop after Implementation Summary and Validation results.

No interpretation. No guessing. Exactly what Ray Studio is designed to enforce.

---

## Blueprint Steps (Reviewed & Adopted)

### Step 1 — Freeze Documentation

At this point freeze (read-only unless architecture change via ADR):

- `docs/000-current-status.md`
- `docs/handoff.md`
- `Ray Studio Engineering Constitution.md`
- `prompts/templates/implementation.md`
- `prompts/modules/001-studio-shell.md`
- `prompts/modules/009-workspace-manager.md`
- `prompts/modules/010-project-manager.md`
- `prompts/modules/011-file-system-service.md`
- `prompts/modules/012-file-watcher.md`
- `prompts/modules/013-ipc-framework.md`
- `prompts/modules/016-sqlite-layer.md`
- (and their paired `prompts/validation/*.validation.md`)

These become the stable foundation.

### Step 2 — Never Paste Documentation Again

Stop copying large amounts of the Constitution + multiple specs + handoff + status into every chat.

### Step 3 — Repository as Primary Context + Generated Snapshots (updated)

**Primary context lives in the live repository itself:**

- `AGENTS.md`
- `docs/`
- `prompts/`
- `implementation-manifests/`   ← new dedicated location for all manifests
- `packages/` / `apps/` (once code exists)

This eliminates manual duplication.

**`project-context/` (optional, secondary)**

Can still exist as a *generated snapshot* for tools without direct repository access (e.g. some web UIs or paste-only sessions).

- It should be produced by a script or manual export from the approved live sources.
- Do **not** maintain it as a parallel source of truth.
- Update it only when the primary sources change (via ADR or release process).

The repository + manifests is the source. project-context is a convenience export.

### Step 4 — AI Reads Only What It Needs

Example for implementing **009 Workspace Manager**:

The AI receives **only**:
- Layer 1: Engineering Constitution
- Layer 2: 009 Workspace Manager spec
- Layer 3: Implementation Template
- Current (targeted) repository content via graph or manifest

**Never** send Context Engine, Provider Router, Memory, etc. They are irrelevant to this task.

### Step 5 — Standardize Every Chat (tiny prompts)

Every implementation chat starts with a focused ~300-word prompt:

```
Project: Ray Studio

You are implementing exactly ONE approved module.

Mandatory References (load via manifest or exact paths):
1. Ray Studio Engineering Constitution.md
2. prompts/modules/009-workspace-manager.md
3. prompts/templates/implementation.md
4. prompts/validation/009-workspace-manager.validation.md   (Layer 4)

Rules:
- Follow Constitution exactly (especially §4 Token Optimization, §5 Monorepo, §9 DoD).
- Do not modify unrelated modules.
- Implement only the approved scope in the Module Spec + satisfy every case in the paired validation spec.
- Production-ready only. No TODOs, placeholders, or mocks.
- Maintain backward compatibility where defined.
- Update tests, documentation, and the knowledge graph.

When finished produce:
- Implementation Summary
- Validation Summary (or hand off to separate validation chat)
- Files Modified
- Remaining Risks

Stop.
```

### Step 6 — Give Codex (or equivalent) Access to the Repository

Best experience:
- Open the folder in an AI tool with direct FS access (Codex, Claude Projects, Cursor, etc.).
- Tell it: "Read the Constitution, read the Module Spec for 009, read the Implementation Template (and the manifest). Implement only approved scope."

No token waste from pasting.

### Step 7 — One Chat Per Module

Sequential, focused:

Chat 1 → Workspace Manager → Done + summaries  
↓  
Chat 2 → SQLite Layer → Done + summaries  
↓  
Chat 3 → IPC Framework → ...

This matches how the specifications were deliberately created (dependency order).

### Step 8 — Validation Chat (separate)

Open a **new chat**.

```
You are NOT implementing.
You are reviewing for compliance.

Read:
- Constitution
- The Module Spec (009-...)
- The Layer 4 Validation Spec
- The generated code / diff

Determine and list ONLY deviations in:
- Architecture compliance
- Performance targets
- Security / boundaries / IPC contracts
- Testing coverage
- Maintainability / Constitution §9 DoD
- Correct use of manifest / minimal context

Separate implementation and review.
```

---

## The Key Improvement: implementation-manifests/ Directory

All manifests live in a dedicated top-level directory:

```
implementation-manifests/
├── 001-studio-shell.json
├── 009-workspace-manager.json
├── 010-project-manager.json
├── 011-file-system-service.json
├── 012-file-watcher.json
├── 013-ipc-framework.json
└── 016-sqlite-layer.json
```

Example (`implementation-manifests/009-workspace-manager.json`):

```json
{
  "moduleId": "009",
  "name": "Workspace Manager",
  "required": [
    "prompts/modules/009-workspace-manager.md",
    "prompts/templates/implementation.md",
    "prompts/validation/009-workspace-manager.validation.md"
  ],
  "optional": [
    "docs/003-monorepo-architecture.md",
    "docs/004-folder-structure.md",
    "docs/005-development-standards.md"
  ],
  "forbidden": [
    "prompts/modules/101-*.md",
    "prompts/modules/102-*.md",
    "prompts/modules/201-*.md",
    "prompts/modules/301-*.md"
  ],
  "dependsOnModules": ["011", "013", "016"],
  "notes": "All path validation comes from 011. Persistence via 016. IPC contracts via 013."
}
```

**Rule**: The agent starts from AGENTS.md, loads the manifest for the target module, then loads *exactly* the declared required files + graph symbols. No more, no less.

Manifests also capture module dependencies so the agent knows which other specs are safe/necessary to consult for interfaces.

---

## Review & Understanding (Grok, 2026-07-07)

### Strengths of the Blueprint
- Perfectly consistent with the existing Ray Studio Engineering Constitution (esp. §4 Token Optimization and §11 Layered Prompt System).
- Directly solves the "context drift" and "token waste" problems that the Constitution warns about.
- Matches the Layer 1-4 pipeline already partially built (we have L4 validation specs for the exact 7 modules the blueprint calls out).
- One-module-per-chat + separate validation chat is the professional, low-risk way to use AI for implementation.
- The manifest idea is the natural evolution of the "minimal context" philosophy.

### Current State Alignment (as of 2026-07-07)
- **Layer 1**: Constitution v1.0.0 — complete and should be frozen.
- **Layer 2**: The 7 Phase A Core Platform module specs (001, 009–013, 016) — Architecture Approved + paired Layer 4 validation specs created.
- **Layer 3**: `prompts/templates/implementation.md` exists and was recently updated to reference Layer 4.
- **Layer 4**: Full set of `prompts/validation/*.validation.md` for the foundational modules.
- Agent surfaces (AGENTS.md, .claude/CLAUDE.md, .cursor/rules) already require graph-first + Constitution.
- `packages/` and `apps/` are empty — perfect time to adopt the workflow *before* writing code.

**Gaps vs this updated Blueprint** (largely addressed):
- `implementation-manifests/` + 7 manifests created.
- AGENTS.md, implementation template, and this doc updated for manifest-first + repo-primary flow.
- project-context/ documented as generated/secondary.
- Short `prompts/templates/validation.md` created.
- FROZEN notices and further wiring (handoff/status/README) remain recommended next steps.

No contradictions. This blueprint is the missing operational layer on top of what has already been built.

### Why Follow It Now
Before any production code is written in `packages/`, we lock in the disciplined, minimal-context process. This gives implementation agents (and humans) objective guardrails and dramatically reduces the chance of scope creep or architectural drift.

---

## How to Use (After Approval)

### Option A — Direct Repository Access (Recommended & Primary)
1. Open the Ray Studio folder in your AI coding tool.
2. The tool/AGENTS will direct you to the relevant file in `implementation-manifests/`.
3. Load *only* the files declared as `required` in that manifest.
4. Use the Repository Graph (MCP tools) for symbols.
5. Follow the short standardized prompt (see Step 5).
6. For validation, open a fresh chat and load the manifest + the generated changes + the paired `.validation.md`.

### Option B — Paste-only / No repo access
Use the content of this workflow document (or a generated snapshot from `project-context/` if available). Load exactly the files the relevant manifest would have declared. Never include forbidden modules.

The live repo (`implementation-manifests/` + `prompts/` + `docs/`) is always preferred over any snapshot.

---

## Next Actions (Post Approval of This Doc)

1. Mark this doc approved (or note revisions).
2. Create the `implementation-manifests/` directory + manifests for the 7 foundational modules (primary context mechanism).
3. (Optional / secondary) Create `project-context/` as a generated snapshot only.
4. Add FROZEN notices to the listed files.
5. Create `prompts/templates/validation.md` if not present.
6. Ensure AGENTS.md, README, handoff, status point to the manifest-driven workflow.
7. (Optional) Enhance `scripts/check-constitution.js` to validate manifests.
8. Begin actual implementation with **one fresh chat per module** using the manifest as the contract for context.
9. Always load the manifest first, then Constitution/Module/Template, then Graph.

---

**This document is the reviewed and adopted version of the Blueprint for implementaion-plan.md. It turns the recommendation into the project's official implementation operating procedure.**

See original: `Blueprint for implementaion-plan.md` (in repo root).  
Governed by the Ray Studio Engineering Constitution.

(End of shareable workflow doc)
