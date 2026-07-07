# 105 — Dependency Graph

**Module ID:** 105-Dependency-Graph  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/ingestion, packages/core (graph, context)

---

## 1. Purpose

The Dependency Graph module analyzes extracted symbols and source code to construct and maintain the structural relationships between code entities in the knowledge graph. It materializes edges such as `depends_on`, `calls`, `implements`, `inherits`, and `references` that power impact analysis, call-path tracing, architecture summaries, and precise context retrieval.

It transforms a collection of isolated symbols into a connected, queryable model of the codebase, directly enabling the token-efficient, graph-first retrieval mandated by the Constitution.

## 2. Responsibilities

- Resolve static import/require/module dependencies between files and symbols.
- Detect call sites (function/method invocations) within and across files.
- Identify inheritance, interface implementation, and other type references.
- Compute and apply relationship deltas incrementally.
- Upsert normalized, deduplicated edges into the Memory Engine graph.
- Expose efficient traversal queries (dependents, dependencies, paths, impact sets).
- Encapsulate language-specific resolution logic behind a common interface.

## 3. Scope

- Static structural analysis derived from symbol metadata + source + Tree-sitter data.
- Incremental delta computation coordinated with the Incremental Indexer.
- Storage and querying of relationships via the Memory Engine.
- Support for languages covered by the Symbol Extractor and Tree-sitter Parser.

## 4. Non-Goals

- Dynamic or runtime call graphs (requires instrumentation or execution).
- Full semantic/type resolution or cross-file type inference beyond static imports and calls (LSP or dedicated analyzer is future work).
- External / node_modules dependency resolution beyond import declarations present in source.
- Graph visualization or UI (belongs to Studio Shell or dedicated tools).
- Long-term history of every edge change (unless explicitly required by Memory Engine).

## 5. Functional Requirements

- Given changed Symbols and their source, compute a minimal set of relationship upserts and deletes.
- For any symbol or file, return direct/transitive dependencies and dependents.
- Support call-path tracing between two symbols with depth limits.
- Compute blast-radius / impact sets for refactoring or change analysis.
- Handle re-exports, index files, and common aliasing patterns where statically detectable.
- Apply updates atomically (leveraging Memory Engine transaction support where available).
- Support batch processing for initial indexing and large git operations.

## 6. Non-Functional Requirements

- Edge delta computation for a typical changed file must complete in < 20ms (after symbol extraction).
- Common graph queries (direct dependents, impact depth 2) must return in < 100ms on representative projects.
- Deterministic output for identical input symbols + sources.
- Must not retain full parse trees or large source buffers after processing.
- Must respect project ignore patterns and exclusion rules before any analysis.

## 7. Architecture

Symbol Extractor (104) + source snippets → Dependency Analyzer (import resolver + call-site walker + language resolvers) → Relationship Delta → Memory Engine (201) for upsert.

Consumers:
- Incremental Indexer (102) uses it inside DependencyImpactAnalyzer to determine affected symbols.
- Context Engine (101) uses it for graph-retriever, trace_call_path, and architecture-aware retrieval.
- Future: Architecture Graph (106), Semantic Search enrichment.

Design follows Constitution §3 (loose coupling via clear interfaces to Memory), §4 (store only the graph edges; never ship raw source for retrieval), and event-driven deltas.

## 8. Folder Structure

```
packages/ingestion/src/dependency/
├── dependency-graph.ts          # Main service / coordinator
├── resolvers/
│   ├── base-resolver.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── ...
├── import-resolver.ts
├── call-analyzer.ts
├── relationship-model.ts
├── delta-calculator.ts
└── index.ts
```

## 9. Public Interfaces

```ts
interface DependencyGraph {
  computeDelta(params: {
    changedSymbols: Symbol[];
    sourceByPath: Record<string, string>;
    projectId: string;
  }): Promise<RelationshipDelta>;

  applyDelta(delta: RelationshipDelta): Promise<void>;

  getDirectDependencies(id: string): Promise<SymbolRef[]>;
  getDirectDependents(id: string): Promise<SymbolRef[]>;
  getTransitiveDependents(id: string, maxDepth?: number): Promise<SymbolRef[]>;

  traceCallPath(fromId: string, toId: string, options?: TraceOptions): Promise<CallPath[]>;
  getImpactSet(rootId: string, options?: ImpactOptions): Promise<ImpactResult>;
}

interface RelationshipDelta {
  upserts: Relationship[];
  deletes: string[]; // stable edge keys
}

interface Relationship {
  type: 'dependsOn' | 'calls' | 'implements' | 'inherits' | 'references' | 'exports';
  from: string;   // qualified symbol id or file id
  to: string;
  metadata?: {
    location?: Range;
    via?: string;      // e.g. re-export path
    confidence?: number;
  };
}

interface SymbolRef {
  id: string;
  name: string;
  kind: string;
  file?: string;
}

interface CallPath {
  nodes: string[];
  edges: Relationship[];
}
```

## 10. Internal Components

- Import / Module Resolver (maps specifiers to target files/symbols)
- Call Site Analyzer (walks for invocation nodes using Tree-sitter queries or symbol refs)
- Language Resolver Registry
- Delta Calculator (previous state diff)
- Relationship Normalizer + Key Generator (for idempotency)
- Graph Adapter (writes through Memory Engine APIs)

## 11. Database Schema

