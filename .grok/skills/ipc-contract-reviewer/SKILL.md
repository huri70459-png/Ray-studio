---
name: ipc-contract-reviewer
description: Use for every IPC change (starting with Module 013). Reviews channel naming, ownership, versioning, timeout ownership, error envelopes, capability validation, correlation IDs, observability, lifecycle, and prevention of ad-hoc IPC channels.
---

# IPC Contract Reviewer

**Review-only skill (Phase 3). Starting with Module 013, every IPC change must be reviewed by this skill before architecture review or merge. It never modifies code.**

This is the most consequential Core Platform module. Errors here affect the entire renderer → services stack.

## When to Invoke

- During or after any work on packages/core/src/ipc or related wiring in electron-main/preload
- Before consuming IPC contracts in other modules
- Before architecture-compliance-review for 013 (and any later IPC evolution)
- Before merge-readiness for IPC-touching modules
- When asked to review "IPC contracts", "channel registry", or "trust boundary"

## Checks (Mandatory — From 013 Spec + Validation + Additional Criteria)

- **Channel naming**: exactly `<namespace>:<operation>@<major>.<minor>` everywhere (e.g. `fs:read@1.0`, `watcher:subscribe@1.0`)
- **Channel ownership**: Only the IPC framework (registry in packages/core/src/ipc) registers channels. Namespaces are permanently owned by one module (fs by 011, watcher by 012, etc.). No reuse.
- **Versioning**: Additive within minor; breaking requires major + migration. Version carried or inferable on every call.
- **Timeout ownership**: Owned by IPC layer (not business logic).
- **Standardized error envelopes**: 100% of failures use the exact IpcError shape: status, code, category, message (sanitized), correlationId, retryable, contractVersion. No raw throws, no custom shapes, no stack leakage to renderer.
- **Capability-based authorization + ordering**: Capability validation → strict schema/predicate validation → dispatch. Never reorder or skip.
- **Schema validation ordering**: Confirmed for every path.
- **Correlation IDs**: Present on all invoke/reply and events.
- **Observability metadata**: correlationId, duration, originating/dest module, contractVersion on requests/events/errors.
- **Channel lifecycle**: registration, activation at boot (registry validate), ready, shutdown/close properly handled.
- **Prevention of ad-hoc IPC**: No direct ipcMain.handle, webContents.send with magic strings, or invoke calls outside the approved contracts + preload/main bridge. Grep for raw channel strings in renderer outside thin shims.
- **Full failure matrix coverage** (from validation spec): registry fail, unavailable, version mismatch, timeout, overflow, shutdown, etc. produce documented IpcError behaviour.
- **Renderer never receives secrets, stacks, or internals**.

## Process

1. Read 013 module spec + validation spec + implementation-manifest.
2. Read Constitution §7 (IPC Standards) and §9 DoD.
3. Inspect registry, contracts, server dispatch, error creation, client/preload/main wiring.
4. Grep entire codebase for channel literals, ipcMain, invoke, send outside allowed surfaces.
5. Trace at least one full path per major contract: capability → schema → dispatch + error cases.
6. Verify lifecycle and ordering in code.
7. Map against the validation DoD checklist.

## Output Format

**IPC Contract Review: PASS / FAIL**

**Naming & Ownership:** ...
**Versioning & Evolution:** ...
**Error Envelope:** ...
**Capability → Schema → Dispatch Ordering:** ...
**Correlation + Observability:** ...
**Lifecycle & Timeouts:** ...
**Ad-hoc Prevention:** ...
**Failure Matrix:** ...

**Evidence (key files + test coverage of contracts):**
...

**Required Fixes:**
- ...

**Recommendation:**
- Ready for architecture-compliance-review + merge-readiness (for 013)
- OR blocked until the listed items are addressed

## Related Skills

- security-review
- architecture-compliance-review
- module-validation (especially for 013)
- constitution-compliance-checker
- repository-auditor
- merge-readiness
