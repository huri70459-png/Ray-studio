# implementation-manifests/

This directory is the **single source of truth** for what context an implementation or validation agent must load for each approved module.

## Usage (per AGENTS.md deterministic pipeline)

1. Read AGENTS.md
2. Read docs/000-current-status.md (phase, frozen items, next work, do-not-touch)
3. Load the relevant `<module>.json` from this directory.
4. Load **exactly** the `required` files listed.
5. May load `optional` only when truly needed for the task.
6. **Never** load anything in `forbidden` or outside the manifest.
7. `dependsOnModules` tells you which other module specs are relevant for interfaces.

Current Status + Manifest together eliminate context drift before you ever open a module spec.

## Primary Context Rule

The live files in this repo are the context:
- `AGENTS.md`
- `docs/`
- `prompts/`
- `implementation-manifests/`

`project-context/` (if it exists) is only a generated convenience snapshot for tools that cannot access the repo directly.

## Naming

`<module-slug>.json` (e.g. `009-workspace-manager.json`)

## When to Update

- When a module spec changes its dependencies or public contracts.
- When new optional or forbidden rules are discovered.
- Via the normal change process (ADR if it affects governance).

Do not edit manifests lightly — they control AI context scope.

## Extended Fields (for automation)

Manifests also carry machine-readable hints (added 2026-07-07 per review feedback before workflow freeze):

```json
{
  "estimatedContextTokens": 7200,
  "priority": "critical",
  "implementationOrder": 1,
  "validationRequired": true
}
```

- `estimatedContextTokens`: Rough token cost of the module's `required` files (spec + template + validation). Use for prompt budgeting / scheduling.
- `priority`: "critical" | "high" | ... (all Core Platform start as critical).
- `implementationOrder`: 1..N sequence (follows the approved order in docs/000-current-status.md).
- `validationRequired`: boolean — Layer 4 validation spec must be satisfied.

Agents and tooling (Codex, Claude Code, CI, etc.) can consume these directly after loading the manifest + project-status.json.
