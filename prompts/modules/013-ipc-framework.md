# 013 — IPC Framework

**Module ID:** 013-IPC-Framework  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/core (ipc), apps/studio

---

## 1. Purpose

The IPC Framework defines the canonical, versioned, secure communication layer between the untrusted UI/renderer layer (Studio Shell and feature surfaces) and all privileged services running in the main/Electron host process.

It exists to enforce strict trust boundaries, provide stable contracts for every cross-process interaction (file system, watching, graph queries, AI providers, settings, capture, etc.), and guarantee consistent versioning, validation, error handling, and resilience semantics across the entire desktop application. Every privileged boundary crossing (Studio Shell ↔ File System Service, File Watcher, Context Engine triggers, DB access, etc.) flows through contracts defined or governed by this module.

## 2. Responsibilities

- Define and own the master catalog of typed IPC contracts (request/response + event channels).
- Establish and enforce the versioning strategy (contract versions independent of module versions where possible).
- Specify the trust boundary model: renderer is untrusted; main process owns secrets, direct FS, database, native resources, and spawns.
- Define the canonical error envelope, validation rules at both ends of the boundary, and provenance requirements.
- Specify lifecycle, connection, and readiness semantics for IPC surfaces.
- Define resilience patterns: timeouts, backpressure, buffering for events, graceful degradation.
- Provide the security model and validation requirements for all channels (origin, schema, capability checks).
- Own the rules for contract evolution (additive changes within minor version; breaking changes require major version + migration path).

The IPC Framework owns the contracts and rules. It does not own transport implementation details (Electron ipcMain/ipcRenderer adapters, preload bridge, etc.), nor the business logic of any service.

**Channel Ownership Rules (prevents scope creep):**
- IPC owns: channel registration, routing, serialization, validation, lifecycle, contract registry.
- Modules own: payload schemas (business data), business logic, permissions / authorization decisions.
- Consumers own: reactions to events and responses.

No module may invent IPC channels directly. All channels must be registered through the IPC Framework's Contract Registry.

## 3. Scope

- All privileged operations exposed to the renderer: FS (011), Watcher (012), Workspace/Project (009/010), AI invocations, graph queries/ingest, settings, capture, MCP tool invocation (mediated), background tasks, etc.
- Event publication from privileged services to renderer subscribers (watcher changes, operation completions, etc.).
- Request/response patterns with explicit request IDs for correlation.
- Versioned channel names or payload versioning.
- Validation and sanitization rules applied at the boundary.
- Startup/shutdown coordination for IPC surfaces.

## 4. Non-Goals

- Implementing platform-specific IPC transport (belongs to platform adapters / preload).
- Defining REST or external API surfaces (see 008-rest-api).
- Owning MCP protocol details (MCP is external; IPC mediates calls to MCP tools).
- Business logic, data models, or feature orchestration (belongs to owning modules).
- Direct renderer access to Node, secrets, or raw file system.

## 5. Functional Requirements

1. Provide a typed contract system where every channel has a declared schema, direction (invoke / event), and version.
2. Enforce that all privileged calls originate from validated, isolated renderer contexts only.
3. Support both request/response (with correlation and timeout) and fire-and-forget / pub-sub event patterns.
4. Guarantee that contract version is carried or inferable on every call; consumers and providers can negotiate or reject incompatible versions.
5. Emit structured, versioned events for state changes originating in privileged services (e.g., watcher changes, FS operation results).
6. Provide standard error shapes that include category, code, message (sanitized), and optional context without leaking secrets.
7. Support cancellation of in-flight requests where the underlying operation is cancellable.
8. Allow safe subscription management (subscribe/unsubscribe with scope).
9. Enable incremental rollout: additive fields within the same contract minor version must not break existing consumers.

## 6. Non-Functional Requirements

- IPC overhead must be negligible for local operations (target < 5 ms P95 added latency for simple invokes).
- Must never allow privilege escalation or secret leakage into renderer.
- Must remain responsive under bursty event loads (watcher storms, large graph results).
- Must support graceful degradation when a privileged service is unavailable (clear errors, no renderer crashes).
- Must follow Constitution principles for boundaries, security, observability, and token efficiency.

## 7. Architecture

The IPC Framework sits at the heart of the Core Platform trust boundary.

```
Renderer (untrusted)
  ↓ (via capability-granted client)
Capability (Workspace | Project | Database | Context | Providers | ...)
  ↓
IPC Framework (013) — registry, routing, validation, lifecycle
  ↓ (validated + authorized)
Privileged Services (main process)
  011 File System Service
  012 File Watcher
  009/010 Managers
  DB / Graph layer
  Provider Router (301)
  ...
```

