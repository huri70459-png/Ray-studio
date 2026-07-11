# 102 — Index Builder Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/102-incremental-indexer.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-11  
**Module Maturity Alignment:** Layer 2 Draft file present (title: Incremental Indexer) — B.2 **slice** verification gates defined here for independent freeze  
**Authorization short name:** Index Builder (Module 102)  
**Checkpoint baseline:** `phase-b2-105-complete` / Modules 103 + 104 + 105 frozen (consume only; do not modify)  
**Sequencing:** D1 fourth target per `docs/phase-b2-sequencing-decision.md` — **Phase B.2 Index Builder slice only**  
**Derived from:** `prompts/validation/105-dependency-graph.validation.md` (structure + section order)

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module 102 Phase B.2 **slice**. Validates the **incremental index / change-coordination** surface under `@ray-studio/ingestion` (`src/incremental/**`): change classification, affected-set planning, orchestration of frozen 103→104→105, production of an `IndexDelta` (or equivalent), determinism, and package boundaries **without** requiring Memory Engine (201), live 101 adapters, Gateway, Providers, embeddings generation, MCP exposure, or Core Platform source changes.

## 2. References

- Layer 2: `prompts/modules/102-incremental-indexer.md` (full — especially Scope, Non-Goals, AC §21)
- Manifest: `implementation-manifests/102-index-builder.json`
- Upstream frozen: `prompts/modules/103-tree-sitter-parser.md`, `prompts/modules/104-symbol-extractor.md`, `prompts/modules/105-dependency-graph.md` + public package APIs
- Constitution §3, §4 (incremental / token-efficient retrieval foundations), §5, §9
- Monorepo: `docs/003-monorepo-architecture.md` (`packages/ingestion`)
- Frozen modules: 001, 009–013, 016, 101 B.1, **103**, **104**, **105** (do not modify)
- Sequencing: `docs/phase-b2-sequencing-decision.md` (D1) — 102 after 105-slice; 101 live adapters and 201 remain later
- Accepted debt: **R1** (Module 105 `keysByFile` multi-file ownership) — history/105.md
- Do **not** require: 201, 301, gateway package, live graph persistence, embedding providers

### Contract note (no Layer 2 edit required)

- **B.2 slice vs full Draft:** Draft §11–§12, §19, and §22 cite graph storage (201), embeddings, MCP force-reindex, Core graph client, and full Context Engine integration. D1 sequences a **Phase B.2 slice** that freezes the indexer **coordinator** on published 103/104/105 without full-spec 201. B.2 default:
  - **Required:** `reindexPath` (or equivalent) that, given path + source text (and project id), runs parse → extract → dependency delta coordination and returns a deterministic `IndexDelta` (entity/symbol upserts + deletes + affected paths/modules as documented).
  - **Required for merge:** in-process apply/query or pure delta assertions sufficient for unit/golden tests — **not** 201 production graph storage, **not** durable SQLite migrations as a 201 substitute.
  - **Required for merge:** single-file edit and file-delete paths that produce correct minimal (or documented-scope) deltas using 105 edge queries for dependents when available.
  - **Deferred:** production FileSystemWatcher/git bindings as hard merge deps (inject ports + fakes OK); embedding updates; MCP tools; live 101 adapter wiring; full-spec atomic graph transactions via Memory Engine.
- Layer 2 folder layout §8 (`incremental/`, indexer, change-classifier, affected-set-calculator, batch-applier, types) is the target unless ponytail-documented equivalent under `src/incremental/**`.
- Consume **103** `createTreeSitterParser` / `SyntaxTree` / language detect — do not re-own `parser/**`.
- Consume **104** `createSymbolExtractor` / `Symbol` — do not re-own `extractor/**`.
- Consume **105** `createDependencyGraph` / `computeDelta` / `applyDelta` / `getDirectDependents` (and related) — do not re-own `dependency/**`.
- Draft “Graph client (from core)” is **optional read-only alignment** only — **no** `packages/core/**` edits.
- **R1 interaction:** 105 B.2 edge store may treat multi-file `keysByFile` ownership coarsely. B.2 102 must document reindex **scope policy** (e.g. recompute edges for changed file + known neighbors, or full provided source map) and must **not** rewrite 105 to “fix” R1. Tests assert correctness under that documented policy; true single-file edge ownership remains deferred with R1.

## 3. Functional Test Cases

**FT-001: reindexPath single TypeScript file (happy path)**
- Preconditions: 103/104/105 factories available; fixture `util.ts` with ≥1 exported function; projectId set.
- Steps: `reindexPath` (or factory equivalent) with path + source.
- Expected: `IndexDelta` (or documented equivalent) includes upserts for symbols in that file; no throw; metrics/duration available; does not require 201.

**FT-002: Multi-file import chain coordination**
- Preconditions: `service.ts` imports from `util.ts`; both sources provided (or util pre-indexed in-process then service reindexed per documented API).
- Steps: Coordinate parse → extract → 105 `computeDelta` for the changed set.
- Expected: Delta / graph edges include ≥1 `dependsOn` (or equivalent) service → util; symbol upserts present for changed file(s); stable ids/keys.

