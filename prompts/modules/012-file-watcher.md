# 012 — File Watcher

**Module ID:** 012-File-Watcher  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (watcher)

---

## 1. Purpose

The File Watcher detects changes to files and directories within validated workspace and project scopes. It publishes structured change events that allow higher-level modules (ingestion pipelines, context engines, indexers, and graph builders) to react efficiently without polling or performing their own filesystem traversal.

It exists to provide timely, reliable change notification while delegating all path validation, scoping, and safe access exclusively to the File System Service (011). This ensures that change detection never bypasses security or boundary enforcement.

## 2. Responsibilities

- Subscribe to and detect filesystem events (create, modify, delete, rename) within authorized roots.
- Translate raw platform events into normalized, validated change notifications.
- Publish events with canonical, safe paths and metadata.
- Manage watch subscriptions scoped to active workspaces and projects.
- Coordinate with the File System Service for all path validation and access decisions.
- Support efficient, resource-bounded watching (debouncing, batching, ignore patterns where appropriate).

**Ignore Policy Ownership:**
- Watcher owns temporary ignores (e.g. rapid-change suppression) and platform ignores (e.g. native watcher defaults, .git internals).
- Workspace/Project owners define project ignore rules (e.g. .gitignore integration via contracts).
- Indexers / Context Engine own semantic filtering (post-event).

The File Watcher owns change detection and event publication. It owns neither path validation (011), content parsing (ingestion modules), nor reaction logic (indexers, context).

## 3. Scope

- Watching files and directories inside active workspace/project roots provided by 009/010 via 011.
- Detection of common change types: created, modified, deleted, renamed.
- Emission of events containing validated paths and basic metadata (timestamps, change type).
- Subscription management for different consumers and scopes.
- Graceful handling of watch limits, permission changes, and root unavailability.

## 4. Non-Goals

- Performing raw file system reads, writes, or validation (belongs exclusively to 011 File System Service).
- Parsing or indexing file contents (belongs to 101 Context Engine, 102 Incremental Indexer, 103 Tree-sitter Parser, 105 Dependency Graph, etc.).
- Reacting to changes or triggering ingestion (belongs to consumers).
- Global or cross-workspace watching without explicit scoping.
- UI presentation of changes (belongs to Studio Shell).

## 5. Functional Requirements

1. Accept validated roots from the File System Service and establish platform-level watches only on those roots.
2. Detect and normalize filesystem changes (created, modified, deleted, renamed) with accurate timestamps.
3. Publish events containing only validated, canonical paths that have passed through the File System Service.
4. Support scoped watching: per-workspace, per-project, or finer-grained paths provided via safe contracts.
5. Debounce or batch rapid events where appropriate to avoid overwhelming consumers.
6. Handle watch resource limits and report when watches cannot be established. On overflow, emit an overflow event and support resumption after consumer reconciliation.
7. Emit events even when the consuming modules are not immediately available (buffering or replay where feasible).
8. Cleanly release watches when workspaces/projects are deactivated or the service shuts down.
9. Preserve per-root event ordering where the platform provides it; normalize rename sequences to canonical form when correlation is reliable.

## 6. Non-Functional Requirements

- Events must be delivered with low latency after the underlying change (target < 100ms P95 for local files).
- Must not consume excessive resources (CPU, file descriptors) even for large projects.
- Must respect all scoping and validation decisions from the File System Service.
- Must degrade gracefully when the File System Service or IPC is unavailable.
- Must follow Constitution principles for boundaries, security, and observability.

## 7. Architecture

The File Watcher is a Core Platform module that sits directly on top of the File System Service.

Dependency flow (as required for downstream modules):

File Watcher (012)
  ↓ Requests validated roots + safe path contracts
011 File System Service
  ↓ Provides only validated, scoped paths
Actual File System (via privileged host)

Change detection happens only on paths that have been explicitly validated and authorized by 011.

Key principles:
- The File Watcher must never bypass the File System Service for path validation or raw access.
- All paths in published events are guaranteed to be safe and in-scope.
- Detection is decoupled from reaction: watchers publish; indexers, context engines, and ingestion react.
- Loose coupling and explicit contracts between layers.

**Event Ordering Guarantees**

Events are guaranteed to preserve ordering within a watched root whenever the underlying platform provides deterministic ordering. Consumers must tolerate duplicate or reordered events across independent roots. This prevents future assumptions about global total order.

**Rename Semantics**

If a platform only reports `DELETE` + `CREATE` instead of `RENAME`, the watcher normalizes this into the project's canonical event model (`fs:change:renamed`) whenever reliable correlation is possible (e.g., inode correlation, tight timing windows, or path heuristics). When reliable correlation cannot be established, consumers receive the raw delete+create sequence. This ensures consistent behavior for consumers regardless of operating system.

