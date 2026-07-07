# 001 — Product Requirements

**Status:** Reference (Sprint 0)
**Owner:** Product + Engineering
**Last Updated:** 2026-07-07
**Project:** Ray Studio

## Vision

Ray Studio is the AI-native development environment that gives developers a unified, high-agency workspace across multiple large language models, persistent project memory, and tooling — without vendor lock-in.

It turns scattered conversations with Claude, Grok, ChatGPT, and local models into a single living knowledge system for the project.

## Problem Statement

Today, AI-assisted development is fragmented:

- Every AI keeps its own context and forgets previous decisions.
- Knowledge is trapped in chat history, loose notes, and developer memory.
- Switching between tools loses continuity.
- No single source of truth for architecture, decisions, entities, and relationships.
- Power users end up maintaining manual wikis, ADRs, and graphs manually.

## Target Users

- **AI power users & senior engineers** building complex, long-lived software.
- **Teams** that want shared, queryable project memory across different AI assistants.
- **Solo developers** who want their tools (VS Code + Claude Code + Grok + others) to share the same brain.
- **Architecture and platform engineers** who need traceable decisions and entity relationships.

## Primary Jobs-to-be-Done

1. Maintain a single, queryable, evolving knowledge graph for the entire project.
2. Interact with the best model for the task while all models see the same project context.
3. Capture decisions, architecture, code relationships, and meeting outcomes automatically or with minimal friction.
4. Visualize and explore the software as a graph (entities, dependencies, decisions).
5. Provide Raycast-like speed and discoverability for AI actions, commands, and project knowledge.

## Key Features (Foundation Scope)

### Core

- Desktop studio application (Electron/Tauri or equivalent)
- Command palette / Raycast-style launcher for AI actions and project navigation
- Persistent project memory layer (Graphiti + graph database)
- Multi-LLM orchestration with shared context injection
- First-class support for Architecture Decision Records (ADRs), entities, traces, and code intelligence
- MCP server/client hosting and routing

### Memory & Knowledge

- Knowledge graph as the source of truth (not chat history)
- Automatic + manual ingestion of code, docs, decisions, conversations
- Rich querying (trace call paths, find related decisions, architecture views)
- Embedding + graph hybrid retrieval

### AI Integration

- Pluggable providers (Grok/xAI, Claude/Anthropic, OpenAI, Gemini, local via Ollama, etc.)
- AI Gateway pattern for consistent prompting, logging, and context injection
- Per-task model routing recommendations
- Secure local proxy for API keys

### Developer Experience

- Excellent documentation surface (docs/, ADRs)
- Deep integration with VS Code / existing editors (not replacing them)
- Visualization of the knowledge graph
- Fast capture of thoughts, decisions, and code snippets

## Non-Goals (Sprint 0 / Foundation)

- Replacing VS Code as the primary code editor
- Building a full general-purpose chatbot UI (focus on engineering workflows)
- Real-time collaborative editing of the graph by multiple humans
- Shipping as a web SaaS first (desktop + local memory is priority)

## Success Metrics

- One canonical project knowledge graph that all connected AIs consult
- Time to find "why did we choose X architecture" measured in seconds, not minutes
- High retention of decisions in the graph vs. lost in chat logs
- Smooth performance with graphs containing 10k+ nodes/relationships
- Zero leakage of API keys or private project data

## Constraints

- Local-first / offline-capable core (graph DB runs locally)
- Privacy and control: user owns the memory store
- Multi-vendor LLM support from day one
- Strong emphasis on documentation and architecture artifacts (as per the founding plan)

## References

- `All-living memory/Graphiti-memory/Propossed plan.md` (the guiding architecture document)
- Broader Ray ecosystem (AGENT RAY, raycast-clone work, memory clusters)
- Standard engineering practices for long-lived AI-augmented projects

---

_This is the north star. All architecture and implementation decisions must serve the goal of a unified, persistent, multi-AI development brain._
