# 010 — Project Manager

**Module ID:** 010-Project-Manager  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (project)

---

## 1. Purpose

The Project Manager is responsible for the configuration, metadata, and operational state of an individual project within an active workspace. It provides the authoritative view of project-level settings, identity, and runtime state while maintaining strict separation from the broader workspace and from the knowledge graph contents.

It exists to give higher-level modules (context assembly, ingestion, AI surfaces) a consistent, queryable understanding of "the current project" without exposing raw file system details or persistent knowledge ownership.

## 2. Responsibilities

- Manage project identity, root path, and basic metadata within the containing workspace.
- Handle project-specific configuration (local settings, overrides, feature flags).
- Track and expose project activation and state within the workspace.
- Coordinate project-scoped operations with lower platform services.
- Provide project boundaries and metadata to consumers via defined contracts.
- Ensure project state is consistent across shell, context, and tooling layers.

The Project Manager owns project-level configuration and state. It does not own the contents of the knowledge graph, source artifacts, or workspace-level concerns.

## 3. Scope

- Project discovery and validation within a workspace.
- Reading and writing of project-local configuration.
- Project activation and deactivation state.
- Exposure of project metadata (name, root, last state, custom attributes).
- Coordination of project-scoped events and queries.

## 4. Non-Goals

- File system watching or deep traversal (belongs to File System Service and File Watcher).
- Ingestion of code, documents, or history into the graph (belongs to Ingestion layer).
- Storage or querying of knowledge graph entities (belongs to core memory layers).
- Workspace-level concerns such as recent list or multi-project switching (belongs to Workspace Manager).
- UI presentation of project lists or settings (belongs to Studio Shell).

## 5. Functional Requirements

1. Given a workspace and project root, load or initialize the project with its metadata and configuration.
2. Provide the current active project (if any) and its metadata to authorized consumers.
3. Support updating project-local configuration in a safe, atomic manner.
4. Emit clear events on project activation, deactivation, and metadata changes.
5. Validate project roots for accessibility and basic structure before activation.
6. Allow projects to carry lightweight custom metadata without polluting the knowledge graph.
7. Support graceful handling of projects that are no longer present on disk.
8. Ensure project state is correctly scoped when the parent workspace changes.

## 6. Non-Functional Requirements

- Project switch or activation within a workspace must be fast (< 100ms P95 for metadata operations).
- Configuration changes must be immediately visible to dependent modules.
- Must survive application restarts while remaining consistent with the file system.
- Must not introduce blocking I/O on the main thread for configuration access.
- Follow Constitution principles of explicit boundaries, loose coupling, and token-efficient design.

## 7. Architecture

The Project Manager operates inside an active workspace and acts as the boundary between workspace-level concerns and project-specific state.

Position in layers:

Workspace Manager (009)
      │
Project Manager (this module)
      │ (project root + config)
File System Service (011) + SQLite Layer (016)
      │
Ingestion / Knowledge Layers (scoped to this project)

Key decisions (Constitution §3):
- Single source of truth for project identity and local config within a workspace.
- Project config is separate from the knowledge graph.
- Consumers react to events rather than direct file access.
- Strong scoping to prevent cross-project leakage.

**Lifecycle**

Startup (within workspace)
↓
Load last active project (if any) from persisted metadata
↓
Validate project root via File System Service
↓
Activate project and load configuration
↓
Notify dependents (shell, context, etc.)
↓
Ready for project-scoped operations
↓
On switch / close
↓
Persist current state
↓
Deactivate and emit events
↓
Shutdown
↓
Persist final project metadata

**Failure Dependencies / Resilience**

- If File System Service unavailable → Cannot validate or access new projects; operate with last-known-good metadata in read-only mode.
- If Workspace Manager unavailable → Project Manager cannot function (no containing workspace); report degraded state upward.
- If IPC Framework unavailable → No cross-layer notifications; shell and other consumers see stale project state.
- If SQLite Layer unavailable → Fall back to in-memory project metadata for the session; warn on shutdown.

References: Constitution §3, §5, docs/002-system-architecture.md, docs/003-monorepo-architecture.md, docs/004-folder-structure.md, the reprioritized Core Platform assessment, 009 Workspace Manager.

## 8. Folder Structure

```
packages/core/src/project/
├── manager.ts                 # Core ProjectManager implementation
├── types.ts                   # Project, ProjectMetadata, ProjectConfig
├── config.ts                  # Project-local configuration loader/writer
├── state.ts                   # Activation state machine
├── events.ts                  # Project lifecycle events
└── index.ts
```

The manager is a core service. It is consumed by the shell (via IPC) and by higher platform and context modules.

## 9. Public Interfaces

The Project Manager defines the following conceptual contracts (exact TypeScript signatures are reserved for Layer 3 implementation or dedicated API specifications):

**Project Activation Contract**
- Inputs: Project root path (within current workspace) and optional activation options.
- Outputs: Activation result containing project metadata or error details.
- Lifecycle: Triggers state transition from inactive to active; emits change events.
- Ownership: Manager owns validation, loading, and state; lower services own file and storage access.

**Project Metadata Query Contract**
- Inputs: None or lightweight query options.
- Outputs: Current project metadata (identity, root, custom attributes, last state).
- Lifecycle: Reflects the latest activated state; updates on configuration changes.
- Ownership: Manager is the source of truth for project-level identity and config.

