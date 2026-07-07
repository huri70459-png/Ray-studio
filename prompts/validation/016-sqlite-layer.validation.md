# 016 — SQLite Layer Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/016-sqlite-layer.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Objective criteria for the local relational metadata store. Complements the graph; provides durable, transactional, scoped operational state. All access must be via IPC.

## 2. References

- Layer 2: 016-sqlite-layer.md (schema ownership, scoping, migrations, IPC-only, boundaries with 006)
- 013 IPC Framework (contracts using `<namespace>:<operation>@<major>.<minor>`, capability ordering, failure matrix, error envelope, naming)
- 009 Workspace Manager, 010 Project Manager, 011 File System Service (path validation for DB file)
- Constitution local-first, durability, security
- Other Phase A validations, especially 013.validation.md

## 3. Functional Test Cases

**FT-001: Boot + automatic safe migrations**
- Preconditions: No DB or older schema.
- Steps: Boot → open connection.
- Expected: Migrations run forward-only, transactional, idempotent. DB reaches current schema version. No data loss.

**FT-002: CRUD via IPC contracts for core entities**
- Contracts exercised (using canonical naming): `db:project:*@1.0`, `db:ingestion:*@1.0`, `db:config:*@1.0`, `db:workspace:*@1.0`
- Steps: Create/read/update project metadata, status, config key/values.
- Expected: Correct results, transactional, visible only within active scope.

**FT-003: Strict scoping**
- Preconditions: Multiple workspaces/projects.
- Steps: Write under project A → attempt read from project B context.
- Expected: Never leaks data across scopes. All ops respect 009/010 + 011 validated boundaries.

**FT-004: Fast lookups**
- Steps: Get by natural key (project id, status, config key).
- Expected: < 5-10ms typical for simple ops.

## 4. Edge Cases and Error Conditions

- Schema version mismatch on open → explicit error (migration required or incompatible).
- DB locked / busy → retryable error; consumer controls backoff.
- Corruption detected → specific `DB_CORRUPT` or equivalent, no silent repair in hot path.
- Concurrent transactions.
- Abrupt shutdown mid-transaction (WAL) → on reopen, committed txns present, no partial state.
- Very large config blobs (should be rejected or bounded; only metadata).

## 5. Performance Benchmarks & Measurement

- Simple key lookup / status update: < 5ms P95.
- Small list (tens of projects): < 15ms.
- Migration on first run: acceptable one-time cost (logged).
- Connection acquisition negligible.

**Verification:** In-memory SQLite for unit + file-backed for integration/perf. Micro-benchmarks.

## 6. Security, Boundary & IPC Checks

- **All access exclusively through 013 IPC contracts** (no direct require of sqlite in renderer or unprivileged code).
- DB file placed only in 011-validated location or secure app data dir.
- Capability checks (Database / ProjectMetadata) before schema validation before handler (013 ordering).
- Prepared statements / parameterized only. No arbitrary SQL.
- Namespace `db:*` permanently owned by this module.
- Contracts follow `<namespace>:<operation>@1.0` (e.g. `db:project:get@1.0`).

## 7. Resilience, Lifecycle & Shutdown + Failure Matrix

- Follows 013 lifecycle participation (register contracts, etc.).
- Full 013 failure matrix cases exercised through this layer.
- WAL + busy timeout keep UI responsive.
- Survives abrupt shutdowns for committed work.
- Clear errors for locked, corrupt, schema mismatch, constraint violation, not found.
- Graceful close + optional checkpoint on shutdown.

## 8. Observability

- Structured logs: open/close, migration runs (version), slow queries, errors + correlationId.
- No full sensitive config values logged.
- Duration on IPC paths.

## 9. Integration Scenarios

- 001/009/010 → activate workspace/project → 011 validates DB path → 016 open/migrate → read/write metadata and status via 013 contracts.
- Ingestion updates status → shell surfaces reflect.
- Config changes persist across restarts, scoped.
- Shutdown/restart with in-flight work → durability verified.

Cross-check with 013: capability/schema/dispatch ordering, error envelopes, naming convention, namespace governance.

## 10. Definition of Done Verification Checklist

- [ ] All access via versioned IPC contracts only.
- [ ] Migrations safe, automatic, versioned.
- [ ] Strict scoping via 009/010/011.
- [ ] Never stores raw file content or graph entities (per 006).
- [ ] Perf targets met.
- [ ] Durability under normal + abrupt shutdown.
- [ ] 013 naming (`@1.0`), namespace ownership, validation ordering, failure matrix aligned and verified.
- [ ] Error categories mapped to standard envelope.
- [ ] Layer 2 AC + Constitution DoD (esp. local-first, boundaries).
- [ ] Lifecycle + integration with other Phase A modules green.

**Note:** This completes the Layer 4 validation set for Phase A Core Platform.
