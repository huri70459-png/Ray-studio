# 010 — Project Manager Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/010-project-manager.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Concrete objective criteria for Project Manager implementation. Expands Layer 2 Testing Strategy and Acceptance Criteria.

## 2. References

- Constitution §9, performance, local-first, scoping
- Layer 2: 010-project-manager.md
- Dependencies: 009 Workspace Manager, 011 File System Service, 013 IPC, 016 SQLite Layer
- Sibling validations: 009.validation.md, 011.validation.md, 013.validation.md, 016.validation.md, 001.validation.md

## 3. Functional Test Cases

**FT-001: Activate project within active workspace**
- Preconditions: Workspace active (009), valid project root inside workspace.
- Steps: Activate project via contract.
- Expected: Project metadata available < 20ms for subsequent gets. State active. Local config loaded. Notifications emitted. Scoped correctly for consumers.

**FT-002: Project-local configuration read/write**
- Preconditions: Project active.
- Steps: Set config key/value → read back → restart → read again.
- Expected: Atomic, survives restart via 016. Only visible within project scope. No leakage to other projects.

**FT-003: List / get project metadata**
- Preconditions: Multiple projects.
- Steps: Get current, list by workspace.
- Expected: Fast lookups, correct metadata, no knowledge graph or file content stored here.

**FT-004: Deactivate / switch project**
- Preconditions: Project active.
- Steps: Deactivate or switch.
- Expected: Clean state transition, consumers notified, config flushed if needed.

**FT-005: Invalid / missing project root**
- Preconditions: Workspace active.
- Steps: Activate non-existent or out-of-scope root.
- Expected: Rejected cleanly with error; no partial state.

## 4. Edge Cases and Error Conditions

- Activate while workspace is switching → rejected or properly sequenced.
- Config write during shutdown → durable or explicit error.
- Concurrent config reads/writes → serialized or transactional via SQLite.
- Project root deleted externally → next operation surfaces clear error.
- Large number of projects → list remains fast.

## 5. Performance Benchmarks & Measurement

- Current project metadata: < 20ms.
- Activate (metadata + config): < 80ms (excl. ingestion).
- Config R/W: negligible.
- Memory: minimal.

**Verification:** Timing around public IPC contracts + SQLite.

## 6. Security, Boundary & IPC Checks

- All paths validated by 011 before activation/use.
- No secrets in project config.
- Strict scoping: operations only within active workspace/project.
- Everything via 013 IPC + capability checks (Project).
- Never owns or touches graph content or raw files.

Test cross-scope activation attempts and verify 011 enforcement.

## 7. Resilience, Lifecycle & Shutdown

- SQLite (016) or IPC (013) unavailable during activate → deterministic error.
- Abrupt shutdown mid-activation → on restart no corrupt project state; activation can be retried.
- Graceful drain of in-flight config ops.
- Apply 013 failure matrix (timeout, version mismatch, consumer unavailable, shutdown-during-invoke, etc.).

## 8. Observability & Provenance

- Logs for activation/deactivation/config changes (sanitized paths + correlationId + duration).
- State transitions visible.
- Errors mapped to standard IPC envelope.

## 9. Integration Scenarios

- 001 shell → 009 workspace open → 010 project activate (011 validates) → 016 persist → consumers (ingestion, context, shell surfaces) receive scoped project.
- Config update → visible to settings surfaces.
- Project switch during active capture or indexing → new project scope applies to subsequent work.

## 10. Definition of Done Verification Checklist

- [ ] FT-001 to FT-005 + edges pass.
- [ ] Perf targets met.
- [ ] Scoping + 011 validation strictly enforced.
- [ ] Persistence durable and isolated (016).
- [ ] State machine correct.
- [ ] Layer 2 AC (010) satisfied.
- [ ] Full integration with 009/011/013/016/001.
- [ ] Constitution DoD + this validation spec.
