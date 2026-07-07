# 002 — System Architecture

**Status:** Reference (Sprint 0)  
**Last Updated:** 2026-07-07  
**Project:** Ray Studio

## High-Level Vision
Ray Studio is a **desktop-centric AI development operating system** built around a **persistent knowledge graph** as the central brain.

Multiple AI frontends (Claude Code, Grok CLI, ChatGPT, custom studio UI) all consult and contribute to the same graph.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Ray Studio Desktop                      │
│  (Command Palette • Graph Explorer • Capture • AI Orchestrator) │
├─────────────────────────────────────────────────────────────────┤
│  AI Gateway / Router (context injection, logging, model choice) │
├──────────────────────────────┬──────────────────────────────────┤
│     Knowledge Layer          │          Tooling Layer           │
│  • Graphiti (or equivalent)  │  • MCP Server Registry           │
│  • Graph DB (Neo4j / alt)    │  • Code indexing                 │
│  • Embeddings + Hybrid Search│  • ADR / Docs management         │
│  • Entity + Relationship     │  • Traces & call path analysis   │
│    models                    │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│                    Local Storage + Optional Sync                │
│  (Graph DB files, embeddings, project docs, config)             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Claude Code       Grok / xAI      Other LLMs + Tools
```

## Core Layers

### 1. Studio Shell (Desktop UI)
- Fast, keyboard-driven interface (inspired by Raycast)
- Graph visualization and exploration
- Capture surfaces (quick thought, decision, code snippet)
- AI chat surfaces scoped to project context
- Settings for providers, memory backends, MCP tools

### 2. AI Gateway / Orchestration
- Single place that injects relevant graph context into every prompt
- Model selection / routing logic
- Logging of important interactions back into the graph
- Abstraction over different LLM providers (OpenAI compatible + native)

### 3. Knowledge / Memory Core
- Primary store: Property graph (Neo4j or compatible via Graphiti)
- Secondary: Vector embeddings for semantic search
- Ingestion pipelines for:
  - Source code (entities, call graphs)
  - Git history / traces
  - Documentation & ADRs
  - AI conversations (selective)
  - Manual captures

### 4. Tooling & MCP
- Hosts and discovers MCP servers
- Routes tool calls from AIs through the studio
- Code intelligence (indexing, snippets, architecture views)

### 5. Persistence
- Local graph database (primary)
- Local file system for docs/, prompts/, source
- Future: optional encrypted sync or team graph

## Key Design Principles
- **The graph is the source of truth**, not any single chat session.
- **AI clients are consumers + contributors**, not owners of memory.
- **Desktop owns secrets and heavy local computation.**
- **Everything is queryable and explainable.**
- Follow the "AI OS" stack from the founding plan: VS Code as editor, Graphiti+Neo4j as memory, multiple AIs consulting the same brain.

## Communication
- Within desktop: IPC (if Electron) or direct module calls (Tauri)
- To external AIs: via Gateway (REST + context)
- To MCP tools: stdio / SSE per MCP spec
- To Graph DB: native drivers or Graphiti client

## Deployment Model
- Primary: Desktop application (Windows/macOS/Linux)
- Supporting services run locally (Neo4j desktop or embedded, MCP servers, optional local LLM)
- No mandatory cloud component

## Evolution Path
- Phase 1: Core desktop + local graph + basic multi-provider gateway
- Phase 2: Rich graph UX + advanced ingestion + MCP integration
- Phase 3: Team/shared graphs (opt-in) + AI Gateway as standalone service

## References
- `All-living memory/Graphiti-memory/Propossed plan.md`
- `003-monorepo-architecture.md`
- `006-database-architecture.md`
- `007-ipc-architecture.md`
- Related projects: AGENT RAY, raycast-clone-electron, various memory systems in the workspace
