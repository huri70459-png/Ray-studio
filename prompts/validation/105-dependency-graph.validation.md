# 105 — Dependency Graph Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/105-dependency-graph.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-11  
**Module Maturity Alignment:** Layer 2 Draft file present — B.2 **slice** verification gates defined here for independent freeze  
**Checkpoint baseline:** `phase-b2-104-complete` / Modules 103 + 104 frozen (consume only; do not modify)  
**Sequencing:** D1 third target per `docs/phase-b2-sequencing-decision.md` — **Phase B.2 Dependency Graph slice only**  
**Derived from:** `prompts/validation/104-symbol-extractor.validation.md` (structure + section order)

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module 105 Phase B.2 **slice**. Validates the **dependency / relationship analyzer** under `@ray-studio/ingestion` (`src/dependency/**`): import/module resolution, call-site edges, relationship model + delta computation, determinism, and package boundaries **without** requiring Memory Engine (201), Incremental Indexer (102), live 101 adapters, Gateway, Providers, or Core Platform source changes.

## 2. References

- Layer 2: `prompts/modules/105-dependency-graph.md` (full — especially Scope, Non-Goals, AC §21)
- Manifest: `implementation-manifests/105-dependency-graph.json`
- Upstream frozen: `prompts/modules/103-tree-sitter-parser.md`, `prompts/modules/104-symbol-extractor.md` + public package APIs
- Constitution §3, §4 (graph edges / token-efficient retrieval foundations), §5, §9
- Monorepo: `docs/003-monorepo-architecture.md` (`packages/ingestion`)
- Frozen modules: 001, 009–013, 016, 101 B.1, **103**, **104** (do not modify)
- Sequencing: `docs/phase-b2-sequencing-decision.md` (D1) — 105 constrained to **B.2 slice**; full-spec 201 hard-dep deferred
- Do **not** require: 102, 201, 301, gateway package, live graph persistence

### Contract note (no Layer 2 edit required)

- **B.2 slice vs full Draft:** Draft §19 lists hard dependency on Memory Engine (201) for storage/query. D1 explicitly sequences only a **Phase B.2 slice** without full-spec 201. B.2 default:
  - **Required:** `computeDelta` (and pure relationship model) from 104 `Symbol[]` + source map (+ optional 103 trees for call/import queries).
  - **Required for merge:** in-process apply/query surface sufficient for unit/golden tests (e.g. memory-backed edge store or pure delta assertions) — **not** 201 production graph storage.
  - **Deferred:** Draft `applyDelta` → Memory Engine upserts; MCP tool surface; durable graph tables; live 101 graph-retriever wiring.
- Consume **104 ingestion-local `Symbol`** (and extract results) rather than inventing a parallel symbol type. Draft “Core types” are optional read-only alignment only — **no** `packages/core/**` edits.
- Consume **103** only for optional Tree-sitter queries / import or call-node walks; do not re-own `parser/**` or grammar registry.
- Draft §22 / integration language about 102 and 101 is **deferred** for B.2 merge: freeze 105 independently testable on 103+104 fixtures; document consumer hooks only.
- Draft folder layout §8 (`dependency/`, resolvers, import-resolver, call-analyzer, relationship-model, delta-calculator) is the target unless ponytail-documented equivalent under `src/dependency/**`.

## 3. Functional Test Cases

**FT-001: File-level dependsOn from imports (TypeScript)**
- Preconditions: Multi-file fixture: `service.ts` imports a symbol from `util.ts`; 103 parse + 104 extract for both (or hand-built `Symbol[]` + sources matching extract shape).
- Steps: `computeDelta({ changedSymbols, sourceByPath, projectId })` (or factory equivalent).
- Expected: `RelationshipDelta.upserts` includes at least one `dependsOn` (or equivalent type) from service → util (file or symbol level per documented policy); stable edge keys; no throw.

**FT-002: calls edges for same-file and cross-file calls**
- Preconditions: Fixture where a function in file A calls a function in file B (or same-file callee with distinct symbols).
- Steps: Compute delta from symbols + sources (and trees if required by API).
- Expected: ≥1 `calls` relationship from caller → callee with optional location metadata; names/ids resolve to documented symbol or file ids.

**FT-003: JavaScript and Python import/dependency path**
- Steps: Compute deltas for small JS and Python multi-file (or multi-module) fixtures with explicit language paths.
- Expected: Both produce ≥1 structural relationship of documented type (`dependsOn` and/or `calls`); no throw.

