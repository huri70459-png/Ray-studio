# 012 — Roadmap

**Status:** Living Reference (Sprint 0)  
**Date:** 2026-07-07

## Guiding Principle
Build the **persistent shared brain** first. Beautiful UI, advanced features, and multi-AI polish come after the knowledge graph, ingestion, and gateway are solid.

Follow the vision in the founding plan: one graph that Claude, Grok, and other tools all consult and contribute to.

## Sprint 0 — Engineering Foundation (Current)
- [x] Create permanent reference documentation (`docs/001`–`012`)
- [ ] Define core entities, relationships, and schemas in `packages/core`
- [ ] Choose and integrate primary graph database + Graphiti layer
- [ ] Skeleton monorepo + workspace setup
- [ ] Basic AI Gateway with at least 2 providers + context injection
- [ ] Local-first persistence strategy
- [ ] Initial documentation and ADR process

## Near Term (Foundation + Core Loop)
- Desktop shell with excellent command palette
- Quick capture (hotkey) that writes directly to the graph
- Code + git ingestion pipeline (basic)
- Graph query surface (text + simple visualization)
- Ability for an external AI (via gateway or MCP) to pull relevant context
- ADR capture flow

## Mid Term
- Rich interactive graph explorer
- Advanced ingestion (full call graph, dependency analysis)
- MCP tool hosting and discovery inside the studio
- Context inspector showing exactly what will be sent to the model
- Multi-project support
- Better prompt / template management in `prompts/`
- Performance and scale testing of the graph

## Later Horizons
- Standalone AI Gateway service (so VS Code + CLIs can use it without the full desktop)
- Team / shared graph capabilities (opt-in, with strong privacy)
- Deeper editor integrations
- Local model support (Ollama + graph context)
- Visualization and "architecture as code" exports
- Plugin / extension model for custom tools and views

## Explicit Sequencing Rules
- No fancy UI before reliable graph storage + retrieval.
- No team features before excellent single-user local experience.
- No cloud before local graph + gateway are proven.
- Every significant decision gets an ADR and is recorded in the project's own graph.

## References
- `001-product-requirements.md`
- `All-living memory/Graphiti-memory/Propossed plan.md`
- This entire `docs/` set
