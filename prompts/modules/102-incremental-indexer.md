# 102 — Incremental Indexer

**Module ID:** 102-Incremental-Indexer  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/ingestion, packages/core (context, graph)

---

## 1. Purpose

The Incremental Indexer is responsible for efficiently detecting changes in the project (files, git, etc.) and updating the knowledge graph and embeddings in a targeted, low-cost way. It is the foundation for keeping the Context Engine's view of the world fresh without expensive full re-indexes.

## 2. Responsibilities

- Monitor the file system and git for relevant changes.
- Determine the minimal set of symbols/entities that need re-processing.
- Coordinate with parsers (Tree-sitter) and extractors to update only what changed.
- Maintain index versions and timestamps for incremental queries.
- Trigger embedding updates only for changed content.
- Provide change events to the Context Engine and other consumers.

## 3. Scope

- File system watching (with proper ignore patterns).
- Git diff / commit analysis for change detection.
- Incremental symbol and dependency graph updates.
- Coordination with the broader ingestion pipeline.

## 4. Non-Goals

- Full repository re-indexing (there should be a separate one-time/full path).
- Direct LLM calls or context building.
- Long-term storage decisions (Memory Engine).
- User-facing change visualization (Studio Shell).

## 5. Functional Requirements

- Given a file change, identify all affected symbols and dependent symbols.
- Support both file-system events and explicit "reindex this path" requests.
- Produce a batch of updates (upserts + deletes) that can be applied atomically to the graph.
- Track per-file and per-symbol index versions.
- Handle renames, moves, and deletions correctly.

## 6. Non-Functional Requirements

- Change detection and update planning must be fast (< 100ms for typical changes).
- Must be resilient to rapid successive changes (debouncing).
- Memory usage must remain bounded even for very large projects.
- Must respect the project's .gitignore and any configured exclusion rules.

## 7. Architecture

The Incremental Indexer acts as the change-detection and delta-computation layer:

Watcher → Change Classifier → Affected Symbol Calculator → Parser/Extractor Coordinator → Graph Update Batcher

It collaborates heavily with:
- Tree-sitter Parser (102's sibling)
- Symbol Extractor
- Dependency Graph builder
- Context Engine (consumer of change signals)

Key principle: "Only touch what changed" to support Constitution §4 token optimization and performance goals.

## 8. Folder Structure

```
packages/ingestion/src/incremental/
├── indexer.ts
├── watcher.ts
├── change-classifier.ts
├── affected-set-calculator.ts
├── batch-applier.ts
└── types.ts
```

## 9. Public Interfaces

```ts
interface IncrementalIndexer {
  start(): Promise<void>;
  stop(): Promise<void>;
  reindexPath(path: string, options?: ReindexOptions): Promise<IndexDelta>;
  getLastIndexedVersion(filePath: string): Promise<number | null>;
}

interface IndexDelta {
  upserts: Entity[];
  deletes: string[]; // qualified names or ids
  affectedModules: string[];
}
```

## 10. Internal Components

- FileSystemWatcher (chokidar or platform equivalent)
- GitChangeDetector
- DependencyImpactAnalyzer (uses the graph)
- Debouncer / ChangeQueue
- Transactional Update Applier

## 11. Database Schema

Consumes and updates the core graph models (see 101 and 201).

- Stores `last_indexed_at` and `index_version` on File and Symbol entities.
- May maintain a small "pending_changes" queue table if using a separate store for reliability.

## 12. IPC/API Contracts

Exposed via MCP for external tools that want to force re-indexing.

Internal events for the desktop process.

## 13. Events

- `index:change-detected`
- `index:delta-ready`
- `index:full-reindex-requested`

## 14. State Management

Maintains in-memory index of watched paths and last known mtimes/versions.

Persisted state lives in the knowledge graph (per-symbol/file versions).

## 15. Error Handling

- Transient watcher errors should retry with backoff.
- Parser failures on a single file must not stop indexing of the rest.
- Clear distinction between "file unreadable" vs "parse error" vs "graph update failed".

## 16. Logging

- Log at INFO level for batch sizes and duration of incremental runs.
- DEBUG for per-file decisions.
- Structured fields for changed file count, symbols affected, tokens impacted (estimated).

## 17. Security

- Must never index or expose files that are excluded by security or privacy rules.
- Respect .gitignore and .raystudioignore patterns strictly.

## 18. Performance Targets

- File change → delta computed in < 50ms for most cases.
- Large change batches (e.g. after git checkout) should process at a rate that doesn't block the UI.
- Background indexing budget respected per Constitution.

## 19. Dependencies

- File watcher library
- Git client / libgit2 bindings
- Tree-sitter Parser (sibling module)
- Symbol Extractor
- Graph client (from core)
- packages/core types

## 20. Testing Strategy

- Use fake file system + git for deterministic tests.
- Property-based testing for "any change produces a correct minimal delta".
- Integration tests with seeded graph + real small projects.
- Performance benchmarks for common scenarios (single file edit, branch switch).

## 21. Acceptance Criteria

- Editing a single function updates exactly the symbols that are affected (the function + direct dependents) and nothing else.
- Deleting a file produces the correct delete operations for all its symbols.
- Renaming a file updates references correctly in the graph.

## 22. Definition of Done

- All sections of this spec implemented and tested.
- Integrated with the Context Engine and Memory Engine.
- Follows Constitution §4 (incremental, low token impact) and §18 (performance).
- Passes relevant validation (Layer 4 exists for foundational modules; create/apply equivalent detailed validation spec for this module before implementation).
- No TODOs or placeholders.
- Documentation updated.

---

**References**
- Ray Studio Engineering Constitution (especially §4 Token Optimization and performance targets)
- docs/002-system-architecture.md
- 101-context-engine.md
- 201-memory-engine.md