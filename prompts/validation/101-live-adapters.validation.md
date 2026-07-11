# 101 — Live Adapters Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/101-context-engine.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-11  
**Module Maturity Alignment:** Layer 2 Ready (B.1 ports-first orchestrator) — B.2 **live adapter slice** verification gates defined here for independent freeze  
**Authorization short name:** Live Adapters / `101-adapters` (Module 101 B.2 slice)  
**Checkpoint baseline:** `phase-b2-102-complete` / Modules 103 + 104 + 105 + 102 frozen; 101 B.1 frozen at `phase-b-101-complete` (consume ports only; do not re-open B.1 core)  
**Sequencing:** D1 fifth target per `docs/phase-b2-sequencing-decision.md` — **Phase B.2 live adapter integration only**  
**Derived from:** `prompts/validation/102-index-builder.validation.md` (structure + section order) + 101 B.1 port contracts

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module **101 Live Adapters** Phase B.2 **slice**. Validates **live (or quasi-live) port implementations** that satisfy frozen B.1 `GraphQueryPort` / optional `SemanticSearchPort` / optional `SummaryPort` contracts using the **published in-process D1 foundation** (102 Index Builder symbol registry + 105 Dependency Graph edge queries + 103/104 via prior indexing), under `@ray-studio/ingestion` (`src/adapters/**`), **without**:

- Re-opening or rewriting the frozen 101 B.1 orchestrator (`ContextEngine`, Null/Fake ports, builders, compressors, retrievers)
- Memory Engine (**201**) durable graph storage
- True embedding / vector semantic search (future 107/108-class)
- Gateway, Providers (**301**), MCP product surface
- Core Platform source changes
- Rewrites of frozen `parser/**`, `extractor/**`, `dependency/**`, or `incremental/**`

## 2. References

- Layer 2: `prompts/modules/101-context-engine.md` (full — especially §7–§9 ports, §21–§22 B.1 DoD, Phase B sequencing note: live adapters deferred)
- B.1 Layer 4 (frozen baseline, do not regress): `prompts/validation/101-context-engine.validation.md`
- Manifest: `implementation-manifests/101-live-adapters.json`
- Upstream frozen: 102/103/104/105 public package APIs + `packages/core/src/context/types.ts` port interfaces (read-only)
- Constitution §3, §4 (token-efficient retrieval), §5 (monorepo / dependency direction), §9
- Sequencing: `docs/phase-b2-sequencing-decision.md` (D1) — live adapters **after** 102; 201 remains later
- Accepted debt: **R1** (Module 105 `keysByFile` multi-file ownership) — history/105.md + history/102.md
- Do **not** require: 201, 301, gateway package, Graphiti/Neo4j clients, embedding providers

### Contract note (no Layer 2 rewrite required)

- **B.1 remains frozen:** Layer 2 Ready B.1 delivered ports + Null/Fake + `ContextEngine`. Live adapters were **explicitly out of B.1 ownership** (`mode: 'live'` reserved; “wired later without changing `ContextEngine` public API”).
- **B.2 slice vs full future live stack:** Full product live retrieval may later include Memory-backed graph (201), embeddings, and architecture summaries. D1 sequences a **Phase B.2 slice** that freezes **in-process** adapters on published 102/103/104/105 without 201.
- **B.2 default required surface:**
  - **Required:** At least one `GraphQueryPort` implementation with `mode: 'live'` that searches an injectable in-process symbol source populated by 102 (`SymbolRegistry` / equivalent SymbolRecord map) and maps results to B.1 `SymbolContext` shape (`id`, `name`, `path?`, `kind?`, `snippet?`, `score`).
  - **Required for merge:** Deterministic keyword / token ranking over symbol name, qualifiedName, path, and optional signature/docstring fields (no network, no embeddings).
  - **Required for merge:** Graceful empty results when the registry is empty (no throw); `mode === 'live'` even when empty.
  - **Optional for merge (recommended):** Expand or re-rank using 105 `getDirectDependencies` / `getDirectDependents` when a graph instance is injected; document expansion policy.
  - **Optional for merge:** `SemanticSearchPort` with `mode: 'live'` implemented as **lexical** over the same registry, labeled with a `ponytail:` note that true embedding semantic search is deferred — **or** leave semantic as host-supplied Null/Fake (not implemented in this slice) with explicit B.2 documentation.
  - **Optional for merge:** Thin `SummaryPort` with `mode: 'live'` producing inventory-style summaries from indexed paths/module ids — **or** Null/Fake host-supplied. True architecture-summary engine deferred.
  - **Required for merge:** Public factory(ies) under `packages/ingestion/src/adapters/**` exported from package entry (or documented subpath), e.g. `createLiveGraphQueryPort(…)` (name flexible if documented).
  - **Optional for merge:** Integration assertion that `createContextEngine` (from frozen `@ray-studio/core`) with the live graph port returns non-empty `layers.symbols` and `portsUsed.graph === 'live'` against a pre-indexed fixture — preferred but may live as ingestion-side structural test + separate type-check if package boundary forbids core import; document choice.
  - **Deferred:** 201 Memory upserts, durable graph DB, embedding providers, MCP tools, product File Watcher host, Gateway wiring, model-accurate token estimators, `<400ms` live P95 as hard gate, rewrites of 101 B.1 ranking/budget logic.
