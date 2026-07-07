# Ray Studio

**AI-native development operating system with a persistent shared knowledge graph.**

All work on this project is governed by the **Ray Studio Engineering Constitution** (see `Ray Studio Engineering Constitution.md` at the root).

## Quick Start for AI Agents
1. Read the Constitution (Layer 1).
2. Start every task with the Codebase Memory MCP graph tools.
3. Use layered prompts (Constitution → Module Spec → symbols).
4. Follow the strict Definition of Done.

## Development
```bash
pnpm install
pnpm constitution:check     # governance check
pnpm build
```

See `docs/` for architecture, monorepo, and standards references (the Constitution is the single source of truth).

**Current complete project information:**
- `docs/000-current-status.md` — Full state, structure, design seeds, external origins, and cleanup notes.
- `docs/handoff.md` — Resume from here, key decisions, cleared sessions, immediate next actions.

These two documents consolidate prior scattered planning so agents load minimal external context.

## Prompts
Layered prompt templates live in `prompts/`.

---

**Modules 001 + 009 + 010 Merged (2026-07-08 reviews: 9.7/10 + 9.8/10 + 9.9/10).** 011 Commits created (feat 63e9ac0 + docs b5571a5 + f4102ee). Awaiting merge to main.
Merge metadata in `project-status.json`. Checkpoint tags: `core-platform-001-009-complete`, `core-platform-001-010-complete` (after commit).  
**Sprint 1**: Core Platform. 001/009/010 immutable except defects. 011: ✅ Commits created (feat 63e9ac0). Awaiting merge. Next after merge: 012. Constitution + frozen pipeline. No workflow changes unless deficiency in ≥3 modules.