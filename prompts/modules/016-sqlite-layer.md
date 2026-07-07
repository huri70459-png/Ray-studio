# 016 — SQLite Layer

**Module ID:** 016-SQLite-Layer  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/db (or packages/core/db), apps/studio

---

## 1. Purpose

The SQLite Layer provides a lightweight, local-first, relational store for metadata, configuration, operational state, and quick-lookup data that does not belong in the primary knowledge graph.

It exists to support fast, transactional, strongly-consistent queries for workspace/project records, ingestion status, settings snapshots, user preferences, and other structured data while keeping the graph (Neo4j/Graphiti or equivalent) focused exclusively on rich entities and relationships.

All access is mediated through the IPC Framework (013) and respects scoping decisions from Workspace Manager (009), Project Manager (010), and File System Service (011).

## 2. Responsibilities

- Own the SQLite schema, migrations, and connection lifecycle for the application's relational needs.
- Provide a clean, versioned data access layer (repository / query objects) for metadata and state.
- Ensure local-first durability: all data lives on the user's machine by default.
- Support transactional operations and basic concurrency control.
- Expose data only through IPC contracts (never direct renderer access).
- Coordinate with the File System Service for any paths that reference SQLite files or related artifacts.
- Participate in application lifecycle (open, migrate, close, backup).

The SQLite Layer owns the relational metadata store. It owns neither the knowledge graph, file content, nor business logic for higher layers.

**Data Ownership Boundaries (aligned with 006):**
- SQLite Layer: projects, workspaces, config, ingestion status, quick metadata, operational state, user/session prefs.
- Primary Graph: code entities, relationships, decisions, traces, semantic knowledge.
- File System (011): source of truth for actual file contents and docs.

## 3. Scope

- Local SQLite database(s) for relational/operational data.
- Schema definition, versioned migrations, and safe evolution.
- Read/write access for authorized consumers via IPC.
- Basic indexing and query patterns for common lookups (by project, status, timestamp).
- Integration with application startup/shutdown and backup/restore flows.
- Graceful handling of database unavailability or corruption (clear errors, recovery paths).

## 4. Non-Goals

- Storing the primary knowledge graph or vector embeddings (belongs to Graph / Graphiti layer).
- Storing raw file contents (belongs to the file system; SQLite stores references + metadata only).
- Complex analytical queries or full-text search (prefer graph + vector layers).
- Multi-user / shared database (local-first; team features are future).
- Direct file I/O or path validation (delegated to 011).

## 5. Functional Requirements

1. Provide a stable, versioned SQLite schema and migration system (forward-only migrations preferred).
2. Expose data operations exclusively through IPC contracts defined/registered with the IPC Framework (013).
3. Support scoped access: operations are only permitted within the active workspace/project boundaries established by 009/010.
4. Guarantee local durability and atomicity for metadata updates (transactions).
5. Allow fast lookups by natural keys (project id, workspace id, status, etc.).
6. Support application lifecycle: open (with migration), ready, shutdown (with flush), and optional backup/export.
7. Provide clear error types for common conditions (locked, corrupt, schema mismatch, permission).
8. Enable consumers (Studio Shell, ingestion pipelines, settings) to read/write only through typed contracts.

## 6. Non-Functional Requirements

- Extremely low latency for local metadata operations (< 5–10 ms typical).
- Minimal resource usage (small WAL mode, bounded connection pool).
- Must survive abrupt shutdowns without data loss for committed transactions.
- Must support schema evolution without data loss or manual intervention.
- Must follow Constitution principles for boundaries, security, observability, and local-first operation.
- Database file location must be within a validated workspace or well-known application data directory (coordinated with 011).

## 7. Architecture

The SQLite Layer is a supporting Core Platform module that provides the relational complement to the primary graph store.

```
Consumers (via IPC 013)
  001 Studio Shell
  Ingestion pipelines (101–105)
  Settings / Capture
          ↓ (typed contracts only)
IPC Framework (013)
          ↓
SQLite Layer (016)
  - Connection manager + migrations
  - Repository layer (projects, status, config, etc.)
          ↓
Local SQLite (WAL mode recommended)
  (file managed under validated paths or app data dir)
```

**Relationship to other stores (per docs/006)**

- Primary: Knowledge Graph (entities + relationships).
- Supporting: SQLite (metadata + operational state).
- Source of truth for content: File System (011).

**Capability Integration (013)**

Access to SQLite operations is granted via narrow capabilities (e.g. "Database" or "ProjectMetadata"). Renderer surfaces never receive blanket DB access.

