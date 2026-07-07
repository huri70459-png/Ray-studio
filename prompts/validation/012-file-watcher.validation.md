# 012 — File Watcher Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/012-file-watcher.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Objective criteria ensuring the watcher only ever operates on validated paths and produces reliable, scoped events. Critical for keeping graph/context fresh.

## 2. References

- Layer 2: 012-file-watcher.md (esp. "must never perform its own path validation")
- 011 File System Service (sole source of validated roots and contracts)
- 013 IPC Framework (contracts @1.0 form, error envelope, failure matrix, observability)
- 009/010, 001, 016, 101+ consumers
- 011.validation.md and 013.validation.md (foundational)

## 3. Functional Test Cases

**FT-001: Subscription only on 011-validated paths**
- Preconditions: Workspace/project active.
- Steps: Request subscribe with validated root (from 011) vs unvalidated.
- Expected: Only validated roots result in platform watch. Unvalidated rejected at IPC boundary (013 + 011).

**FT-002: Change events for create/modify/delete/rename**
- Steps: Perform FS ops via 011 on watched root.
- Expected: Normalized events emitted with validated paths only. Timestamps, type correct. Rename correlation where platform-deterministic.

**FT-003: Per-root ordering and delivery**
- Steps: Multiple changes in sequence on same root.
- Expected: Events delivered in order (within root) where platform guarantees allow. No reordering across unrelated roots.

**FT-004: Workspace/project activation changes**
- Steps: Activate workspace/project (adds watches) → deactivate/switch.
- Expected: Watches added/removed cleanly for new roots only. No leaks of old roots.

**FT-005: Overflow handling**
- Steps: Generate platform overflow condition (large tree + burst).
- Expected: `watcher:overflow@1.0` (or equivalent) emitted. Policy respected (backpressure or drop owned by appropriate layer).

## 4. Edge Cases and Error Conditions

- Rename across roots or outside watched trees.
- Rapid create/delete (touch).
- Platform-specific quirks (case, unicode, inode vs path).
- Watch on very deep/large trees (resource limits).
- Subscribe/unsubscribe races.
- Events after unsubscribe (must not deliver).

## 5. Performance & Resource Benchmarks

- Event latency (change on disk → event to subscriber): low 10s of ms P95 under moderate load.
- Resource usage bounded (fds, CPU, memory) even on large projects.
- Debounce / batching where specified without losing correctness.

## 6. Security, Boundary & IPC Checks

- **Never bypasses 011.** Every subscription root must have passed 011 validation.
- All events carry only validated paths + scope.
- Uses canonical contract names per 013 naming convention: e.g. `watcher:subscribe@1.0`, `watcher:change@1.0`.
- Capability + schema validation before dispatch (013 ordering).
- No raw FS access in watcher code.

Explicit verification: supply unvalidated root to subscribe → rejected. Inspect all emitted events.

## 7. Resilience, Lifecycle & Shutdown (incl. 013 Failure Matrix)

- 011 or IPC unavailable → deterministic errors, no partial watches.
- Version mismatch on contracts → reject.
- Timeout on subscribe → standard envelope.
- Shutdown during active watches → graceful drain, unsubscribe all, no leaks.
- High-volume event storm → backpressure signals or drop policy applied.
- Platform watcher crash/recovery → re-establish on validated roots only.

## 8. Observability

- CorrelationId on events where originating request had one.
- Structured logs for subscribe/unsubscribe, events (sanitized), overflow, duration where measurable.
- Resource metrics for long-running watches.

## 9. Integration Scenarios

- 009/010 activate → 011 validate roots → 012 subscribe → real FS change (via 011) → normalized event via 013 → indexer (102)/context (101) reaction.
- Project switch → old watches torn down, new established.
- Overflow during ingestion → consumers reconcile without data loss where policy specifies.

## 10. Definition of Done Verification Checklist

- [ ] Zero watches or events on unvalidated paths.
- [ ] All change types + rename semantics work.
- [ ] Ordering and overflow correct.
- [ ] Lifecycle with 009/010/011/013 correct.
- [ ] Contract naming (@1.0), capability/schema ordering, error envelopes per 013.
- [ ] Perf + resource targets.
- [ ] Layer 2 AC + Constitution DoD.
- [ ] Full E2E from disk change to consumer (mocked or real).