**FT-003: Affected dependents planning**
- Preconditions: In-process graph has util ← service `dependsOn` or `calls` edges applied via 105.
- Steps: Reindex or plan affected set after edit to `util.ts` body (signature-stable edit preferred).
- Expected: Affected set includes util and documented dependents (service) via 105 query surface; planning completes without crash.

**FT-004: File delete produces deletes**
- Preconditions: File previously indexed in-process (symbols + edges).
- Steps: Reindex/delete path API for removed file (empty source + delete flag, or dedicated delete method if documented).
- Expected: `IndexDelta.deletes` (or equivalent) includes symbols/ids for that file; edges involving that file removed or marked deleted per documented policy; batch continues.

**FT-005: Rename / move (documented policy)**
- Preconditions: Prior path `a.ts` indexed; new path `b.ts` with same or adapted content.
- Steps: Apply rename/move via documented API (delete old + reindex new, or atomic rename helper).
- Expected: No orphan requirement beyond documented policy; new path symbols present; old path ids deleted or remapped; no process crash. Full reference-rewrite across repo is **not** required for B.2 if Layer 2 AC language exceeds slice — document B.2 policy explicitly.

**FT-006: JavaScript and Python path**
- Steps: `reindexPath` (or batch) for small JS and Python fixtures through the same coordinator.
- Expected: Both produce ≥1 symbol upsert; no throw; dependency edges when multi-file fixtures provided.

**FT-007: Partial parse / extractor tolerance**
- Preconditions: Invalid TS source that 103 still parses partially.
- Steps: Reindex that path.
- Expected: No process crash; partial symbols or empty upserts with documented policy; other files in a multi-path batch still process (batch-safe).

**FT-008: Determinism**
- Steps: Same path + source (+ projectId + optional prior state reset) reindexed twice on fresh in-process state.
- Expected: Equal multiset of stable upsert/delete fields; order stable or sorted by documented comparator.

**FT-009: Does not own 103/104/105 implementations**
- Steps: Inspection + tests: incremental module constructs/calls published factories or injected ports; does not embed a second grammar registry under `incremental/**`; does not copy extractor queries or dependency resolvers.
- Expected: No rewrite of `parser/**`, `extractor/**`, or `dependency/**`; public factory lives under `incremental/**` (or package export wiring only).

**FT-010: Debounce / rapid change resilience (unit-level)**
- Preconditions: Change queue or debouncer component (or documented no-op for pure reindexPath-only B.2 with explicit deferral of continuous watch).
- Steps: If watch/debounce implemented: fire N rapid synthetic change events for one path; if deferred: document skip and cover reindexPath only.
- Expected: Either coalesced single reindex for the path, or explicit B.2 deferral of continuous watching with reindexPath still green. Must not leave unbounded queue growth without policy.

## 4. Edge Cases and Error Conditions

- Empty source / missing file content → structured skip or empty delta; no throw that aborts the process.
- Unknown language / unsupported extension → skip with warning; batch continues.
- Parser failure on one file in a multi-file batch → other files still processed (Layer 2 §15).
- 105 unresolvable import → WARN path; no crash (inherits 105 policy).
- Concurrent `reindexPath` on distinct paths → both succeed without shared mutable corruption (or documented single-flight queue).
- Extremely large single-file source (optional stress) → completes or fails with clear code; no hang without timeout policy (B.2: document; hard stress optional).
- **R1 coarse ownership:** reindex of one file in a multi-file graph may recompute a wider edge scope than ideal — must match documented policy; must not assert finer ownership than 105 B.2 provides.

## 5. Performance Benchmarks & Measurement (B.2)

| Metric | Gate | Method |
|--------|------|--------|
| Single-file reindex planning + coordination (typical small TS, after warm parser/extractor) | P95 &lt; 100ms end-to-end preferred; Layer 2 §6 “&lt; 100ms” / §18 “&lt; 50ms for most cases” aspirational for pure planning — document split: plan vs parse/extract/graph | Timed loop n≥20 in Vitest; report component timings if composite |
| Change detection / classify only (if separate) | Prefer &lt; 20ms | Timed unit |
| Memory | No unbounded retention of full parse trees / large source buffers after batch | Document disposal policy |
| Determinism | Required for golden fixtures | FT-008 |

Hardware variance: document machine. Hard merge gate: correct deltas + no hang; meet composite P95 &lt; 100ms on small fixtures unless owner waiver. Sub-50ms pure-plan target is aspirational when parse/extract dominate.

## 6. Security, Boundary & Ownership Checks

