# 009 — Workspace Manager Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/009-workspace-manager.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Objective test cases and verification criteria for the Workspace Manager. Derived strictly from its Layer 2 Functional Requirements, Performance Targets, Testing Strategy, and Acceptance Criteria.

## 2. References

- Constitution §9 DoD, performance, boundaries, security
- Layer 2: 009-workspace-manager.md (responsibilities, FRs implied via AC, Perf, state machine)
- 011 File System Service (path validation), 013 IPC Framework, 016 SQLite Layer (persistence), 010 Project Manager
- 001-studio-shell.validation.md, 013.validation.md, 011.validation.md, 016.validation.md

## 3. Functional Test Cases

**FT-001: Open directory as workspace**
- Preconditions: Valid directory path, no active workspace.
- Steps: Request open via IPC contract (validated path) → complete activation.
- Expected: Workspace becomes active, metadata available, state = Active, change notification emitted. Recent list updated.

**FT-002: Recent workspaces list and persistence**
- Preconditions: Several prior workspaces.
- Steps: Restart app → request recent list.
- Expected: List returned < 50ms, contains previous entries (bounded), persisted via SQLite, order correct (most recent first). Unavailable entries marked appropriately.

**FT-003: Switch workspace**
- Preconditions: Workspace A active, Workspace B exists.
- Steps: Switch to B.
- Expected: A deactivates cleanly, B activates, all consumers notified, surfaces scoped correctly. State machine transitions: Active → Deactivating → None → Activating → Active. No data leakage.

**FT-004: Close / deactivate workspace**
- Preconditions: Active workspace.
- Steps: Close request.
- Expected: Clean deactivation, state reset, persistence of any transient metadata, no dangling subscriptions or watches.

**FT-005: Invalid or inaccessible path**
- Preconditions: Path does not exist or no permission.
- Steps: Attempt open.
- Expected: Clear error (no state change), recent list may mark unavailable. No silent failure.

## 4. Edge Cases and Error Conditions

- Multiple rapid open/switch requests → state machine serializes; last valid transition wins or explicit queuing.
- Persistence failure on recent list → log, continue with in-memory for session, no crash.
- Workspace root becomes invalid after open (deleted on disk) → on next access or switch, surface clear error.
- Activation while another is deactivating → rejected or queued per spec.
- Empty or root-level paths (when disallowed by policy) → rejected by 011 validation before manager.

## 5. Performance Benchmarks & Measurement

- List recent workspaces: < 50ms.
- Open/switch typical workspace (metadata only): < 150ms (excl. ingestion).
- Memory overhead: < 5MB for manager itself.

**Verification:** Micro-benchmarks + integration timing around IPC boundaries. CI gates on P95.

## 6. Security, Boundary & IPC Checks

- Only paths validated by 011 File System Service accepted.
- Workspace metadata contains no secrets or executable content.
- All operations via 013 IPC contracts with proper capability (Workspace).
- No direct FS access or arbitrary path handling inside manager.
- Scoping information passed downstream is derived only from validated roots.

Test: Supply unvalidated path → must be rejected before any state change. Verify no path traversal.

## 7. Resilience, Lifecycle & Shutdown

- Open during IPC or SQLite unavailability → clear "unavailable" error.
- Abrupt shutdown during open/switch → on restart, no partial/corrupt state; recent list consistent.
- Workspace on removable media or slow FS → graceful timeout/degradation per 011/013 policies.
- Drain in-flight activations on shutdown.

Use the 013 failure matrix cases (Registry validation, consumer unavailable, version mismatch, timeout, overflow, shutdown-during-invoke).

## 8. Observability & Provenance Requirements

- Structured logs for open/switch/close with sanitized path + duration + correlationId.
- State transitions logged.
- Errors categorized (validation, unavailable, persistence).
- Events emitted for consumers carry sufficient context.

## 9. Integration & Cross-Module Scenarios

- Shell (001) → open workspace (009) → 011 validates path → 016 persists → 010 projects become available → 012 watcher updates for new root → 013 events flow.
- Switch workspace while capture or context query in progress → scoping updates atomically for new operations.
- Recent list used by shell on launch.

## 10. Definition of Done Verification Checklist

- [ ] All FT cases + edges pass.
- [ ] Perf targets met.
- [ ] Security/boundary enforcement (relies on 011) verified.
- [ ] State machine correct under all transitions and failures.
- [ ] Persistence roundtrips (016) correct and durable across restarts.
- [ ] Layer 2 AC fully covered.
- [ ] Constitution §9 + module DoD satisfied.
- [ ] Cross-module flows with 001/010/011/013/016 green.
- [ ] No direct FS/validation bypasses.

**Verification:** Run against IPC mocks + real FS (sandboxed) + SQLite. Separate verification pass required.