**Project Configuration Contract**
- Inputs: Configuration key or partial update.
- Outputs: Updated configuration or acknowledgment.
- Lifecycle: Changes are immediately visible; persisted atomically where supported.
- Ownership: Manager owns the configuration surface; consumers own interpretation.

Consumers subscribe to events for activation and metadata changes.

## 10. Internal Components

- ProjectRegistry: in-workspace project metadata and recent-within-workspace list.
- ActivationCoordinator: validation and state transitions for activate/deactivate.
- ConfigStore: reading/writing of project-local configuration (scoped, non-graph).
- EventEmitter: for project lifecycle and metadata change notifications.

Internal interactions use well-defined functions. External access occurs only through the public contracts and IPC.

## 11. Database Schema

The Project Manager owns zero authoritative project knowledge data.

It maintains:
- Project metadata (root path, display name, timestamps, lightweight custom attributes)
- Project-local configuration (settings, overrides, feature flags)
- Activation state within the parent workspace

All of the above is configuration, preferences, and session state scoped to the project. It is non-authoritative with respect to the knowledge graph and source artifacts.

The primary knowledge graph and ingested project content are owned by the Memory and Ingestion layers.

See docs/006-database-architecture.md.

## 12. IPC/API Contracts

The Project Manager is exposed to the Studio Shell and other consumers exclusively through the IPC Framework.

Representative contracts (to be formalized by the IPC module):

- `project:current` — return active project metadata
- `project:activate` — activate a project root within the current workspace
- `project:deactivate` — deactivate the current project
- `project:config:get` / `project:config:set` — access project-local configuration
- `project:metadata:update` — update non-authoritative project attributes

All contracts are versioned and validated.

## 13. Events

The manager emits:

- `project:activated` (metadata)
- `project:deactivated` ()
- `project:metadata:changed` (key, value)
- `project:config:updated` (partial config)

Consumers (shell, context engine, ingestion) react to these events.

Payloads contain only metadata and configuration deltas.

## 14. State Management

- Single source of truth for the active project within the workspace (in-memory + persisted metadata).
- State machine: Inactive → Validating → Active → Deactivating → Inactive.
- Configuration is loaded on activation and kept in memory with write-through where appropriate.
- Immutability for metadata objects passed to consumers.

## 15. Error Handling

- Invalid or inaccessible project root → Clear error returned; no activation.
- Configuration parse or write failure → Error surfaced; previous valid config remains in effect.
- Metadata persistence failure → Continue with in-memory state; log and warn user.
- No silent failures on activation or configuration operations.

## 16. Logging

- Structured logs for activation, deactivation, and configuration changes (with project root, sanitized).
- Errors on validation or persistence.
- Lifecycle events (load on startup, persist on shutdown).

## 17. Security

- Only validated paths within the current workspace are accepted.
- Project configuration never stores secrets (those belong to Configuration Service).
- No execution or arbitrary path access from project metadata.

## 18. Performance Targets

- Return current project metadata: < 20ms.
- Activate a project (metadata + config load): < 80ms (excluding any ingestion).
- Configuration read/write: negligible latency.
- Memory overhead: minimal (project metadata is small).

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 009 Workspace Manager
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Containing workspace and multi-project coordination
- 011 File System Service
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Validation and access to project roots
- 016 SQLite Layer
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Persistence of project metadata and configuration
- 013 IPC Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Communication with shell and higher layers

**Required Services:**
- Secure IPC transport
- Local metadata and configuration store (via SQLite Layer)

**Required Packages:**
- packages/core (shared project types and manager implementation)

**Required APIs:**
- Typed contracts for project activation, current metadata, configuration access, and events (via IPC Framework)

**Provides:**
- Authoritative project identity and local configuration within the active workspace
- Project activation lifecycle and change notifications
- Project-scoped boundaries for higher modules

**Consumers:**
- 001 Studio Shell (project display and scoping)
- Context Engine (for project-scoped retrieval)
- Ingestion layer (to target the correct project)
- AI surfaces and capture flows

**Other notes:**
- This module depends on Workspace Manager (009) being active.
- It is a required foundation for project-scoped behavior in Context, Memory, and Provider layers.

## 20. Testing Strategy

- Unit tests for activation state machine, metadata handling, and configuration logic.
- Integration tests with mocked File System Service and SQLite Layer.
- Tests for persistence round-trips, graceful degradation on missing roots, and event emission.
- Performance tests for activation and metadata access latency.
- E2E coverage via shell (project activation → surfaces and context update correctly).

Detailed Layer 4 validation cases are in `prompts/validation/010-project-manager.validation.md`. Implementation is complete only when the objective criteria in Layer 4 are satisfied.

## 21. Acceptance Criteria

- A project within a workspace can be activated and its metadata becomes available to consumers.
- Project-local configuration can be read and written atomically and survives restarts.
- Activation of an invalid or missing project root is rejected cleanly.
- Project state changes are correctly reflected in the shell and context layers.
- The manager reports zero ownership of knowledge graph or source content.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order, docs/002–004, docs/007, 009 Workspace Manager, and the reprioritized Layer 2 plan has been verified.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (architecture principles, boundaries, documentation rules, performance, security).

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).