Capability-based access: Renderer never talks directly to services. Access is granted through narrow capabilities. This scales better than blanket "renderer can call everything".

**Trust Model**

- Renderer: completely untrusted for privileged operations. All inputs are hostile until validated on main.
- Access is mediated by **capabilities** (e.g. Workspace, Project, Database, Context, Providers). A renderer surface receives only the narrow capabilities it needs.
- Main: sole owner of secrets, direct FS access, DB connections, native processes, LLM keys, MCP spawning.
- Every crossing is explicit, schema-validated on both sides, and logged with sufficient provenance.

Capability validation occurs before schema validation, which occurs before handler dispatch.

**Versioning Strategy**

- IPC contracts are versioned independently (e.g. `fs:read@1.0`, `watcher:subscribe@1.0` per the naming convention).
- Contract version changes are decoupled from module implementation versions.
- Within a minor version: additive only (new optional fields, new events).
- Major version: breaking change. Requires coordinated consumer updates and possibly dual-channel support during transition.
- The IPC Framework owns the versioning policy and the registry of active contract versions.

**Contract Naming Convention**

Channel names follow one permanent naming rule for all contracts:

`<namespace>:<operation>@<major>.<minor>`

Examples:
- `workspace:open@1.0`
- `watcher:subscribe@1.0`
- `fs:read@1.0`

This convention removes ambiguity for consumers and implementers across the platform. All examples and contract definitions must adhere to it.

**Explicit Contract Registry (first-class architectural component)**

The Contract Registry is the single source of truth for all IPC channels. No module is allowed to invent ad-hoc channels.

Registry responsibilities:
- Channel names (namespaced, e.g. `fs:`, `watcher:`)
- Ownership declaration (which module owns the contract)
- Version (current + supported previous)
- Deprecation policy and sunset dates
- Lifecycle state (proposed, active, deprecated, retired)

Channel namespaces are permanently owned by exactly one module and may never be reused by another module.

Every Core Platform module must register its contracts at boot. The registry is validated before channels are opened.

**Lifecycle (every Core Platform module participates)**

Boot
↓
Register Contracts (with Contract Registry)
↓
Validate Registry (ownership, versions, deprecation)
↓
Open Channels (capability + schema validation active)
↓
Ready

Runtime (requests, events, subscriptions)

Shutdown
↓
Drain Outstanding Requests (graceful timeout + cancellation)
↓
Close Channels + Unsubscribe
↓
Release Registry entries

The IPC Framework coordinates the global lifecycle. Individual modules (FS, Watcher, etc.) must expose compatible lifecycle hooks so the platform can start and stop cleanly.

**Resilience Model**

- Timeouts and cancellation per request family.
- Event streams support backpressure (renderer can pause/resume or drop under load).
- Transient failures on privileged side → clear transient error to caller; idempotency encouraged for safe retries on writes where applicable.
- Critical services (FS, DB) unavailability is surfaced immediately rather than hanging.
- Buffering of high-volume events (watcher) is owned by the emitting service, not the IPC layer itself.

**Failure Matrix (conceptual)**

| Failure                    | Expected Behaviour          |
|----------------------------|-----------------------------|
| Registry validation fails  | Startup abort               |
| Consumer unavailable       | Deterministic error         |
| Version mismatch           | Reject contract             |
| Timeout                    | Standard timeout envelope   |
| Event overflow             | Backpressure/drop policy    |
| Shutdown during invoke     | Graceful cancellation       |

**Timeout Ownership (clear separation of concerns):**
- IPC owns: timeout detection and signaling.
- Consumers own: retry policy (backoff, max attempts).
- Business modules own: idempotency guarantees (so retries are safe).

This prevents the IPC layer from making business-level retry or idempotency decisions.

**Observability**

Every IPC request and event must conceptually carry or be traceable with:
- correlationId (end-to-end across renderer ↔ IPC ↔ service)
- duration (measured at IPC boundary)
- originatingModule / destinationModule
- contractVersion

These fields are invaluable for debugging cross-boundary issues, performance tracing, and incident response. The IPC Framework defines the requirement; concrete transport implementations (and services) must propagate them.

Structured logs and error envelopes must include these where applicable.

**Security Model**

- Context isolation + sandbox enforced at Electron level.
- Every invoke validates sender origin / webContents.
- Input schema validation (strict) on main before any privileged action.
- Output sanitization: never send raw secrets, full paths outside scope, or unvalidated data.
- No dynamic code evaluation across boundary.
- Capability-style scoping where possible (e.g., a subscription carries the validated root scope from 011).

References: Constitution §9 (IPC Standards), docs/007-ipc-architecture.md, docs/002-system-architecture.md, 001 Studio Shell, 009 Workspace Manager, 010 Project Manager, 011 File System Service, 012 File Watcher.

