# 101 — Context Engine Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/101-context-engine.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-10  
**Module Maturity Alignment:** Ready (Phase B.1 — Ports-first orchestrator)  
**Checkpoint baseline:** `core-platform-001-016-complete` (consume only; do not modify)

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module 101 Phase B.1. Validates the context **orchestrator**, port boundaries, layered assembly, token budget, provenance, and graceful degradation **without** requiring live graph, embeddings, Gateway, Providers, or Memory.

## 2. References

- Layer 2: `prompts/modules/101-context-engine.md` (full — especially ports, Non-Goals, DoD B.1)
- Manifest: `implementation-manifests/101-context-engine.json`
- Constitution §3, §4, §5, §9
- Frozen modules: 009, 010, 011, 012, 013, 016 (public contracts only)
- `history/phase-a-completion.md` Phase B assumptions
- Do **not** require: 102–112, 201, 301, gateway package

## 3. Functional Test Cases

**FT-001: buildContext with Fake ports**
- Preconditions: Engine constructed with Fake graph/semantic/summary ports + heuristic `TokenEstimatorPort`.
- Steps: `buildContext({ intent: "fix IPC errors", targetModule: "013", maxTokens: 4000 })`.
- Expected: Resolves; `tokenEstimate ≤ 4000`; `layers.symbols` and/or `summaries` may be non-empty from fakes; `provenance.length ≥ 1` for each included optional item; `portsUsed` reflects `fake` where used.

**FT-002: Constitution + module spec layers**
- Preconditions: Readable Constitution path; `targetModule` maps to existing `prompts/modules/013-ipc-framework.md` (or equivalent path override).
- Steps: `buildContext` with those paths/module id.
- Expected: `layers.constitution` and `layers.moduleSpec` populated (content or non-empty reference string); provenance entries with `source: 'constitution' | 'moduleSpec'`.

**FT-003: Null ports degrade cleanly**
- Preconditions: Graph + semantic + summary ports in `null` mode.
- Steps: `buildContext` with valid Constitution path and sufficient `maxTokens`.
- Expected: Success; empty symbols/summaries allowed; `degraded === true` **or** explicit empty optional layers without throw; governance layers still present when readable.

**FT-004: Token budget never exceeded**
- Preconditions: Fake ports return oversized corpora.
- Steps: `buildContext` with small `maxTokens` (e.g. 200) but large fake symbol sets.
- Expected: `tokenEstimate ≤ maxTokens`; lowest-score optional items dropped first; every remaining item has provenance.

**FT-005: Constitution-only over budget**
- Preconditions: Constitution text estimate &gt; `maxTokens`; optional ports empty.
- Steps: `buildContext`.
- Expected: Hard failure (`ContextBudgetError` or structured error code); does not silently return over-budget package.

**FT-006: Determinism**
- Steps: Identical request + identical Fake fixtures twice.
- Expected: Deep-equal assembled payload (stable sort of symbols/summaries/provenance).

**FT-007: Exclusion patterns**
- Steps: Fake returns symbols under paths; `excludePatterns` matches some.
- Expected: Excluded items absent from `layers` and provenance.

**FT-008: Port failure isolation**
- Steps: Graph port rejects/throws “unavailable”; other ports Fake.
- Expected: Request still succeeds if governance layers ok; `degraded === true`; no process crash.

## 4. Edge Cases and Error Conditions

- Missing Constitution file when default path used → documented soft miss or config error per spec; never partial corrupt layers.
- Unknown `targetModule` → omit moduleSpec layer; do not throw if intent-only context is still valid.
- `maxTokens &lt;= 0` → validation error.
- Empty `intent` → validation error.
- Concurrent `buildContext` calls → isolated (no shared mutable request state).

## 5. Performance Benchmarks & Measurement (B.1)

| Metric | Gate | Method |
|--------|------|--------|
| Fake-port assembly P95 | &lt; 50ms @ ≤8k budget | Vitest bench or timed loop n≥50 |
| Live graph P95 &lt; 400ms | **Deferred** | Not required for B.1 merge |
| Estimator | Documented heuristic | Assert monotonicity: longer text ≥ shorter estimate |

## 6. Security, Boundary & Ownership Checks

- [ ] No production code under `packages/core/src/{db,ipc,fs,watcher,project,workspace}/**` modified by 101 PR.
- [ ] No 016 migrations or graph tables introduced.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O in Null/Fake/default estimators.
- [ ] If IPC added: only `context:*@x.y` via 013 registry; owner `101`; capability → schema → dispatch; `IpcError` envelope.
- [ ] If FS reads used: paths validated or restricted to known governance roots (011 pattern).

## 7. Port Contract Checks

- [ ] `GraphQueryPort`, `SemanticSearchPort`, `SummaryPort`, `TokenEstimatorPort` defined and injected (no hidden singletons required).
- [ ] Null adapter: empty results, `mode: 'null'`.
- [ ] Fake adapter: deterministic fixtures, `mode: 'fake'`.
- [ ] Engine does not branch on concrete graph DB drivers (Neo4j/Graphiti) inside orchestrator.

## 8. Observability

- [ ] Assembly summary log or return fields include `tokenEstimate`, layer counts, `degraded`, `portsUsed`.
- [ ] Provenance present for included retrieval items.
- [ ] No secret material in logs.

## 9. Integration Scenarios (consumer-only)

**Optional (not all required for merge if pure unit coverage is complete):**
- Host wires engine with Null ports in desktop main — smoke `buildContext` without UI.
- Read `ingestion_status` via existing 016 IPC **only as input signal** (display/degraded hint) — must not write new schema.

**Forbidden integration tests for B.1:**
- Calling OpenAI/Anthropic/etc.
- Writing to graph DB.
- Loading Memory Engine.

## 10. Cross-Module Regression (frozen platform)

After 101 implementation, re-run Core package tests; must remain green:

- Existing `@ray-studio/core` suites for project/fs/watcher/ipc/db (count may grow; prior cases must not fail).
- No forbidden-path diffs in 001/009–016 sources.

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-008 pass.
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.1 performance gate met (§5).
- [ ] Boundary checks (§6) verified on the implementation PR diff.
- [ ] Port contracts (§7) present.
- [ ] Layer 2 Acceptance Criteria §21 all true for B.1.
- [ ] Layer 2 Definition of Done §22 B.1 checklist complete.
- [ ] Constitution §4 layered assembly honored (governance layers preferred).
- [ ] Manifest `forbidden` paths untouched.
- [ ] No Gateway / Provider / Memory deliverables in the same change set.

## 12. Sign-off

**B.1 validation is the merge gate for Module 101 Phase B.1 only.**  
Passing this spec **does not** authorize 102+, 201, 301, or Gateway work.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests |
| Architecture review | Ports, ownership, no Core edits |
| Merge readiness | Diff scoped to `packages/core/src/context/**` (+ package export) and tests only |
