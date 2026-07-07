# Ray Studio Module Specifications (Layer 2)

This directory contains the official **Module Specifications** — Layer 2 of the Ray Studio Engineering Constitution system.

## Purpose

Module Specifications tell the AI **what to build** for a specific area of the system.

They are the bridge between the high-level principles in the Constitution (Layer 1) and day-to-day implementation work (Layer 3).

## Structure

- Use the exact numbering and naming from the Phase plan (e.g., `101-context-engine.md`).
- Every spec **must** follow the structure defined in `_template.md`.
- All specs must be consistent with the Ray Studio Engineering Constitution.

## Phases (from Phase info)

- **Phase A** — Core Platform (00x)
- **Phase B** — Context Engine (10x)
- **Phase C** — Memory (20x)
- **Phase D** — AI Providers (30x)
- **Phase E** — IDE Integration (40x)
- **Phase F** — Analytics (50x)
- **Phase G** — Automation (60x)
- **Phase H** — Infrastructure (70x)

See the full phased list in `Ray studio Engineering Constitution Phase info.md`.

## How to Use

When an agent is asked to implement something:

1. Identify the relevant module(s).
2. Load:
   - Ray Studio Engineering Constitution (Layer 1)
   - The specific `xxx-module-name.md` (Layer 2)
   - The corresponding `../validation/xxx.validation.md` (Layer 4) for objective acceptance criteria
3. Use the standardized implementation template (in `../templates/implementation.md`).
4. Perform graph-first retrieval for symbols and context.
5. Implementation is only complete when both Layer 2 requirements and all cases in the paired Layer 4 validation spec are satisfied.

## Status

This area is under active population following the priorities in the Phase info document.

Start with high-value modules in the Context, Memory, and Gateway areas, then expand to the broader platform.

## Template

Always copy from `_template.md` when creating a new spec.

## Layer 4 Validation Specifications

Validation specs (Layer 4) live in the sibling `../validation/` directory (e.g. `001-studio-shell.validation.md`). They were created for all Phase A foundational modules (001, 009–013, 016) before implementation per process recommendation. They turn the high-level AC and Testing Strategy into deterministic, auditable checks.