**Overflow Recovery Philosophy**

Large repositories may trigger platform watcher overflow. The architecture defines ownership as follows:

Overflow
↓
Emit Overflow Event (with affected roots)
↓
Consumer performs incremental reconciliation (re-scan or diff against last known state)
↓
Resume watching (watcher re-establishes or continues on signal)

The File Watcher owns detection and emission of overflow. Consumers (e.g. 102 Incremental Indexer) own reconciliation. No automatic full rescan is performed by the watcher.

**Lifecycle**

Startup
↓
Obtain current workspace/project roots via 009/010 through 011 contracts
↓
Request validated watch roots from File System Service
↓
Establish platform watchers on validated roots only
↓
Ready (events can be published)
↓
On workspace/project change (via events from 009/010)
↓
Update or re-establish watches using new validated roots from 011
↓
Shutdown
↓
Release all platform watches cleanly

**Failure Dependencies / Resilience**

| Failure                     | Expected Behavior                                      |
|-----------------------------|--------------------------------------------------------|
| 011 File System Service unavailable | Cannot establish or maintain watches; report service unavailable |
| Workspace/Project Manager unavailable | No new watches; existing watches on last-known validated roots |
| IPC Framework unavailable   | Events cannot be published to renderer consumers; internal buffering if possible |
| Watch resource limit reached | Graceful degradation for some paths; clear error to subscribers |
| Platform watcher overflow | Emit dedicated overflow event; consumers perform incremental reconciliation; resume watching |
| Root becomes invalid (deleted/moved) | Automatically stop watching that root; emit removal events |

The File Watcher must never perform its own path validation. It relies entirely on contracts from 011.

References: Constitution §3, §7, docs/002, docs/004, docs/007, 009 Workspace Manager, 010 Project Manager, 011 File System Service, the reprioritized Core Platform assessment.

## 8. Folder Structure

```
packages/core/src/watcher/
├── watcher.ts                 # Core FileWatcher implementation
├── types.ts                   # ChangeEvent, WatchSubscription, etc.
├── platform/                  # Platform-specific watcher adapters (Electron main)
│   └── chokidar-adapter.ts    # or native equivalent
├── event-normalizer.ts        # Translate raw events to normalized form
├── subscription-manager.ts
└── index.ts
```

The watcher runs in the privileged context and communicates via IPC.

## 9. Public Interfaces

The File Watcher defines the following conceptual contracts (exact TypeScript signatures are reserved for Layer 3 implementation or dedicated API specifications):

**Watch Subscription Contract**
- Inputs: Set of validated paths/roots (obtained via 011 contracts) and optional filters.
- Outputs: Subscription handle.
- Lifecycle: Watches are established only on validated roots; automatically adjusted on scope changes.
- Ownership: Watcher owns detection and subscription management; 011 owns root validity.

**Change Event Contract**
- Inputs: (internal) platform change notification on a validated path.
- Outputs: Normalized event containing validated path, change type, timestamp, and basic metadata.
- Lifecycle: Events are published to all interested subscribers (via IPC or direct for privileged consumers).
- Ownership: Watcher owns normalization and publication; consumers own reaction.

Consumers must obtain validated paths exclusively through the File System Service before requesting watches.

## 10. Internal Components

- PlatformWatcherAdapter: thin wrapper around native/Electron watcher (e.g. chokidar or fs.watch in main process).
- EventNormalizer: converts raw events to canonical form with validated paths.
- SubscriptionManager: tracks active watches per scope and handles add/remove.
- EventPublisher: delivers normalized events through IPC or internal channels.

All path-related decisions are delegated to the File System Service.

## 11. Database Schema

The File Watcher does not own persistent data.

It may maintain transient in-memory state for active subscriptions and recent events (for dedup/debounce).

No file content or knowledge is stored here. All paths in events are validated by 011.

## 12. IPC/API Contracts

Events and subscription management are exposed via the IPC Framework.

The Change Event Contract is versioned as **1.x** independently of the File Watcher module. This separation ensures IPC evolution and contract changes can proceed without requiring module version bumps.

Representative contracts (to be formalized by the IPC module):

- `watcher:subscribe@1.0` (validated roots)
- `watcher:unsubscribe@1.0`
- `watcher:change@1.0` events (validated path, type, metadata)

All paths in these contracts are pre-validated by 011.

Event ordering and deduplication semantics are part of the contract: within-root order is preserved when the platform supports it; cross-root reordering/duplication must be tolerated by consumers.

## 13. Events

The File Watcher publishes:

- `fs:change:created@1.0` (validated path, timestamp)
- `fs:change:modified@1.0` (validated path, timestamp)
- `fs:change:deleted@1.0` (validated path, timestamp)
- `fs:change:renamed@1.0` (old validated path, new validated path, timestamp)
- `fs:watcher:overflow@1.0` (affected roots, timestamp) — signals platform watcher limits exceeded; triggers consumer reconciliation

**Canonical Event Model**

The watcher always emits the project's canonical change events. Platform-specific rename reporting (DELETE+CREATE vs RENAME) is normalized to `fs:change:renamed` when reliable correlation is possible. When not, the raw events are forwarded so consumers can decide.

These events are intended for consumption by the Incremental Indexer (102), Dependency Graph (105), Context Engine (101), and similar modules.

Detection of the underlying changes is performed by this module using platform facilities; the File System Service (011) is responsible for ensuring the paths are safe.

The Change Event Contract Version is 1.x.

## 14. State Management

- Active watch subscriptions keyed by validated root.
- Debounce/batch state for rapid changes.
- Last known roots (sourced from 009/010 via 011).

State is not persisted across restarts; watches are re-established on startup using current validated roots.

## 15. Error Handling

- Failure to establish a watch on a validated root → Clear error to subscriber; continue with other roots.
- Invalid root supplied (should never happen if using 011) → Reject with explicit error.
- Platform watcher errors → Logged and reported; affected subscriptions degraded.
- No silent failures.

## 16. Logging

- Structured logs for watch establishment, errors, and event publication (with sanitized validated paths).
- Performance metrics for detection latency.
- Subscription lifecycle events.

## 17. Security

- The File Watcher never accepts or uses unvalidated paths.
- All watched roots must come from the File System Service (011) via safe contracts.
- Events only ever contain validated paths.
- No privileged operations (reads/writes) are performed by the watcher.

## 18. Performance Targets

- Event publication latency after underlying FS change: < 100ms P95 for local files.
- Low CPU and file descriptor usage for large projects (hundreds of thousands of files).
- Efficient debouncing to avoid event storms.

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 011 File System Service
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: All path validation, scoping, and safe access contracts. The File Watcher must never bypass this service.
- 013 IPC Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Publishing events to renderer and other consumers
- 009 Workspace Manager
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: Workspace roots for scoping
- 010 Project Manager
  - Status: Architecture Approved
  - Contract Version: 1.x
  - Purpose: Project roots for finer scoping

**Required Services:**
- Platform filesystem watcher (privileged context)
- Secure IPC transport

**Required Packages:**
- packages/core (watcher implementation)

**Required APIs:**
- Validated root contracts from 011
- Typed event publication contracts via IPC

**Provides:**
- Normalized, validated change events (Change Event Contract 1.x)
- Scoped watch subscription management
- Overflow signaling and ordering guarantees (within-root when platform-deterministic)

**Consumers:**
- 102 Incremental Indexer
- 103 Tree-sitter Parser (triggered indexing)
- 105 Dependency Graph
- 101 Context Engine (for freshness)
- Ingestion pipelines
- Any module needing timely awareness of file changes

**Other notes:**
- This module is a critical bridge in the Core Platform. Its correctness depends entirely on always obtaining validated paths from 011.
- Events published here are the trigger for keeping the knowledge graph and context up to date.

## 20. Testing Strategy

- Unit tests for event normalization, debouncing, and subscription management.
- Integration tests using the File System Service mocks to verify only validated paths are watched.
- Tests for graceful degradation when 011 or IPC is unavailable.
- Resource usage tests (file descriptors, CPU) on large directory trees.
- End-to-end flows: change on disk → validated event → consumer reaction (via mocks).

See `prompts/validation/012-file-watcher.validation.md` (Layer 4) for the complete set of verifiable cases, especially strict 011 dependency, ordering, overflow, and 013 contract compliance.

## 21. Acceptance Criteria

- Watches are only ever established on paths that have been validated by the File System Service.
- All published events contain only validated, in-scope paths.
- Change detection works for create/modify/delete/rename within watched roots, with rename normalization and per-root ordering guarantees where platform allows.
- The watcher correctly handles workspace/project activation changes by updating watches.
- No direct filesystem access or validation is performed by this module.
- Events are delivered reliably and with acceptable latency.
- Overflow events are emitted on platform limits; ignore policy ownership boundaries are respected in the spec.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order, 009–011, docs/002–004, docs/006–007, and the reprioritized Layer 2 plan has been verified.
- Explicit, unambiguous dependency on 011 for all validation is documented.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (architecture principles, boundaries, security, performance, documentation rules).
- The five minor refinements (Event Ordering, Overflow Recovery, Rename Semantics, Ignore Policy Ownership, Event Contract Versioning) have been incorporated.

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).