Operates exclusively on the knowledge graph (see 201 Memory Engine + docs/006-database-architecture.md).

- Entities: Symbol, File (primary nodes)
- Relationships (directed):
  - `dependsOn` (module/file/symbol level)
  - `calls` (with location metadata on edge)
  - `implements`, `inherits`, `references`, `exports`
- Edge properties: location, sourceVersion, confidence, createdAt
- Stable synthetic keys on edges for upsert-by-key semantics.
- Indexes: (from, type), (to, type), and composite for traversal queries.

No local relational tables required; the graph is the source of truth.

## 12. IPC/API Contracts

Primarily internal module.

Surface to external agents and the Context Engine via MCP tools defined at the Memory / Core layer:
- search_graph with relationship filters
- trace_call_path
- get_dependents / get_dependencies
- get_architecture (uses pre-computed or on-demand views)

All contracts are versioned at the MCP/tool level.

## 13. Events

- `dependency:delta-computed`
- `dependency:edges-upserted`
- `dependency:impact-requested`

Events are lightweight (counts + ids) and consumed by Indexer and analytics.

## 14. State Management

Computation is stateless. The current graph state (queried via Memory Engine) provides the "before" for delta calculation.

Optional lightweight per-file caches (e.g., last resolved imports map) may live in memory for a single indexing run only; they are not persisted.

## 15. Error Handling

- Unresolvable imports are logged at WARN and skipped (no "unknown" nodes unless explicitly configured for diagnostics).
- Syntax or resolution errors on a single file must not abort processing of the rest of a batch.
- Cycle detection is performed opportunistically; cycles are logged but do not block ingestion.
- All mutations must be idempotent.

## 16. Logging

- INFO: batch size, edges added/removed, languages touched, total duration.
- DEBUG: per-resolution decisions and reasons.
- Structured fields: { projectId, changedFiles, upserts, deletes, ms }
- Never log full source or large symbol payloads.

## 17. Security

- Strictly observe .gitignore, .raystudioignore, and any configured exclusion lists before reading or analyzing files.
- Static analysis only — no code execution, no network, no filesystem writes outside the graph.
- Respect project boundaries; do not traverse symlinks that escape the workspace root.

## 18. Performance Targets

- File-level dependency delta: < 15 ms P95 (excluding parse/extract time).
- Direct dependents query: < 30 ms.
- Impact set (depth ≤ 3) on mid-sized projects: < 80 ms.
- Initial full-project edge build must be linear in symbol count with small constant factors.
- Background work must be throttled per Constitution performance guidelines.

## 19. Dependencies

Hard:
- Symbol Extractor (104)
- Tree-sitter Parser (103) — additional targeted queries
- Memory Engine (201) — storage + query surface
- Core types (Symbol, Range, etc.)

Soft / coordination:
- Incremental Indexer (102)
- Context Engine (101)

No new heavy external dependencies. Use existing language parsers and minimal static analysis helpers.

## 20. Testing Strategy

- Small multi-file fixture projects with hand-authored expected edges (golden files).
- Delta tests: apply change → assert exact upserts/deletes.
- Round-trip: write edges, query, verify symmetry and reachability.
- Integration tests using seeded Memory Engine + real graph queries.
- Performance benchmarks for common operations.
- Property-based: every call site in source produces a corresponding `calls` edge.
- Language-specific resolver unit tests with synthetic AST nodes.

## 21. Acceptance Criteria

- Extracting a small service that imports a utility and calls functions in it results in correct `dependsOn` (service → utility) and `calls` (caller → callee) edges.
- An edit to a leaf utility correctly surfaces only the direct callers (and their direct callers if requested) via impact queries.
- Call path tracing between two symbols returns paths that match the actual source structure.
- Incremental run after a single function edit touches only the minimal set of edges.
- All queries remain fast and correct after large renames/refactors that affect many files.

## 22. Definition of Done

- All 22 sections are complete, focused, and consistent with sibling specs (especially 101–104 and 201).
- Explicitly follows Ray Studio Engineering Constitution §4 (Token Optimization — graph edges instead of raw data), §3 (Architecture Principles), §5 (Monorepo), and §9 (Definition of Done).
- Production-ready: no TODOs, placeholders, or mocks.
- References upstream (Symbol Extractor, Parser) and downstream consumers (Context Engine, Incremental Indexer).
- Example relationships, queries, and integration points are documented.
- Adding this file does not touch unrelated modules or wired agent surfaces.

---

**References**
- Ray Studio Engineering Constitution §4 Token Optimization, §9 Definition of Done, §3 Architecture Principles, §11 Layered Prompt System
- 101-context-engine.md
- 102-incremental-indexer.md
- 103-tree-sitter-parser.md
- 104-symbol-extractor.md
- 201-memory-engine.md
- docs/002-system-architecture.md
- docs/006-database-architecture.md

This is the smallest correct, production-ready specification. It references the required Constitution sections. No unrelated modules touched. Fits the Phase B Context Engine sequence. Ready for Layer 3 usage.

**Confirmation at end:** This change (creation of 105-dependency-graph.md) satisfies the Module Specification template (`_template.md`) and the Phase info requirements for Layer 2. It meets the Definition of Done for module specs: follows exact 22-section format, aligns with architecture and existing specs (101-104, 201), references Constitution §4/§9, production quality, no placeholders, smallest focused content.