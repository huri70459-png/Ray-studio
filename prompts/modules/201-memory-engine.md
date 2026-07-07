# 201 — Memory Engine

**Module ID:** 201-Memory-Engine  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (memory), packages/gateway

---

## 1. Purpose

The Memory Engine provides durable, queryable, long-term storage for project knowledge that must survive across sessions and be shared between multiple AI agents and tools. It is the persistent "brain" of Ray Studio.

It is the single source of truth for entities, relationships, decisions, and history that the Context Engine and other components rely on.

## 2. Responsibilities

- Own the primary knowledge graph (via Graphiti or equivalent) and associated vector embeddings.
- Provide CRUD and rich query capabilities (graph traversal, semantic search, hybrid).
- Handle ingestion coordination and consistency for different data sources.
- Support multi-tenant / multi-project isolation where required.
- Maintain indexes and summaries for efficient retrieval by the Context Engine.

## 3. Scope

- Project-level persistent memory (code entities, ADRs, conversations summaries, decisions).
- Graph + vector hybrid storage.
- Query interfaces used by Context Engine, analytics, and external agents via MCP.

## 4. Non-Goals

- Transient conversation state (handled in Context Engine or Gateway).
- Direct prompt construction (Context Engine).
- Raw source code storage (file system + ingestion layer).
- User authentication / access control for memory (higher-level concern).

## 5. Functional Requirements

- Store and retrieve typed entities and relationships with full history/audit where appropriate.
- Support efficient "what changed since last index" queries.
- Allow agents to contribute new memory items (decisions, traces) that become immediately queryable.
- Provide both precise graph queries and semantic similarity search in a unified interface.
- Support deletion / archival of projects without data corruption.

## 6. Non-Functional Requirements

- Queries for context assembly must be fast enough to support the Context Engine targets.
- Durability: data must survive application restarts and (optionally) be recoverable from backups.
- Consistency model must be clear (eventual for embeddings, stronger for core graph facts).

## 7. Architecture

The Memory Engine is the central persistent store:

- Graph database (property graph) as primary store for entities and relationships.
- Vector embeddings as secondary index for semantic search.
- Abstraction layer (Graphiti or custom) so the rest of the system is not tightly coupled to a specific backend.
- Ingestion adapters feed data in; Context Engine and other consumers query out.
- Background maintenance for indexing, embedding updates, and cleanup.

Follows the "graph is the source of truth" principle from the system architecture.

## 8. Folder Structure

```
packages/core/src/memory/
├── engine.ts
├── graph/
│   ├── client.ts
│   ├── models.ts          # Entity and Relationship type definitions
│   └── queries.ts
├── embeddings/
│   ├── store.ts
│   └── indexer.ts
├── ingestion/
│   └── adapters.ts
└── index.ts
```

## 9. Public Interfaces

```ts
interface MemoryEngine {
  // Core graph operations
  upsertEntities(entities: Entity[]): Promise<void>;
  upsertRelationships(rels: Relationship[]): Promise<void>;
  searchGraph(query: GraphQuery): Promise<SearchResult>;

  // Semantic
  semanticSearch(query: string, options?: SemanticOptions): Promise<SemanticResult[]>;

  // Project lifecycle
  createProject(project: ProjectMetadata): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}
```

## 10. Internal Components

- Graph Client Abstraction
- Embedding Manager
- Change Detection / Incremental Indexer coordination
- Query Optimizer / Cache

## 11. Database Schema

Defined in coordination with docs/006-database-architecture.md and the core graph models in packages/core.

- Strong typing for common entities: Symbol, File, Decision, Trace, ConversationSummary, etc.
- Relationship types: dependsOn, calls, decides, captures, etc.
- Versioning / timestamping for history.

## 12. IPC/API Contracts

Exposed primarily through MCP tools for external agents.

Internal desktop components use direct imports or a clean service interface.

## 13. Events

- `memory:entity-upserted`
- `memory:relationship-upserted`
- `memory:project-deleted`

## 14. State Management

The engine itself is mostly stateless; state lives in the backing graph + vector stores.

May maintain short-lived write caches or batching for ingestion performance.

## 15. Error Handling

- Clear distinction between transient (retryable) and permanent failures.
- Partial ingestion must not leave the graph in an inconsistent state (use transactions where the backend supports them).

## 16. Logging

- Log all significant mutations with before/after summaries.
- Structured logging for query patterns (for later optimization and cost analysis).

## 17. Security

- Project isolation must be enforced at the storage layer.
- No untrusted data should be able to influence graph structure in ways that affect other projects.
- Secrets must never be stored in the memory graph.

## 18. Performance Targets

- Common graph queries used by Context Engine: P95 < 150ms.
- Embedding updates should not block user-facing operations.
- Efficient support for "changes since timestamp" queries.

## 19. Dependencies

- Graph database client (Graphiti or direct driver)
- Vector database / embedding model client
- packages/core types (entities, relationships)
- Ingestion layer for data sources

## 20. Testing Strategy

- Use in-memory or test-container graph backends for integration tests.
- Property tests for consistency invariants.
- Load tests for common retrieval patterns.
- Tests that simulate multi-agent contribution to memory.

## 21. Acceptance Criteria

- A new decision captured via an agent is immediately visible to a subsequent context assembly in another agent.
- Semantic + graph hybrid search returns relevant results for typical developer queries.
- Project deletion cleanly removes all associated data.

## 22. Definition of Done

- All sections implemented and tested.
- Integrated with Context Engine and at least one ingestion path.
- Follows Constitution §4 (token optimization) and overall standards.
- Documentation and examples provided for contributors.
- Passes constitution:check and any applicable validation.

---

**References**
- Ray Studio Engineering Constitution
- docs/002-system-architecture.md (Knowledge / Memory Core)
- docs/006-database-architecture.md
- All-living memory/Graphiti-memory/ proposed plan (historical)