## 8. Folder Structure

```
packages/core/src/ipc/
├── contracts/                 # Versioned contract definitions (schemas + types)
│   ├── fs.contract.ts         # 1.x
│   ├── watcher.contract.ts    # 1.x
│   ├── graph.contract.ts
│   ├── ai.contract.ts
│   └── index.ts
├── client.ts                  # Typed client factory for renderer
├── server.ts                  # Handler registration + dispatch in main
├── validation.ts              # Schema validation (both directions)
├── errors.ts                  # Standard error envelope + codes
├── versioning.ts              # Version negotiation and compatibility rules
├── transport/                 # Thin adapters (Electron ipcMain / contextBridge)
│   └── electron.ts
└── index.ts
```

Contracts are the source of truth. Adapters are minimal.

## 9. Public Interfaces

Conceptual contracts (exact TypeScript shapes defined in Layer 3; here for architecture):

**Invoke Contract (request/response)**
- `invoke<TReq, TRes>(channel: string, version: string, req: TReq): Promise<TRes>`
- Must carry or imply contract version.
- Returns typed result or throws typed IPCError.

**Event Contract**
- `on<T>(channel: string, version: string, handler: (payload: T) => void): Unsubscribe`
- `emit<T>(channel: string, version: string, payload: T): void` (from main only for privileged events)

**Contract Definition Shape (owned by IPC Framework)**
```ts
interface IpcContract<Req, Res, Evt = never> {
  version: '1.x';
  channel: string;
  requestSchema: Schema<Req>;
  responseSchema: Schema<Res>;
  eventSchema?: Schema<Evt>;
}
```

All higher modules (001, 011, 012, ...) consume these definitions rather than inventing ad-hoc channels.

## 10. Internal Components

- ContractRegistry: authoritative list of all active contracts + versions.
- IpcServer: main-side dispatcher with validation + handler lookup.
- IpcClient: renderer-side proxy with version guard.
- Validator: schema enforcement (Zod or equivalent) + friendly error mapping.
- ErrorMapper: converts internal domain errors to safe IPC envelope.
- VersionNegotiator / Compatibility checker.
- TransportAdapter: thin binding to Electron primitives (no business logic).

## 11. Database Schema

The IPC Framework itself owns no persistent data.

Transient state may include:
- Active subscriptions (channel + subscriber identity + scope).
- In-flight request correlation (requestId → callback + timeout).

All durable state belongs to the owning modules (graph, settings, workspaces, etc.).

## 12. IPC/API Contracts

This module **is** the owner of IPC contracts.

Core channel families (examples; full catalog grows with modules):

- `fs:*` — 011 File System Service (validated paths only)
- `watcher:*` — 012 File Watcher (events + subscribe)
- `workspace:*`, `project:*` — 009/010
- `graph:*` — query, ingest, mutations (via context/graph layers)
- `ai:*` — invoke, stream (with assembled context only)
- `settings:*`
- `capture:*`
- `mcp:*` (mediated tool calls)
- `system:*` (lifecycle, health)

Every channel declares its contract version using the canonical form (e.g., `watcher:change@1.0` or payload-embedded `contractVersion`).

The framework defines the wire format for errors, correlation IDs, and cancellation tokens.

## 13. Events

The IPC Framework does not invent domain events. It transports events defined by owning modules under its versioning and validation rules.

Privileged services emit domain events (e.g. `fs:change@1.0`, `watcher:overflow@1.0`) through the framework's emit path.

Renderer surfaces subscribe via the typed client.

## 14. State Management

- Contract registry is static at runtime (or loaded from definitions).
- Per-connection subscription tables (main side).
- Correlation maps for request/response (with TTL).
- No cross-session persisted IPC state.

State is scoped to the current application instance.

## 15. Error Handling

All IPC failures **must** use a single standard error envelope (architectural requirement, frozen shape):

```ts
interface IpcError {
  status: 'error';
  code: string;               // e.g. 'FS_ACCESS_DENIED', 'IPC_TIMEOUT'
  category: 'validation' | 'authz' | 'timeout' | 'unavailable' | 'internal' | 'contract';
  message: string;            // sanitized, actionable for UI
  correlationId?: string;
  retryable: boolean;
  contractVersion?: string;
  // additional context only when safe
}
```

Every IPC failure returns this exact conceptual shape. No ad-hoc error shapes allowed across module boundaries.

- Validation failures at boundary are never silent.
- Domain errors from services are mapped to safe forms.
- Renderer never receives stack traces or internal paths.
- Timeouts produce explicit timeout errors rather than hanging promises.

## 16. Logging