Per 013: Capability validation occurs before schema validation, which occurs before handler dispatch. SQLite Layer receives only validated, authorized calls.

**Lifecycle**

Boot
↓
Locate / create SQLite file (via validated path from 011 where applicable)
↓
Run pending migrations (atomic)
↓
Open connection pool
↓
Register IPC contracts (013)
↓
Ready

Runtime
- Transactional reads/writes through repositories
- Status and config updates from higher modules

Shutdown
↓
Drain in-flight work
↓
Close connections cleanly
↓
Optional checkpoint / backup hook

**Resilience**

- Database locked / busy → clear retryable error; consumers decide backoff.
- Corruption detected → surface specific error; do not attempt silent repair in hot path.
- Schema version mismatch → explicit "migration required" or "incompatible" error.
- IPC (013) unavailable → operations fail fast with unavailable error.

**Failure Behaviours (key cases)**

| Failure                 | Expected Behaviour             |
|-------------------------|--------------------------------|
| Registry validation fails (via 013) | Startup abort             |
| Consumer (IPC) unavailable | Deterministic error (unavailable) |
| Version mismatch (contract) | Reject per 013 convention   |
| Timeout (IPC)           | Standard timeout envelope      |
| DB locked / overflow    | Retryable error + backpressure |
| Shutdown during op      | Graceful drain + clean close   |

References: Constitution (local-first, security), docs/006-database-architecture.md, docs/002, 009 Workspace Manager, 010 Project Manager, 011 File System Service, 013 IPC Framework.

## 8. Folder Structure

```
packages/db/                  # or packages/core/src/db/sqlite
├── src/
│   ├── connection.ts         # open, migrate, close, pool
│   ├── migrations/           # numbered migration files + runner
│   │   ├── 0001_initial.sql
│   │   └── ...
│   ├── repositories/         # typed accessors
│   │   ├── project.repo.ts
│   │   ├── ingestionStatus.repo.ts
│   │   └── config.repo.ts
│   ├── types.ts              # entity shapes (not full domain models)
│   └── index.ts
└── tests/
```

The layer is consumed via IPC contracts; direct imports are limited to privileged main-process code.

## 9. Public Interfaces

Conceptual contracts (registered with 013):

**Repository-style access exposed over IPC (examples)**

- `db:project:get@1.0` (id) → ProjectRecord | null
- `db:project:list@1.0` (workspaceId) → ProjectRecord[]
- `db:ingestion:status:get@1.0` (projectId) → StatusRecord
- `db:ingestion:status:set@1.0` (projectId, status, details)
- `db:config:get@1.0` (key) → value
- `db:config:set@1.0` (key, value)

All payloads are small, validated metadata. No large blobs or file content.

Contracts follow the IPC Framework naming convention: `<namespace>:<operation>@<major>.<minor>`. Contracts are versioned independently (1.x baseline).

## 10. Internal Components

- ConnectionManager: lifecycle, WAL mode, busy timeout, foreign keys.
- MigrationRunner: ordered, idempotent, transactional migrations.
- Repositories: thin, typed wrappers around prepared statements or query builders.
- TransactionScope helper for multi-statement operations.
- ErrorMapper: SQLite errors → standard IPC error envelope.

No domain logic lives here.

## 11. Database Schema

**Core tables (conceptual; exact DDL in migrations)**

- `workspaces` (id, name, root_path_ref, created_at, ...)
- `projects` (id, workspace_id, name, root_path_ref, status, last_indexed_at, ...)
- `ingestion_status` (project_id, stage, progress, last_error, updated_at, ...)
- `app_config` (key, value, updated_at) — small key/value or JSON
- `session_state` / operational tables as needed

**Principles**
- Use stable UUIDs or integer PKs.
- Foreign keys enabled.
- Timestamps in UTC.
- Avoid storing large content; store references + metadata.
- Migrations are additive or carefully transformational; never destructive in place without explicit backup step.

The schema is intentionally narrow. Rich knowledge lives in the graph.

## 12. IPC/API Contracts

All access goes through the IPC Framework (013).

Example channel families:
- `db:project:*`
- `db:ingestion:*`
- `db:config:*`
- `db:workspace:*`

All channels follow the IPC Framework (013) permanent naming convention `<namespace>:<operation>@<major>.<minor>` (e.g. `db:project:get@1.0`).

Channel namespaces are permanently owned by exactly one module and may never be reused by another module.

Contract Version: 1.x baseline.

Payloads are small metadata records. Paths inside records must be validated by 011 before use by callers.

## 13. Events

The SQLite Layer may emit (via IPC) lightweight events for state changes that consumers care about:

- `db:project:updated@1.0`
- `db:ingestion:status:changed@1.0`

Events carry only identifiers + minimal metadata. Heavy lifting stays in the owning modules.

## 14. State Management

- Persistent: the SQLite file itself (local).
- In-memory: connection pool + prepared statements + lightweight caches (e.g. current workspace config).
- No cross-process shared state except through the database file and IPC.

The layer is the source of truth for the relational slice.

## 15. Error Handling

All errors are mapped to the standard IPC error envelope (013).

Common categories:
- `DB_LOCKED` (retryable)
- `DB_CORRUPT`
- `SCHEMA_MISMATCH`
- `CONSTRAINT_VIOLATION`
- `NOT_FOUND` (for get operations)

Never swallow errors. Always surface actionable, sanitized information.

## 16. Logging

- Structured logs for connection open/close, migration runs (with version), query duration (for slow queries), and errors.
- Log correlationId when available (from IPC).
- Never log sensitive config values in full.

## 17. Security

- SQLite file is placed only in validated locations (via 011) or the application's secure local data directory.
- All access from renderer occurs through IPC + capability checks (013).
- No arbitrary SQL execution from untrusted layers.
- Prepared statements / parameterized queries only.
- Follow Constitution security and local-first rules.

## 18. Performance Targets

- Simple key lookup or status update: < 5 ms P95.
- Small list queries (tens of projects): < 15 ms.
- Migration on first run: acceptable startup cost; logged.
- Connection acquisition: negligible under normal load.
- WAL mode + appropriate busy timeout to keep UI responsive.

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 013 IPC Framework
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: All cross-boundary access and contract versioning
- 009 Workspace Manager
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: Workspace identity and scoping
- 010 Project Manager
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: Project identity and scoping
- 011 File System Service
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: Path validation for any file-backed SQLite locations or references

**Required Services:**
- Local filesystem (via 011)
- Secure IPC transport (013)

**Required Packages:**
- packages/db (or equivalent SQLite abstraction in core)

**Provides:**
- Local, transactional relational store for metadata and operational state
- Versioned schema + migration support
- Fast lookup surface for projects, config, ingestion status

**Consumers:**
- 001 Studio Shell (project lists, settings, status UI)
- Ingestion / indexing modules (102, etc.) for status tracking
- Settings and configuration surfaces
- Any module needing durable, queryable metadata outside the graph

**Other notes:**
- This is the final Core Platform module in the reprioritized Phase A sequence.
- With 016 approved, Phase A Core Platform architecture (001, 009–013, 016) is complete, providing a stable foundation for the Context Engine (100-series), Memory Engine (200-series), and Provider Layer (300-series) without requiring further architectural restructuring.
- SQLite is intentionally limited in scope per docs/006.
- Aligns with IPC Framework clarifications (namespace governance, naming convention `<namespace>:<operation>@<major>.<minor>`, explicit validation ordering, failure matrix).

## 20. Testing Strategy

- Unit tests for repositories and migration logic (in-memory SQLite).
- Integration tests exercising IPC contracts end-to-end (with mocked higher modules).
- Migration round-trip and rollback-safety tests.
- Concurrency / locking tests.
- Error path coverage (corrupt db, locked, schema drift).
- Performance micro-benchmarks for hot paths.
- Lifecycle tests (boot → migrate → use → shutdown).

Complete Layer 4 objective criteria (migrations, scoping, IPC contract usage with `@1.0` naming, 013 failure matrix alignment, durability) are in `prompts/validation/016-sqlite-layer.validation.md`.

## 21. Acceptance Criteria

- All access to SQLite data from untrusted layers occurs exclusively through versioned IPC contracts.
- Schema migrations are safe, versioned, and run automatically on boot.
- Data is strictly scoped to active workspaces/projects (via 009/010 + 011 validation).
- The layer never stores raw file content or primary graph entities.
- Observability (correlation, duration) and standard error envelopes are present on all IPC paths.
- Local durability guarantees are met under normal and abrupt shutdown scenarios.
- Clear ownership boundaries with graph and file system are documented and respected.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order (001, 009–013), docs/002–004, docs/006, docs/007, and the reprioritized Layer 2 plan has been verified.
- Explicit separation from the knowledge graph and file system (per 006) is documented.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (local-first, security, IPC, documentation rules, boundaries).
- All access is described as flowing through 013 IPC; capability and scoping concerns are addressed.
- Contract naming convention, namespace ownership, validation ordering, and resilience behaviours are explicitly aligned with 013 IPC Framework.
- IPC contracts in examples use the canonical `<namespace>:<operation>@<major>.<minor>` form.

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).