**FT-004: Unresolvable import skipped**
- Preconditions: Source imports a specifier that cannot be resolved within the fixture map.
- Steps: Compute delta.
- Expected: Unresolvable import logged at WARN (or testable skip path); **no** process crash; batch continues; no fabricated “unknown” node unless diagnostic mode is documented and off by default (Layer 2 §15).

**FT-005: Incremental / minimal delta on leaf edit**
- Preconditions: Prior delta applied in-process (memory store) for a two-file graph; edit only a leaf utility body (or re-provide changed symbols for that file only).
- Steps: Recompute delta for the changed set.
- Expected: Upserts/deletes limited to edges involving the changed file/symbols (or documented full recompute-for-file policy that still yields correct net graph); impact-style query on callers still correct after apply.

**FT-006: getDirectDependents / getDirectDependencies**
- Preconditions: Edges applied in-process after FT-001/002 style fixture.
- Steps: Query direct dependencies of service and direct dependents of util.
- Expected: Symmetric membership matches upserted edges; empty array (not throw) for unknown ids.

**FT-007: Determinism**
- Steps: Same symbols + sources (+ trees) run through `computeDelta` twice.
- Expected: Equal multiset of relationships for stable fields (`type`, `from`, `to`); edge keys stable; order stable or sorted by documented comparator.

**FT-008: Partial / missing symbols tolerance**
- Preconditions: Incomplete symbol list for a file that still has import text, or symbols without matching source path entry.
- Steps: Compute delta.
- Expected: No crash; partial edges or empty upserts with documented policy; batch-safe.

**FT-009: Relationship types spot check**
- Steps: Fixtures covering at least `dependsOn` and `calls`. Optional: `implements` / `inherits` / `exports` if cheap for B.2 languages.
- Expected: Required types for B.2 documented and tested; missing advanced types listed as explicit deferred with owner note only if not in B.2 required set.

**FT-010: Does not own 103/104 implementations**
- Steps: Inspection + tests: dependency module consumes 104 `Symbol` / extract and optionally 103 `SyntaxTree`/`query`; does not construct a second grammar registry under `dependency/**`.
- Expected: No rewrite of `parser/**` or `extractor/**`; public factory lives under `dependency/**` (or package export wiring only).

## 4. Edge Cases and Error Conditions

- Empty `changedSymbols` / empty `sourceByPath` → empty delta (or documented no-op); no throw.
- Cycle in dependsOn/calls → detect opportunistically; log; do not block (Layer 2 §15).
- Duplicate upserts with same stable key → idempotent net graph after apply.
- Concurrent `computeDelta` on separate inputs → both succeed without shared mutable corruption.
- Source/symbol path mismatch → skip or structured warning; no crash.
- Extremely large single-file source (optional stress) → completes or fails with clear code; no hang without timeout policy (B.2: document; hard stress optional).

## 5. Performance Benchmarks & Measurement (B.2)

| Metric | Gate | Method |
|--------|------|--------|
| File-level dependency delta (typical changed file, after symbols available) | P95 &lt; 20ms (Layer 2 §6); prefer &lt; 15ms P95 (Layer 2 §18) | Timed loop n≥30 in Vitest; exclude parse/extract time |
| Direct dependents query (in-process store, small fixture) | &lt; 30ms (Layer 2 §18) or document B.2 in-memory equivalent | Timed loop |
| Memory | No unbounded retention of full parse trees / large source buffers after processing | Document disposal policy |
| Determinism | Required for golden fixtures | FT-007 |

Hardware variance: document machine; hard gate is the file-level delta budget unless owner waiver. Full-project impact depth-3 &lt; 80ms is **aspirational** for B.2; document measured, do not block merge if small-fixture gates pass.

## 6. Security, Boundary & Ownership Checks

- [ ] No production code under `packages/core/src/**` modified by 105 PR (including `context/**`).
- [ ] No `apps/studio/**` required for B.2 merge (prefer zero).
- [ ] No 016 migrations or durable graph tables introduced as 201 substitute without separate auth.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O during analysis.
- [ ] No `eval` / child_process / dynamic execution of user source as code.
- [ ] No 102 / 201 / 301 module implementations in the same change set.
- [ ] No 101 B.1 source modifications.
- [ ] No rewrite of `packages/ingestion/src/parser/**` (103) or `packages/ingestion/src/extractor/**` (104) except separate defect auth.
- [ ] If any IPC added (`dependency:*` or similar): **fail validation** for B.2 unless separate auth reopened scope (Layer 2 §12: primarily internal).
- [ ] No Memory Engine client / live 201 graph required for merge.
- [ ] Observe ignore/exclusion policy only when reading paths (if any path reads); static analysis only.