- [ ] No production code under `packages/core/src/**` modified by 102 PR (including `context/**`, `watcher/**`, `db/**`).
- [ ] No `apps/studio/**` required for B.2 merge (prefer zero).
- [ ] No 016 migrations or durable graph tables introduced as 201 substitute without separate auth.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O during indexing.
- [ ] No `eval` / child_process / dynamic execution of user source as code.
- [ ] No 201 / 301 module implementations in the same change set.
- [ ] No 101 B.1 source modifications.
- [ ] No rewrite of `packages/ingestion/src/parser/**` (103), `extractor/**` (104), or `dependency/**` (105) except separate defect auth.
- [ ] If any IPC / MCP added (`index:*` or similar): **fail validation** for B.2 unless separate auth reopened scope (Layer 2 §12 deferred for B.2).
- [ ] No Memory Engine client / live 201 graph required for merge.
- [ ] Respect ignore/exclusion policy when reading paths (`.gitignore` / configured excludes); never index forbidden privacy paths when a real watcher is used.
- [ ] No embedding provider calls.

## 7. Package & API Contract Checks

- [ ] Work remains in `@ray-studio/ingestion` with build/lint/test scripts green.
- [ ] `IncrementalIndexer` / Index Builder factory exported from package public entry **or** documented subpath — importable by tests without private path hacks.
- [ ] Types for `IndexDelta` (upserts, deletes, affectedModules or documented equivalents) exported or co-located and imported by tests.
- [ ] `reindexPath(path, options?)` (or equivalent) accepts path + source (and projectId) without requiring 201.
- [ ] Optional `start`/`stop` either implemented against an injectable watcher port with fakes, or explicitly deferred with ponytail note and reindexPath as B.2 primary surface.
- [ ] Coordination uses 103 + 104 + 105 public APIs (or thin local adapters that do not fork those modules).
- [ ] Folder layout aligns with Layer 2 §8 (`incremental/`, classifier, affected-set, batch-applier, types) unless ponytail-documented equivalent.
- [ ] Languages for B.2: follow 103/104/105 set (typescript, tsx, javascript, jsx, python) — subset OK only with explicit B.2 slice table in PR notes matching owner waiver.

## 8. Observability

- [ ] Reindex path exposes duration and batch sizes (changed file count, symbol upsert/delete counts, edge upsert/delete counts when available).
- [ ] Skip / error-per-file paths log at warning/debug without dumping full source at default level.
- [ ] Event names `index:change-detected` / `index:delta-ready` / `index:full-reindex-requested` (Layer 2 §13) are optional for B.2 if metrics/log cover counts; if emitted, in-process only (no 013 channel / no MCP).

## 9. Integration Scenarios (consumer-only)

**Required for merge:**
- Unit/fixture tests: sources → 103 parse → 104 extract → 105 `computeDelta` coordinated by 102 → assert `IndexDelta` + optional in-process apply.
- Single-file edit + multi-file dependsOn fixture + delete path.

**Optional (not required for merge):**
- Host script: reindex a real monorepo file pair, print delta counts.
- Fake watcher driving reindexPath.
- Git checkout batch simulation with fakes.

**Forbidden integration tests for B.2:**
- Writing entities to Memory Engine (201) as required path.
- Live 101 `buildContext` graph ports as required path.
- Provider / Gateway / embedding API calls.
- Production MCP server registration.

## 10. Cross-Module Regression (frozen platform)

After 102 implementation, re-run:

- `@ray-studio/ingestion` **103** parser tests — **must remain green**.
- `@ray-studio/ingestion` **104** extractor tests — **must remain green**.
- `@ray-studio/ingestion` **105** dependency tests — **must remain green**.
- `@ray-studio/core` test suite — **must remain green** (no core edits expected).
- Diff must not include forbidden frozen paths (`packages/core/**`, `apps/studio/**`, 201/301 sources, or ownership rewrites of `parser/**` / `extractor/**` / `dependency/**`).

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-010 pass (or FT-010 explicit deferral documented and remaining FTs green).
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.2 performance gates met (§5) or measured + owner waiver (default: small-fixture composite budget).
- [ ] Boundary checks (§6) verified on implementation PR diff.
- [ ] Package & API checks (§7) present.
- [ ] Layer 2 Acceptance Criteria §21 true for B.2 fixtures where in-scope (single-function edit affects planned set; delete file → deletes; rename policy documented).
- [ ] Layer 2 Non-Goals §4 respected (no full reindex product, no LLM, no UI; storage ownership stays deferred).
- [ ] B.2 independent freeze: no hard runtime dependency on 201, 301, or 101 live adapters.
- [ ] **R1** policy documented; no silent attempt to rewrite 105 ownership model inside 102.
- [ ] Manifest `forbidden` / `allowedWritePaths` respected.
- [ ] No 201/301/Gateway/embedding deliverables in the same change set.
- [ ] Constitution §4 / §9 and `pnpm constitution:check` pass when implementation is authorized and complete.
- [ ] No TODOs left in incremental production paths.

## 12. Sign-off

**B.2 validation is the merge gate for Module 102 Phase B.2 slice only.**  
Passing this spec **does not** authorize 201, 301, Gateway, 101 live adapters, or production implementation until implementation is **separately authorized**. This Layer 4 document is a **verification package** for use **after** implementation exists; creating it does not start coding.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests (after impl auth) |
| Architecture review | Indexer ownership under `ingestion/src/incremental/**`, 103/104/105 consume-only, no Core/201 ownership |
| Merge readiness | Diff scoped to `packages/ingestion/src/incremental/**` (+ public export wiring only) |
