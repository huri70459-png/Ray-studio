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

**Sprint 0 complete (2026-07-07).**  
This repository is now in **Sprint 1: Core Platform Implementation**.  
Objective: Implement the approved architecture (starting with Module 001) with zero architectural drift.  
The Constitution + frozen pipeline ensure consistency.