## 7. Package & API Contract Checks

- [ ] Work remains in `@ray-studio/ingestion` with build/lint/test scripts green.
- [ ] `DependencyGraph` (or factory + interface) exported from package public entry **or** documented subpath — importable by tests without private path hacks.
- [ ] Types for `Relationship`, `RelationshipDelta`, and query result shapes (`SymbolRef` or equivalent) exported or co-located and imported by tests.
- [ ] `computeDelta` accepts 104-compatible `Symbol[]` + `sourceByPath` + `projectId` (or documented thin adapter).
- [ ] In-process apply and/or pure delta assertion path exists for B.2 without 201.
- [ ] At least `getDirectDependencies` and `getDirectDependents` (or equivalent) work against the B.2 store after apply.
- [ ] Folder layout aligns with Layer 2 §8 (`dependency/`, resolvers, import/call analyzers, relationship-model, delta) unless ponytail-documented equivalent.
- [ ] Languages for B.2: typescript, tsx, javascript, jsx, python — subset OK only with explicit B.2 slice table in PR notes matching owner waiver.

## 8. Observability

- [ ] Delta path exposes duration and upsert/delete counts (return metrics, structured log, or testable counters).
- [ ] Unresolvable-import and skip paths log at warning/debug without dumping full source at default level.
- [ ] Event names `dependency:delta-computed` / `dependency:edges-upserted` (Layer 2 §13) are optional for B.2 if metrics/log cover counts; if emitted, in-process only (no 013 channel).

## 9. Integration Scenarios (consumer-only)

**Required for merge:**
- Unit/fixture tests: 103 parse → 104 extract → 105 `computeDelta` → assert golden relationship lists / edge keys.
- Optional second step: in-process apply → direct dependents/dependencies queries.

**Optional (not required for merge):**
- Host script: parse/extract a real monorepo pair of files, print edge counts.
- `traceCallPath` / `getImpactSet` if implemented in B.2; otherwise document deferred with fixture-only dependsOn/calls.

**Forbidden integration tests for B.2:**
- Writing edges to Memory Engine (201) as required path.
- Driving Incremental Indexer (102) as required path.
- Live 101 `buildContext` graph ports as required path.
- Provider / Gateway calls.

## 10. Cross-Module Regression (frozen platform)

After 105 implementation, re-run:

- `@ray-studio/ingestion` **103** parser tests — **must remain green**.
- `@ray-studio/ingestion` **104** extractor tests — **must remain green**.
- `@ray-studio/core` test suite — **must remain green** (no core edits expected).
- Diff must not include forbidden frozen paths (`packages/core/**`, `apps/studio/**`, 102/201/301 sources).

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-010 pass.
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.2 performance gates met (§5) or measured + owner waiver (default: must meet file-level delta budget).
- [ ] Boundary checks (§6) verified on implementation PR diff.
- [ ] Package & API checks (§7) present.
- [ ] Layer 2 Acceptance Criteria §21 true for B.2 fixtures where in-scope (`dependsOn` + `calls` on small service/utility; impact via direct dependents).
- [ ] Layer 2 Non-Goals §4 respected (no dynamic call graph, no full type inference, no UI, no node_modules crawl beyond import text).
- [ ] B.2 independent freeze: no hard runtime dependency on 201, 102, or 101 live adapters.
- [ ] Manifest `forbidden` / `allowedWritePaths` respected.
- [ ] No 102/201/301/Gateway deliverables in the same change set.
- [ ] Constitution §4 / §9 and `pnpm constitution:check` pass when implementation is authorized and complete.
- [ ] No TODOs left in dependency production paths.

## 12. Sign-off

**B.2 validation is the merge gate for Module 105 Phase B.2 slice only.**  
Passing this spec **does not** authorize 102, 201, 301, Gateway, or production implementation until implementation is **separately authorized**. This Layer 4 document is a **verification package** for use **after** implementation exists; creating it does not start coding.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests (after impl auth) |
| Architecture review | Dependency ownership under `ingestion/src/dependency/**`, 103/104 consume-only, no Core/201/102 ownership |
| Merge readiness | Diff scoped to `packages/ingestion/src/dependency/**` (+ public export wiring only) |
