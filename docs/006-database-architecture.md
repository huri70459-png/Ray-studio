# 006 — Database Architecture

**Status:** Reference (Sprint 0)

## Primary Store: Knowledge Graph
The heart of Ray Studio is a **property graph database**.

**Recommended:**
- **Neo4j** (preferred for visualization, Cypher, maturity, browser UI)
- Alternatives: FalkorDB or other Graphiti-compatible stores

Graphiti (or equivalent) sits on top as the ingestion + retrieval layer.

### What lives in the graph
- **Entities**: Code modules, services, classes, functions, decisions, people (optional), documents
- **Relationships**: `depends_on`, `calls`, `implements`, `decided_in`, `related_to`, `authored_by`, etc.
- **Properties**: Timestamps, confidence, source, summary, embeddings references

## Supporting Stores
- **Vector / Embeddings**: For semantic search over code, docs, and decisions. Can be co-located or separate (e.g. local embeddings or hosted).
- **Relational / Metadata**: For quick lookups (projects, users, config, ingestion status). Can be SQLite or part of the graph.
- **File System**: Source of truth for actual source code + `docs/`, `prompts/`. Graph stores *references + derived knowledge*.

## Ingestion Pipelines
- Code indexing (AST or LSP-based)
- Git history / trace ingestion
- ADR and markdown parsing
- Selective conversation import (from connected AIs)
- Manual capture from the studio UI

## Access Patterns
- Graph queries (Cypher or Graphiti APIs) for structural questions ("what depends on X?")
- Hybrid search (vector + graph traversal) for "find relevant context"
- Trace tools for call paths and impact analysis

## Local-First Requirements
- Database runs locally by default (Neo4j Desktop or embedded options)
- All data stays on the user's machine unless explicit sync is enabled
- Clear export / backup of the graph

## Future Considerations
- Multi-project support
- Team graph (shared Neo4j instance or federated)
- Encryption at rest for sensitive graphs (opt-in)

## References
- `All-living memory/Graphiti-memory/Propossed plan.md`
- `002-system-architecture.md`
- Graphiti documentation and Neo4j best practices
