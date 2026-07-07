# 003 — Monorepo Architecture

**Status:** Target Reference (Sprint 0)  
**Current State:** Very early (mostly memory configs + planning doc)  
**Goal:** Establish clean monorepo boundaries from the beginning

## Rationale
The founding plan recommends strong separation of concerns and a clear project structure. A monorepo enables:
- Shared types/contracts between the desktop studio, memory clients, ingestion tools, and MCP components
- Independent evolution of the UI shell vs. the knowledge engine
- Easy extraction of the "AI Gateway" into a standalone service later
- Consistent tooling across the stack

## Recommended Structure

```
Ray-studio Creations/Ray Studio/
├── apps/
│   └── studio/                 # Main desktop application
│       ├── src/                # Renderer / UI shell
│       ├── src-tauri/ or electron-main/
│       ├── package.json
│       └── ...
├── packages/
│   ├── core/                   # Shared domain models, entities, schemas
│   │   └── src/
│   │       ├── graph/          # Entity types, relationship types
│   │       ├── memory/         # Graphiti client abstractions
│   │       └── llm/            # Provider interfaces, message types
│   ├── ui/                     # Design system + shared components
│   │   └── (Raycast-inspired primitives + graph viz components)
│   ├── gateway/                # AI orchestration & context injection
│   │   └── (can be used by desktop or run standalone)
│   ├── mcp/                    # MCP client/server helpers + tool registry
│   ├── ingestion/              # Code indexer, git trace ingester, ADR parser
│   └── db/                     # Database adapters and migration tools
├── services/                   # Optional standalone services (future)
│   └── graph-gateway/
├── tools/
│   └── cli/                    # ray-cli for ingestion, queries, etc.
├── docs/                       # Permanent reference (this directory)
├── prompts/
├── .codebase-memory/
├── package.json                # Root workspaces
└── pnpm-workspace.yaml (or equivalent)
```

## Package Boundaries (enforced)
- `packages/core` — pure, no UI, no heavy deps. Used everywhere.
- `packages/ui` — React + visualization components. Depends on core.
- `packages/gateway` — LLM abstraction + context assembly. Can run in Node or browser context carefully.
- `packages/mcp` — MCP protocol helpers. Transport agnostic.
- `apps/studio` — the full product. Can depend on all packages.
- Tools and services depend on core + relevant packages.

## Tooling Choices (initial)
- pnpm workspaces (or npm)
- TypeScript project references
- Turborepo (or simple scripts) for task orchestration
- Shared ESLint / Prettier / TypeScript configs at root

## Alignment with Founding Plan
The plan shows recommended folder structure inside projects:
- `docs/` (with ADR/, Architecture/, etc.)
- `src/`
- `prompts/`
- `graphiti/`

We will make the monorepo itself follow similar disciplined documentation and separation.

## Migration Notes
Currently almost no code. We will grow into this structure immediately rather than refactoring later.

## References
- `004-folder-structure.md`
- `All-living memory/Graphiti-memory/Propossed plan.md` (folder structure section)