- **Dependency direction (Constitution §3 / §5):** `@ray-studio/core` must **not** gain a runtime dependency on `@ray-studio/ingestion`. Adapters live in ingestion (or host composition) and implement core port shapes (structural typing and/or optional type-only / workspace dependency on core). Do not invert ownership.
- **R1 interaction:** 105 edge ownership may be coarse. Live graph expansion via 105 must not claim finer single-file edge truth than B.2 provides; document expansion scope. Do not rewrite 105.
- **Forbidden writes:** All paths under `packages/core/src/context/{engine,ports,builders,compressors,retrievers,errors}.**` and frozen 102–105 ownership trees (see manifest `forbidden` / `allowedWritePaths`).

## 3. Functional Test Cases

**FT-001: Live graph port over pre-indexed symbols (happy path)**
- Preconditions: 102 indexer (or equivalent SymbolRegistry fixture) has ≥1 TypeScript symbol from a known fixture file (e.g. `util.ts` export).
- Steps: Construct live `GraphQueryPort`; `search({ intent: "<symbol-name-token>", limit: 10 })`.
- Expected: `mode === 'live'`; ≥1 `SymbolContext` with matching name/id; `score` in a documented range; no throw; no 201.

**FT-002: Intent maps to path / qualifiedName tokens**
- Preconditions: Registry contains a symbol with distinctive path segment and name.
- Steps: Search with intent containing path segment or qualifiedName fragment.
- Expected: Relevant symbol present in top results within `limit`; determinism of ranking for fixed registry + intent.

**FT-003: Empty registry degrades cleanly**
- Preconditions: Empty SymbolRegistry / no indexed files.
- Steps: `search` with any intent.
- Expected: Resolves to `[]`; `mode === 'live'`; no throw.

**FT-004: Limit honored**
- Preconditions: Registry has more matching symbols than `limit`.
- Steps: `search({ intent, limit: N })`.
- Expected: Result length ≤ N; stable order (documented comparator / score then id).

**FT-005: Optional 105 expansion (if implemented)**
- Preconditions: Multi-file fixture indexed with dependsOn/calls edges applied in-process; graph injected into adapter.
- Steps: Search for a leaf symbol; or query policy that expands dependents.
- Expected: Documented expansion includes related ids/paths when policy says so; if expansion not implemented, document skip and FT-001–004 remain green.

**FT-006: Structural / type compatibility with B.1 GraphQueryPort**
- Steps: Assign live port to a variable typed as `GraphQueryPort` (from core types) **or** assert structural fields: `mode` + `search` signature.
- Expected: Compiles or runtime shape check passes; `portsUsed.graph` can be `'live'` when wired into `ContextEngine` (if integration test present).

**FT-007: Optional live semantic lexical port (if implemented)**
- Preconditions: Same registry as FT-001.
- Steps: `SemanticSearchPort.search` with keyword intent.
- Expected: `mode === 'live'`; results from registry; ponytail documents non-embedding nature. If not implemented: document B.2 deferral; Null/Fake host path remains valid.

