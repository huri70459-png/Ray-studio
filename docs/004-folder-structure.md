# 004 — Folder Structure

**Status:** Reference (Sprint 0)

## Canonical Layout (Monorepo)

```
Ray-studio Creations/Ray Studio/
├── apps/
│   └── studio/
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/              # Shared design system components
│       │   │   ├── graph/           # Graph visualization components
│       │   │   ├── command-palette/
│       │   │   └── ai/
│       │   ├── routes/ or views/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── main.tsx (or equivalent)
│       ├── src-tauri/               # or electron main + preload
│       ├── public/
│       └── package.json
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── types/
│   │       ├── entities/            # Node/relationship definitions
│   │       ├── schemas/
│   │       └── utils/
│   ├── ui/
│   │   └── src/
│   │       ├── components/
│   │       ├── tokens/
│   │       └── index.ts
│   ├── gateway/
│   │   └── src/
│   │       ├── providers/
│   │       ├── context/
│   │       └── index.ts
│   ├── mcp/
│   ├── ingestion/
│   └── db/
├── docs/                            # ← This directory (immutable references)
│   ├── 001-product-requirements.md
│   ├── 002-system-architecture.md
│   ├── ...
│   └── ADR/                         # Future Architecture Decision Records
├── prompts/                         # Curated system prompts & templates
├── tools/
│   └── cli/
├── All-living memory/               # Current memory/config assets (keep organized)
├── .codebase-memory/
├── .vscode/
├── package.json
├── turbo.json (if used)
└── README.md
```

## Important Conventions
- `docs/` at root is for permanent engineering foundation docs. The **governing source of truth** is `Ray Studio Engineering Constitution.md` (root, Layer 1) + `prompts/`.
- Project-specific decisions go into `docs/ADR/`.
- Source of truth = Constitution + graph + module specs (in `prompts/modules/`) + ADRs. Not chat logs.
- `prompts/` contains the curated layered prompt system (see Constitution §11).

## Current State
The project is in its earliest phase. The existing `All-living memory/Graphiti-memory/Propossed plan.md` captures initial thinking. New code and structure will follow the layout above.

## References
- `003-monorepo-architecture.md`
- Founding plan document (folder structure recommendations)
