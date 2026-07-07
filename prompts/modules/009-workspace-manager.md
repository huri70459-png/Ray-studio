# 009 — Workspace Manager

**Module ID:** 009-Workspace-Manager  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (workspace), apps/studio

---

## 1. Purpose

The Workspace Manager is responsible for the lifecycle, discovery, and current-state management of user workspaces (projects) within Ray Studio. It serves as the authoritative source for "which project is active" and provides the coordination layer between the Studio Shell, file system services, and the knowledge graph.

It exists to enable multi-project workflows while ensuring that all higher-level modules (context assembly, capture, AI surfaces) operate against a consistent, well-defined project boundary.

## 2. Responsibilities

- Discover and list available workspaces from the file system and local configuration.
- Manage opening, closing, switching, and creation of workspaces.
- Maintain the current active workspace and broadcast changes to interested consumers.
- Persist lightweight workspace metadata (last opened, custom name, recent paths) without owning project knowledge.
- Coordinate with lower-level services for validation and access.
- Provide workspace-scoped context to the shell and other modules.

The Workspace Manager owns the concept of "current workspace" and its basic metadata. It does not own the contents of the knowledge graph, source code indexing, or user decisions.

## 3. Scope

- Workspace discovery via file system roots and recent list.
- Workspace open/close/switch operations with proper state transitions.
- Multi-project awareness at the application level.
- Basic workspace metadata (name, root path, last accessed).
- Integration with shell for project switching UI and command palette scoping.

## 4. Non-Goals

- Full file system watching or recursive traversal (belongs to File System Service / File Watcher).
- Ingestion of code, documents, or git history (belongs to Ingestion layer).
- Direct graph entity management or queries (belongs to core knowledge layers).
- UI presentation of workspace lists or switchers (belongs to Studio Shell).
- Secrets or provider configuration storage (belongs to Configuration Service).

## 5. Functional Requirements

1. Allow a user to open an existing directory as a workspace and make it the active context.
2. Maintain and persist a list of recently used workspaces with fast access.
3. Support switching the active workspace and notify all dependent modules.
4. Provide the current workspace root path and basic metadata to callers via defined contracts.
5. Validate that a path is a valid, accessible workspace root before activation.
6. Support creating a new workspace from an empty or existing directory.
7. Gracefully handle the case of no active workspace (global mode or first-run).
8. Allow removal of a workspace from the recent list without deleting files.

## 6. Non-Functional Requirements

- Workspace switch must complete with visible surface updates within 200ms P95.
- Must correctly handle concurrent access from shell and background services.
- Workspace metadata must survive application restarts.
- Must not block on large directory scans during open (delegates to File Watcher).
- Follows Constitution principles of explicit boundaries and loose coupling.

## 7. Architecture

The Workspace Manager sits in the Core Platform layer, acting as a stateful coordinator for project boundaries.

High-level flow:

User / Shell
      │ (open/switch workspace)
Workspace Manager
      │ (validate + metadata)
File System Service + IPC
      │
Knowledge / Ingestion Layers (for the active workspace)

Key principles (Constitution §3):
- Single source of truth for "current workspace".
- Explicit state transitions.
- Consumers (shell, context engine, etc.) react to changes rather than polling.
- No direct file system or graph ownership.

**Lifecycle**

Startup
↓
Load persisted recent workspaces + last active
↓
Validate last active workspace (if any)
↓
If valid: activate it and notify consumers
↓
Ready (shell can present workspaces)
↓
On user action (open/switch/close)
↓
State transition + validation
↓
Notify dependents via events
↓
Shutdown
↓
Persist recent list and current workspace metadata

**Failure Dependencies / Resilience**

- If File System Service unavailable → Cannot open new workspaces; fall back to previously validated recent list in read-only mode.
- If IPC Framework unavailable → Workspace Manager cannot operate; shell must show degraded "no project" state.
- If underlying storage for metadata fails → Operate with in-memory recent list only for the session; warn user on shutdown.

References: Constitution §3, §5, docs/002-system-architecture.md, docs/003-monorepo-architecture.md, docs/004-folder-structure.md, the reprioritized Core Platform assessment.

## 8. Folder Structure

```
packages/core/src/workspace/
├── manager.ts                 # Core WorkspaceManager implementation
├── types.ts                   # Workspace, WorkspaceMetadata, etc.
├── discovery.ts               # Recent list + root validation logic
├── state.ts                   # Current active workspace state machine
├── events.ts                  # Workspace change events
└── index.ts
```

The manager is a core service consumed via the IPC layer by the Studio Shell and other platform modules.

## 9. Public Interfaces

The Workspace Manager defines the following conceptual contracts (exact TypeScript signatures reserved for Layer 3 implementation or API specifications):

**Workspace Discovery Contract**
- Inputs: Optional filter or search criteria.
- Outputs: List of available/recent workspaces with metadata.
- Lifecycle: Available at any time after boot; updated on open/close actions.
- Ownership: Manager owns the recent list and discovery; shell owns presentation.

