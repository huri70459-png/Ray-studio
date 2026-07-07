# 011 — File System Service Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/011-file-system-service.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Detailed objective tests for the File System Service — one of the most critical trust boundaries. Must be rock-solid before any dependent implementation.

## 2. References

- Constitution security, IPC, performance, boundaries
- Layer 2: 011-file-system-service.md (FRs, path validation ownership, Perf, AC)
- 013 IPC Framework (contracts, ordering, error envelope, failure matrix)
- 009/010 managers (for roots), 012 watcher (consumer), 016 (for its file locations)
- 001.validation.md, 012.validation.md, 013.validation.md, 016.validation.md

## 3. Functional Test Cases

**FT-001: Path validation and scoping**
- Preconditions: Active workspace + project roots.
- Steps: Call validate/any op with in-scope, out-of-scope, traversal (../), absolute outside, symlink, etc.
- Expected: Only canonical in-scope paths accepted. Out-of-scope/traversal rejected with clear categorized error before any FS action.

**FT-002: Read / write / list / metadata for valid paths**
- Preconditions: Valid scoped file/dir.
- Steps: readFile, writeFile, listDirectory, getMetadata.
- Expected: Correct results, proper encoding, metadata accurate. Writes are durable.

**FT-003: Errors are safe and categorized**
- Steps: Trigger access denied, not found, invalid, etc. (both real FS and simulated).
- Expected: Standard IPC error envelope (category, code, sanitized message, correlationId, retryable). No internal paths, stack traces, or secrets.

**FT-004: Operations reflect current manager roots**
- Steps: Switch workspace/project → perform FS op relative to old vs new root.
- Expected: Immediately uses current validated roots from 009/010.

## 4. Edge Cases and Error Conditions

- Very long paths, unicode, case sensitivity differences across platforms.
- Concurrent ops on same path.
- Symlinks inside/outside scope (must not escape).
- FS becomes read-only or full mid-op.
- Large directory listings (pagination or bounded where appropriate).
- Binary vs text files.

## 5. Performance Benchmarks & Measurement

- Path validation: < 5ms.
- Simple read/write/list metadata on small files: low single-digit ms P95.
- Under load (many concurrent from watcher/ingestion).

**Verification:** Real FS (temp dirs) + benchmarks in CI. Fail on target breach.

## 6. Security, Boundary & IPC Checks (Critical)

- **Zero direct access from renderer.** All via 013 contracts.
- Capability + schema validation + dispatch ordering strictly before any privileged FS action (see 013).
- Every path crossing the boundary validated here; 012 watcher never bypasses.
- Output sanitized (no secrets, scope-limited).
- Contract version carried and compatible.

**Explicit test matrix for ordering (013):**
- Call without capability → rejected early.
- Capability ok but bad schema → schema validation fail before handler.
- Good input → handler dispatch.

Test malformed payloads, cross-scope attempts, version mismatch.

## 7. Resilience, Lifecycle & Shutdown

Apply full 013 Failure Matrix:
- Registry validation fails → startup abort (service participation).
- Consumer (IPC) unavailable → deterministic error.
- Version mismatch → reject contract.
- Timeout → standard timeout envelope.
- Event overflow (if applicable) → backpressure/drop.
- Shutdown during invoke → graceful cancellation + no partial writes where possible.

Additional:
- Underlying FS locked / unavailable → clear retryable error.
- Corruption or permission change at runtime → surfaced, no silent continue.

## 8. Observability & Provenance

- Every operation logged with correlationId, sanitized path, duration, result category.
- Validation failures and denials at warning+.
- Errors carry full envelope.

## 9. Integration Scenarios

- 009/010 provide roots → 011 validates all access for shell, watcher (012), ingestion, capture.
- Watcher detects change on validated root → event carries only 011-validated paths.
- SQLite (016) file ops go through 011.
- End-to-end: user action in 001 → IPC → 011 validation → real FS → result or event.

## 10. Definition of Done Verification Checklist

- [ ] All paths outside active scope rejected before FS touch.
- [ ] Correct results for in-scope ops.
- [ ] Safe error envelopes only.
- [ ] Perf targets met.
- [ ] 013 ordering, naming convention (<ns>:<op>@1.0), namespace ownership, contract registry participation verified.
- [ ] Failure matrix cases pass.
- [ ] No bypasses by 012 or any consumer.
- [ ] Layer 2 AC + full Constitution DoD.
- [ ] Durable writes, graceful degradation.
