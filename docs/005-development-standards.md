# 005 — Development Standards

> **Governing document:** Ray Studio Engineering Constitution.md (root, Layer 1).  
> This file contains historical / detailed reference material. All AI agents and humans must follow the Constitution.

**Status:** Reference (Sprint 0)

## Core Philosophy
Follow the Enterprise Core + Ponytail (lazy senior) principles already active in this environment:

**Priorities (in order):**
1. Safety, Security, Correctness
2. Reliability & Observability
3. Maintainability
4. Performance (measured, not assumed)

**Ponytail Ladder** (stop at the first that applies):
1. Do we need this at all?
2. Does it already exist here?
3. Does the language / platform stdlib do it?
4. Is there an installed dependency?
5. Can it be one clean line?
6. Then write the smallest correct thing.

Mark shortcuts with `// ponytail:` + noted ceiling.

## TypeScript & Code Quality
- Strict TypeScript everywhere.
- No `any` except at explicit trust boundaries with narrowing.
- Shared types live in `packages/core`.
- Prefer explicit over clever.

## Documentation Discipline
- Architecture or contract changes **must** update the corresponding `docs/00x-*.md` file.
- Use ADRs for significant decisions (`docs/ADR/`).
- The knowledge graph (Graphiti) is an *additional* memory, not a replacement for written docs.

## AI Usage Guidelines (meta)
- **All AIs are governed by the Ray Studio Engineering Constitution.md (root).** This is Layer 1 and the permanent source of truth.
- All AIs must start with Codebase Memory MCP graph tools before reading files or making changes (see Constitution §4).
- Important decisions, entities, and traces must be ingested back into the graph.
- Never rely solely on chat history. The Constitution + graph + module specs are the context.

## Architecture & Boundaries
- Desktop / gateway owns secrets (LLM keys).
- Graph operations are explicit and auditable.
- MCP tools are capability-scoped.
- Renderer (if desktop) follows the same untrusted process model as other secure desktop apps.

## Testing
- Types are the first line of defense.
- Unit tests for core domain logic, ingestion, gateway routing.
- Integration tests for graph roundtrips.
- Manual + automated verification of multi-AI context sharing.

## Tooling
- Consistent root-level lint, typecheck, build scripts via workspaces/turbo.
- Prefer boring, proven tools.

## References
- Root AGENTS.md / Claude.md files (enterprise + ponytail rules)
- This docs set