**Workspace Activation Contract**
- Inputs: Workspace root path or identifier.
- Outputs: Activation result (success + current metadata, or error).
- Lifecycle: Triggers state transition; emits change events to consumers.
- Ownership: Manager owns validation and activation; lower services own file access.

**Current Workspace Query Contract**
- Inputs: None (or lightweight options).
- Outputs: Current active workspace metadata or null.
- Lifecycle: Always reflects the latest activated state.
- Ownership: Manager is the source of truth for "what is active".

Consumers subscribe to change events rather than polling.

## 10. Internal Components

- WorkspaceRegistry: persistence and recent list management.
- ActivationCoordinator: validation + state machine for open/switch/close.
- MetadataStore: lightweight local storage for workspace prefs (non-authoritative).
- EventEmitter: for broadcasting workspace changes.

These interact internally via well-defined functions. All external access is through the public contracts above.

## 11. Database Schema

The Workspace Manager owns zero authoritative project data.

It maintains:
- Recent workspace list (paths + last accessed timestamps + optional custom names)
- Basic UI preferences per workspace (last selected view, open panels — shell-owned but cached here for convenience)
- Session state for the current run

All of the above is UI cache, preferences, layout hints, and session state. It is non-authoritative and never contains knowledge graph entities, decisions, or source artifacts.

Primary knowledge graph and project content are owned by the Memory and Ingestion layers.

See docs/006-database-architecture.md.

## 12. IPC/API Contracts

The Workspace Manager is exposed to the Studio Shell and other consumers exclusively through the IPC Framework.

Representative contracts (to be formalized by the IPC module):

- `workspace:list` — return recent + discoverable workspaces
- `workspace:open` — activate a root path
- `workspace:current` — get active workspace metadata
- `workspace:close` — deactivate current (return to global/no-project state)
- `workspace:switch` — change active workspace

All contracts are versioned and validated.

## 13. Events

The manager emits:

- `workspace:activated` (metadata)
- `workspace:deactivated` ()
- `workspace:list:updated` (recent list)

Consumers (shell, context engine, etc.) subscribe to react to changes.

Payloads are lightweight metadata only.

## 14. State Management

- Single source of truth for the currently active workspace (in-memory + persisted metadata).
- Recent list is append-only with bounded size; persisted locally.
- State machine for transitions: None → Activating → Active → Deactivating → None.
- Immutability for metadata objects passed to consumers.

## 15. Error Handling

- Invalid workspace path → Clear error returned to caller; no state change.
- Access denied by file system → Specific error surfaced; recent list entry may be marked unavailable.
- Metadata persistence failure → Log and continue with in-memory state for the session.
- No silent failures on activation.

## 16. Logging

- Structured logs on open/switch/close with workspace path (sanitized) and duration.
- Errors on validation or persistence failures.
- Lifecycle events (startup load, shutdown persist).

## 17. Security

- Only validated, user-chosen paths are accepted as workspaces.
- No arbitrary path traversal or execution from workspace metadata.
- Workspace metadata never contains secrets.

## 18. Performance Targets

- List recent workspaces: < 50ms.
- Open/switch a typical workspace: < 150ms (excluding ingestion).
- Memory overhead for manager itself: negligible (< 5MB).

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 011 File System Service
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Validation and basic access to workspace roots
- 016 SQLite Layer
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Local persistence of workspace metadata and recent list
- 013 IPC Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: All communication with shell and other modules

**Required Services:**
- Secure IPC transport
- Local metadata store (via SQLite Layer)

**Required Packages:**
- packages/core (shared workspace types and manager)

**Required APIs:**
- Typed contracts for workspace list, open, current, and change events (via IPC Framework)

**Provides:**
- Authoritative "current workspace" and recent list
- Activation lifecycle and change notifications
- Workspace metadata for scoping other operations

**Consumers:**
- 001 Studio Shell (project switching, title, scoping)
- Context Engine and higher layers (for workspace-scoped retrieval)
- Capture flows and AI surfaces (to associate inputs with the correct project)

**Other notes:**
- This module is a foundational Core Platform service. Higher-level modules (Context, Memory, Providers) depend on it for project boundaries.

## 20. Testing Strategy

- Unit tests for activation state machine and recent list logic.
- Integration tests with mocked File System Service for open/switch/close flows.
- Tests for persistence round-trips and graceful degradation.
- Performance tests for list and switch latency.
- E2E coverage via shell flows (workspace open → surfaces update correctly).

Detailed Layer 4 validation (functional cases, edges, perf, security, resilience, integration) lives in `prompts/validation/009-workspace-manager.validation.md`. All implementation must pass the cases defined there.

## 21. Acceptance Criteria

- User can open a directory as a workspace and have it become the active context visible in the shell.
- Recent workspaces persist across restarts and are quickly accessible.
- Switching workspaces correctly updates all dependent surfaces and context scope.
- Invalid or inaccessible paths are rejected with clear feedback.
- The manager reports zero authoritative project knowledge.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order, docs/002–004, docs/007, and the reprioritized Layer 2 plan has been verified.
- No placeholder content.
- Spec committed to prompts/modules/ following the approved structure.
- Relevant Constitution sections (architecture principles, boundaries, documentation, performance, security) were explicitly considered.

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).