**FT-008: Optional live summary port (if implemented)**
- Steps: `getSummaries({ intent, targetModule? })`.
- Expected: `mode === 'live'`; zero or more summaries with id/title/body/score; no network. If not implemented: document deferral.

**FT-009: Does not own 101 B.1 / 102–105 implementations**
- Steps: Inspection + tests: adapters construct/search over injected registry/graph or call published 102/105 surfaces; do not reimplement tree-sitter, query `.scm`, dependency resolvers, or ContextEngine ranking.
- Expected: Diff confined to `packages/ingestion/src/adapters/**` (+ package public export wiring only); no edits under forbidden paths.

**FT-010: End-to-end index → live graph → (optional) buildContext**
- Preconditions: Fixture sources reindexed via 102; live graph port created from resulting registry (+ optional graph).
- Steps (minimum): Live graph `search` returns symbols from that index.
- Steps (preferred): `createContextEngine({ graph: live, semantic: Null|Fake, summaries: Null|Fake, tokens: Heuristic })` + `buildContext` with sufficient `maxTokens` → `layers.symbols` non-empty and `portsUsed.graph === 'live'` (Constitution path optional for this FT).
- Expected: Minimum path required; preferred path preferred for merge confidence. Document package-boundary approach if core import is test-only.

## 4. Edge Cases and Error Conditions

- Unknown / nonsense intent → empty or low-score empty set; no throw.
- `limit <= 0` → treat as 0 results or validation error (document); no hang.
- Concurrent `search` calls → isolated results; no shared mutable corruption of registry (adapters must not mutate registry during search unless documented copy-on-write).
- Symbol without path → still searchable by name/id; `path` optional on SymbolContext.
- R1 coarse edge ownership → expansion results may be wider than ideal; must match documented policy; must not assert finer ownership than 105 B.2.
- Injected graph missing while expansion requested → skip expansion; keyword results still work.
- Extremely large registry (optional stress) → completes or fails with clear policy; document; hard stress optional for B.2.

## 5. Performance Benchmarks & Measurement (B.2)

| Metric | Gate | Method |
|--------|------|--------|
| Live graph `search` P95 over small fixture registry (≤200 symbols) | Prefer &lt; 20ms | Timed loop n≥50 in Vitest |
| Live graph `search` does not re-parse / re-extract | Required | No 103/104 calls inside search hot path |
| Full `buildContext` with live graph (if tested) | Prefer &lt; 100ms Fake-governance + live graph small set; live P95 &lt; 400ms remains aspirational (Layer 2 future) | Timed optional |
| Determinism | Required for fixed registry + intent | FT-002 / FT-004 |

Hardware variance: document machine. Hard merge gate: correct results + no hang + no 103/104 in search path; meet &lt; 20ms search on small fixtures unless owner waiver.

## 6. Security, Boundary & Ownership Checks

- [ ] No production edits under `packages/core/src/context/{engine,ports,builders,compressors,retrievers}/**` or other frozen B.1 core files listed in manifest `forbidden`.
- [ ] No production code under `packages/core/src/{db,ipc,fs,watcher,project,workspace}/**`.
- [ ] No rewrite of `packages/ingestion/src/{parser,extractor,dependency,incremental}/**` except separate defect auth.
- [ ] No `apps/studio/**` required for B.2 merge (prefer zero).
- [ ] No 016 migrations or durable graph tables as 201 substitute.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O in live adapters.
- [ ] No `eval` / child_process / dynamic execution of user source as code.
- [ ] No 201 / 301 implementations in the same change set.
- [ ] `@ray-studio/core` does not gain runtime dependency on `@ray-studio/ingestion`.
- [ ] If IPC / MCP added (`context:*` product expansion): **fail validation** for this B.2 slice unless separate auth reopened B.1 optional IPC (out of slice default).
- [ ] No embedding provider calls.
- [ ] Secrets never logged; snippets truncated in debug logs if logged.

## 7. Package & API Contract Checks

