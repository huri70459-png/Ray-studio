# 101 — Context Engine

**Module ID:** 101-Context-Engine  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (context, graph, embeddings), packages/ingestion, packages/gateway

---

## 1. Purpose

The Context Engine is responsible for assembling the minimal, relevant, high-quality context that is injected into every prompt sent to AI providers. It is the primary mechanism for achieving Ray Studio's token optimization and consistency goals.

It sits between raw project data (code, docs, memory) and the AI Gateway.

## 2. Responsibilities

- Retrieve and rank relevant information using the knowledge graph + embeddings + architecture summaries.
- Build layered context (Constitution + Module Spec + symbols + summaries) per the Layered Prompt System.
- Perform context compression, deduplication, and token budgeting.
- Support incremental updates when the underlying graph or files change.
- Provide explainability: "why was this symbol/summary included?"

## 3. Scope

- Context assembly for LLM prompts (all providers).
- Integration with the persistent knowledge graph (Graphiti + vector store).
- Symbol-level and architecture-level retrieval.
- Token estimation and optimization strategies.

## 4. Non-Goals

- Direct LLM calls (belongs to Provider Layer / Gateway).
- Long-term memory storage (Memory Engine).
- Raw file ingestion / parsing (Ingestion layer).
- User-facing UI for context inspection (Studio Shell).

## 5. Functional Requirements

- Given a user request + current project state, produce a context package that fits within a configurable token budget.
- Support multiple retrieval strategies: graph traversal, semantic search, hybrid, architecture-aware.
- Always include relevant sections from the Engineering Constitution and the target Module Specification when applicable.
- Allow exclusion of specific files/symbols via configuration or explicit request.
- Return provenance for every included item (source, reason, score).

## 6. Non-Functional Requirements

- Context assembly for typical tasks must complete in < 500ms on mid-range hardware (P95).
- Must never exceed the configured token limit for the target model.
- Must be deterministic given the same inputs and graph state (for reproducibility and testing).
- Graceful degradation when embeddings or graph are unavailable.

## 7. Architecture

The Context Engine acts as a sophisticated retrieval and assembly orchestrator:

- Inputs: User intent, conversation history summary, target module (if any), token budget, current graph state.
- Retrieval layer: Combines symbol graph queries, vector similarity, call-path tracing, and pre-computed architecture summaries.
- Ranking & Compression: Applies Constitution §4 rules (symbol-level preference, summaries over raw, dedup).
- Assembly: Builds the final layered prompt payload.
- Output: Structured context object ready for the Gateway.

It is the enforcement point for "graph-first" and "layered" principles.

## 8. Folder Structure

```
packages/core/src/context/
├── engine.ts                 # Main orchestrator
├── retrievers/
│   ├── graph-retriever.ts
│   ├── semantic-retriever.ts
│   └── hybrid-retriever.ts
├── compressors/
│   ├── token-budget.ts
│   └── summary-compressor.ts
├── builders/
│   └── layered-context-builder.ts
├── types.ts
└── index.ts
```

## 9. Public Interfaces

```ts
interface ContextEngine {
  buildContext(request: ContextRequest): Promise<AssembledContext>;
}

interface ContextRequest {
  intent: string;
  targetModule?: string;           // e.g. "gateway"
  maxTokens: number;
  modelId: string;
  excludePatterns?: string[];
}

interface AssembledContext {
  layers: {
    constitution: string;          // reference or excerpt
    moduleSpec?: string;           // reference
    symbols: SymbolContext[];
    summaries: ArchitectureSummary[];
  };
  tokenEstimate: number;
  provenance: ProvenanceItem[];
}
```

## 10. Internal Components

- Retrieval Coordinator
- Ranking Engine (hybrid scoring)
- Token Accountant
- Summary Cache / Pre-computed views
- Exclusion Filter

## 11. Database Schema

Primarily consumes from the knowledge graph (see packages/core graph models and docs/006).

- Relies on existing entity/relationship types (Symbol, File, Decision, etc.).
- May maintain lightweight context-session metadata if needed for incremental behavior.

## 12. IPC/API Contracts

Internal to the desktop process for now.

Exposed via MCP tools for external agents (search_graph, get_architecture, etc. are the primary interfaces used by this engine).

## 13. Events

- `context:assembled` (for logging / analytics)
- `context:token-limit-exceeded` (warning event)

## 14. State Management

Stateless per request. Relies on the persistent graph + any pre-computed summary caches maintained by the Ingestion / Indexing system.

## 15. Error Handling

- Retrieval failures must fall back gracefully (e.g., use only graph data if embeddings are down).
- Never silently drop required Constitution or Module Spec layers.
- Clear error types for budget violations.

## 16. Logging

- Structured logs for retrieval paths taken, scores, and final token usage.
- Log at INFO for assembly summary; DEBUG for individual symbol decisions.

## 17. Security

- Must not leak symbols or summaries that the current user/session should not see (respect any future access controls).
- No execution of untrusted code during retrieval.

## 18. Performance Targets

- P95 context assembly < 400ms for typical coding tasks (under 8k token budget).
- Token estimation accuracy within ±5%.
- Efficient reuse of cached summaries.

## 19. Dependencies

- packages/core (graph client, embeddings client, symbol types)
- packages/ingestion (for up-to-date index state)
- Token counting library (tiktoken or equivalent for target models)
- Constitution and module spec files (read-only references)

## 20. Testing Strategy

- Unit tests for retrievers, rankers, and compressors with synthetic graphs.
- Integration tests against a seeded knowledge graph.
- Property-based tests for token budget enforcement.
- Golden file tests for layered context output shape.

## 21. Acceptance Criteria

- Given a request targeting the Gateway module, the assembled context always includes the relevant sections from the Constitution and `prompts/modules/gateway.md`.
- Token usage never exceeds the requested budget.
- Every included item has provenance.
- Performance targets are met on representative hardware.

## 22. Definition of Done

- All sections of this spec are implemented and tested.
- Passes the project Constitution check and relevant validation specs (Layer 4 exists for foundational modules; apply equivalent criteria for this module).
- Integrated with the AI Gateway for at least one provider.
- Documentation and examples updated.
- No TODOs or placeholders.

---

**References**
- Ray Studio Engineering Constitution (especially §4 Token Optimization and §11 Layered Prompt System)
- docs/002-system-architecture.md (Knowledge Layer)
- docs/003-monorepo-architecture.md (packages/core)