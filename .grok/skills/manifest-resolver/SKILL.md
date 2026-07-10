---
name: manifest-resolver
description: Use at the start of any implementation or validation session. Loads the active module from project-status, resolves the correct implementation-manifest, determines required documents, forbidden areas, and produces a clean context package for the implementation skill.
---

# Manifest Resolver

**This skill standardizes the initial context loading for the deterministic pipeline.**

It removes the need for every implementation or validation skill to re-discover which manifest, status, and docs to load.

## When to Invoke

- First step before module-implementation
- Before module-validation
- Before architecture-compliance-review when a specific module is in scope
- Any time the "what files do I need?" question arises

## Responsibilities

- Read project-status.json to determine `nextModule` (or specified module) and approved state
- Load the matching `implementation-manifests/<module>.json`
- Resolve the full set of:
  - Required files (must load)
  - Optional files (load only if needed)
  - Forbidden files / modules (must not touch)
- Identify the active module name and owner
- Surface frozen baselines and one-active-module constraints
- Produce a concise "Resolved Context" summary that other skills can consume

## Process

1. Read `project-status.json` (nextModule, approvedModules, frozenBaselines, checkpointTag).
2. Read `docs/000-current-status.md` for human context.
3. Read the module's `implementation-manifests/<id>.json`.
4. Read AGENTS.md for the required loading order.
5. Cross-reference with Ray Studio Engineering Constitution (Layer 1).
6. Emit the resolved package.

## Output Format

**Manifest Resolved**

**Active Module:** 013 – IPC Framework  
**Status:** Next (approved)  
**Manifest:** implementation-manifests/013-ipc-framework.json

**Required (load exactly these):**
- prompts/modules/013-ipc-framework.md
- prompts/templates/implementation.md
- prompts/validation/013-ipc-framework.validation.md

**Optional (load only when signalled):**
- docs/007-ipc-architecture.md
- docs/010-security.md

**Forbidden (never touch):**
- prompts/modules/101-*.md and higher
- Any 016, 1xx, 2xx, 3xx modules

**Frozen Baselines:** Constitution, AGENTS.md, manifests, Core specs, docs/00x

**One Active Module Rule:** Only 013 may be modified in this session.

**Next Steps for Caller:**
- module-implementation: use the resolved required files + Constitution + spec only.
- Do not load anything outside this package.

## Related Skills

- module-implementation (primary consumer)
- scope-guard (run before or after to declare scope)
- module-validation
- architecture-compliance-review