- [ ] Work remains primarily in `@ray-studio/ingestion` under `src/adapters/**` with build/lint/test scripts green.
- [ ] Live port factory(ies) exported from package public entry **or** documented subpath — importable by tests without private path hacks.
- [ ] Live `GraphQueryPort` exposes `mode: 'live'` and `search(query: { intent: string; limit: number })`.
- [ ] Result items are structurally compatible with B.1 `SymbolContext`.
- [ ] Adapters accept injected registry/graph (dependency inversion) — do not hardcode a process-global singleton as the only path.
- [ ] Optional semantic/summary live ports, if present, follow the same DI + `mode: 'live'` pattern.
- [ ] Folder layout: `packages/ingestion/src/adapters/**` (names flexible: `live-graph-port.ts`, `index.ts`, tests) unless ponytail-documented equivalent under the allowed write root.
- [ ] Package description / exports updated only as needed for adapters; no silent export of private 103/104 internals.

## 8. Observability

- [ ] Search path may log debug counts (hits, limit, duration) without dumping full registry.
- [ ] No secret material in logs.
- [ ] If wired into `ContextEngine`, existing B.1 provenance / `portsUsed` fields remain the assembly observability surface (do not fork engine logging).

## 9. Integration Scenarios (consumer-only)

**Required for merge:**
- Unit/fixture: index (or hand-build SymbolRegistry) → live graph `search` → assert SymbolContext fields.
- Empty registry path.
- Limit + determinism.

**Optional (not required for merge):**
- Preferred: `createContextEngine` + live graph + Null/Fake semantic/summary → `buildContext` symbols from real index.
- Host script: reindex a monorepo file pair, print live search hits.
- Live lexical semantic port side-by-side with graph.

**Forbidden integration tests for B.2 (as required paths):**
- Writing entities to Memory Engine (201).
- Provider / Gateway / embedding API calls.
- Production MCP server registration.
- Mutations of frozen 101 B.1 orchestrator behavior.

## 10. Cross-Module Regression (frozen platform)

After 101-adapters implementation, re-run:

- `@ray-studio/ingestion` **103** parser tests — **must remain green**.
- `@ray-studio/ingestion` **104** extractor tests — **must remain green**.
- `@ray-studio/ingestion` **105** dependency tests — **must remain green**.
- `@ray-studio/ingestion` **102** incremental tests — **must remain green**.
- `@ray-studio/core` test suite (including **101 B.1** context tests) — **must remain green** (no B.1 source edits expected).
- Diff must not include forbidden frozen paths (101 B.1 core files, `parser/**` / `extractor/**` / `dependency/**` / `incremental/**` ownership rewrites, `apps/studio/**`, 201/301 sources).

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-004, FT-006, FT-009 pass; FT-005/007/008/010 pass or explicit documented B.2 skip with rationale.
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.2 performance gates met (§5) or measured + owner waiver (default: small-fixture search budget).
- [ ] Boundary checks (§6) verified on implementation PR diff.
- [ ] Package & API checks (§7) present.
- [ ] Layer 2 B.1 deferred “live adapters” note satisfied without breaking B.1 AC/DoD.
- [ ] B.2 independent freeze: no hard runtime dependency on 201, 301, or embedding providers.
- [ ] **R1** policy respected; no silent rewrite of 105 ownership inside adapters.
- [ ] Manifest `forbidden` / `allowedWritePaths` respected.
- [ ] No 201/301/Gateway/embedding deliverables in the same change set.
- [ ] Constitution §4 / §9 and `pnpm constitution:check` pass when implementation is authorized and complete.
- [ ] No TODOs left in adapter production paths.

## 12. Sign-off

**B.2 validation is the merge gate for Module 101 Live Adapters Phase B.2 slice only.**  
Passing this spec **does not** authorize 201, 301, Gateway, or production implementation until implementation is **separately authorized**. This Layer 4 document is a **verification package** for use **after** implementation exists; creating it does not start coding.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests (after impl auth) |
| Architecture review | Adapters under `ingestion/src/adapters/**`; 101 B.1 + 102–105 consume-only; core must not depend on ingestion |
| Merge readiness | Diff scoped to `packages/ingestion/src/adapters/**` (+ public export wiring only) |

**End of 101 Live Adapters Layer 4 (B.2 slice).**