- Structured logs on every boundary crossing (sanitized channel, version, duration, result category, scope context).
- All validation failures and authz denials at warning/error level.
- Correlation IDs for request tracing.
- No secrets or full file content in logs.

Observability fields (correlationId, duration, originating/destination module, contractVersion) must be included on request/event logs and errors.

## 17. Security

- Renderer context is isolated; direct Node access is impossible.
- Every invoke is validated for:
  - Origin (webContents id / frame).
  - Contract version compatibility.
  - Input schema (strict, fail-closed).
  - Scope authorization (paths must have been validated by 011 before use in fs/watcher calls).
- No secrets, keys, or raw DB handles ever cross to renderer.
- Output from privileged side is minimized and filtered.
- Follows Constitution §7 Security and §9 IPC Standards (context isolation, typed contracts, validation at boundaries).

## 18. Performance Targets

- Invoke round-trip overhead (validation + dispatch): < 5ms P95 for simple operations.
- Event fan-out latency: < 10ms P95 under moderate load.
- Memory: bounded subscription state; no unbounded buffering inside IPC layer.
- Graceful handling of thousands of watcher events without blocking the main thread (backpressure signals available).

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- (None hard; foundational layer)
  - Relies on platform primitives (Electron IPC + context isolation)

**Required Services:**
- Secure context-isolated bridge (Electron main + renderer preload)
- Validation library (shared types)

**Required Packages:**
- packages/core (contract definitions, client/server, validation)

**Provides:**
- Versioned IPC contract catalog (1.x baseline)
- Typed client/server primitives
- Trust boundary enforcement rules
- Standard error model and resilience patterns

**Consumers:**
- 001 Studio Shell
- 009 Workspace Manager
- 010 Project Manager
- 011 File System Service
- 012 File Watcher
- 101 Context Engine (and 102–105)
- 201 Memory Engine
- 301 Provider Router
- All future privileged services and UI surfaces

**Contract Versioning Note:**
Individual service contracts (fs, watcher, etc.) carry their own 1.x versions. The IPC Framework defines the meta-rules and transport envelope version.

**Other notes:**
- This is the single most architecturally significant Core Platform module. All desktop boundaries (Studio Shell ↔ privileged services) depend on it.
- With 013 + 016 approved, Phase A Core Platform (001, 009–016) is complete. This provides a stable foundation for the Context Engine (100-series), Memory Engine (200-series), and Provider Layer (300-series) without requiring further architectural restructuring.

## 20. Testing Strategy

- Unit tests for contract validation, versioning compatibility matrix, error mapping.
- Integration tests exercising the preload bridge with mocked services.
- Security tests: attempt to invoke without validation, send malformed payloads, cross-scope paths.
- Resilience tests: service crash during request, high-volume event floods, version mismatch.
- Contract evolution tests: verify additive changes do not break prior clients.
- End-to-end flows: UI action → IPC invoke → service → event back to UI (with full validation).

**Layer 4 Validation Spec:** `prompts/validation/013-ipc-framework.validation.md` is the authoritative, objective source for all acceptance. It expands this strategy with the complete failure matrix, naming convention enforcement, capability→schema→dispatch ordering proofs, registry tests, and cross-module contract exercises. Every implementation path must be validated against it.

## 21. Acceptance Criteria

- Every privileged operation used by the renderer is governed by an explicit, versioned contract defined or registered through the IPC Framework.
- Renderer cannot bypass validation or reach privileged resources directly.
- Contract versions are independent; services can evolve without forcing IPC framework changes.
- Clear error semantics and timeouts are present on all request paths (standard envelope with status/code/category/message/correlationId/retryable).
- Overflow, unavailable, and validation cases produce deterministic, logged outcomes.
- All cross-boundary paths carry validated scope context where relevant (especially FS and Watcher).
- Capability-based access, explicit channel ownership, Contract Registry, and observability fields are enforced architecturally.
- Timeout ownership, lifecycle, and error envelope rules are documented and consistent.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- This specification has been self-reviewed against the Constitution.
- Architectural consistency with the Core Platform order (001, 009–013, 016), docs/002–004, docs/007, docs/010, and the reprioritized Layer 2 plan has been verified.
- Explicit trust boundary, versioning strategy, resilience model, and security model are documented.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (IPC Standards §9, Security, boundaries, documentation rules).
- Dependencies on 011/012 and consumers from 001/101+ are correctly recorded with contract version expectations.
- The seven refinements (Channel Ownership, Capability-Based Access, Explicit Contract Registry, Lifecycle, Timeout Ownership, Standard Error Envelope, Observability) plus four minor clarifications (Channel Namespace Governance, Failure Matrix, Contract Naming Convention, Explicit Validation Ordering) have been incorporated.

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).
