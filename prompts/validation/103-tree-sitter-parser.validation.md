# 103 — Tree-sitter Parser Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/103-tree-sitter-parser.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-10  
**Module Maturity Alignment:** Ready (Phase B.2 — Foundation parser)  
**Checkpoint baseline:** `phase-b-101-complete` / Core Platform frozen (consume only; do not modify)  
**Sequencing:** D1 first target per `docs/phase-b2-sequencing-decision.md`

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module 103 Phase B.2. Validates the Tree-sitter **parser package**, language registry, incremental re-parse, query API, error recovery, and package boundaries **without** requiring 102, 104, 105, Memory, Gateway, Providers, or live 101 adapters.

## 2. References

- Layer 2: `prompts/modules/103-tree-sitter-parser.md` (full — especially Scope, Non-Goals, DoD B.2)
- Manifest: `implementation-manifests/103-tree-sitter-parser.json`
- Constitution §3, §4 (incremental / AST-aware foundations), §5, §9
- Monorepo: `docs/003-monorepo-architecture.md` (`packages/ingestion`)
- Frozen modules: 001, 009–013, 016, 101 B.1 (do not modify)
- Do **not** require: 102, 104, 105, 201, 301, gateway package

## 3. Functional Test Cases

**FT-001: Full parse TypeScript**
- Preconditions: Parser constructed; TS fixture (~50–200 lines) available.
- Steps: `parse({ language: 'typescript', source })`.
- Expected: Resolves; `result.language === 'typescript'`; `rootNode` defined; `metrics.durationMs ≥ 0`; `metrics.sourceBytes === source length in bytes` (or documented encoding rule).

**FT-002: Full parse JavaScript and Python**
- Steps: Parse JS and Python fixtures with explicit language ids (`javascript`, `python`).
- Expected: Both succeed with non-null root nodes.

**FT-003: Language detection from filePath**
- Steps: `parse({ source, filePath: 'src/foo.ts' })` without `language`.
- Expected: Detects TypeScript (or tsx policy documented); parse succeeds.

**FT-004: Incremental re-parse**
- Preconditions: Initial parse of a multi-function TS file; apply a small mid-file body edit via `ParseEdit[]`.
- Steps: `parseIncremental({ language, previousSource, newSource, oldTree, edits })`.
- Expected: Resolves; preferably `didEdit === true`; tree queryable; nodes outside edit region retain consistent types/structure vs re-full-parse baseline (document equality strategy).

**FT-005: Syntax error partial tree**
- Steps: Parse intentionally invalid TS (e.g. unclosed brace).
- Expected: Does **not** throw solely for syntax errors; `errorNodes.length ≥ 1` **or** `rootNode.hasError === true` (document which); result usable enough for caller to continue.

**FT-006: Unsupported language**
- Steps: `parse({ language: 'not-a-real-lang-xyz', source: 'x' })`.
- Expected: Structured failure with code `UNSUPPORTED_LANGUAGE` (throw or Result — must be documented and tested).

**FT-007: Query captures**
- Preconditions: Valid TS tree containing a function.
- Steps: Run a tree-sitter query appropriate to the grammar for function-like nodes.
- Expected: ≥1 capture; capture node ranges within source bounds.

**FT-008: getNodeAtPosition**
- Steps: Pick byte offset inside a known identifier; call `getNodeAtPosition`.
- Expected: Non-null node whose range covers the offset (or nearest documented semantics).

**FT-009: Determinism**
- Steps: Parse identical source + language twice (fresh or same parser instance per docs).
- Expected: Equal root type; equal structure for golden assertion helper (stable types + ranges).

**FT-010: TSX / JSX path**
- Steps: Parse a small `.tsx` or language `tsx` fixture with JSX syntax.
- Expected: Success (required language set includes tsx/jsx).

## 4. Edge Cases and Error Conditions

- Empty string source → documented success (empty/minimal tree) or `INVALID_INPUT` — pick one, test it.
- Missing grammar asset → `GRAMMAR_LOAD_FAILED`, no process crash.
- Invalid query string → `INVALID_QUERY`.
- Concurrent parses (two parallel `parse` calls) → both succeed without throw/corruption.
- `parseIncremental` with empty `edits` → equivalent to full parse or no-op edit; documented.
- Extremely large file (optional stress) → either completes or fails with clear code; no hang without timeout policy (B.2: document; hard stress optional).

## 5. Performance Benchmarks & Measurement (B.2)

| Metric | Gate | Method |
|--------|------|--------|
| Full parse &lt;500 line TS P95 | &lt; 10ms | Timed loop n≥30 in Vitest |
| Full parse ~1000 line TS P95 | &lt; 25ms hard | Fixture + timed loop |
| Incremental small edit | &lt; full reparse time on same fixture | Compare medians or assert incremental &lt; 5ms when full &gt; that |
| Grammar first load | Logged; not a hard fail if &lt; 2s cold | Document |

## 6. Security, Boundary & Ownership Checks

- [ ] No production code under `packages/core/src/**` modified by 103 PR.
- [ ] No `apps/studio/**` required for B.2 merge (if any studio file appears, must be justified and still not DoD — prefer zero).
- [ ] No 016 migrations or graph tables introduced.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O during parse.
- [ ] No `eval` / child_process / dynamic execution of user source.
- [ ] No 102 / 104 / 105 module implementations in the same change set.
- [ ] No 101 B.1 source modifications.
- [ ] If any IPC added: **fail validation** for B.2 unless separate auth reopened scope (B.2 forbids parser IPC).

## 7. Package & API Contract Checks

- [ ] Package name `@ray-studio/ingestion` exists with build/lint/test scripts.
- [ ] `TreeSitterParser` (or factory + interface) exported from package public entry.
- [ ] Types for `ParseResult`, `ParseEdit`, errors with stable codes exported or documented.
- [ ] Required languages loadable: typescript, tsx, javascript, jsx, python.
- [ ] Grammar loading lazy or explicitly initialized once; second parse of same language does not reload from disk every time (cache observable via metrics or unit spy).

## 8. Observability

- [ ] Parse metrics include duration and source size.
- [ ] Structured log or testable metrics path includes language + errorCount.
- [ ] No full source dumps at default log level.

## 9. Integration Scenarios (consumer-only)

**Optional (not required for merge):**
- Host constructs parser in a Node script and parses a real monorepo file (read by test harness only).

**Forbidden integration tests for B.2:**
- Calling Symbol Extractor 104 as required path.
- Writing to graph / Memory Engine.
- Driving Incremental Indexer 102.
- Provider / Gateway calls.

## 10. Cross-Module Regression (frozen platform)

After 103 implementation, re-run:

- `@ray-studio/core` test suite — **must remain green** (no core edits expected).
- Studio build if monorepo turbo builds all — must not break; 103 should not require studio changes.
- Diff must not include forbidden frozen paths.

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-010 pass.
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.2 performance gates met (§5) or measured + waiver only with owner note (default: must meet).
- [ ] Boundary checks (§6) verified on implementation PR diff.
- [ ] Package & API checks (§7) present.
- [ ] Layer 2 Acceptance Criteria §21 all true for B.2.
- [ ] Layer 2 Definition of Done §22 B.2 checklist complete.
- [ ] Manifest `forbidden` paths untouched.
- [ ] No 102/104/105/201/301/Gateway deliverables in the same change set.

## 12. Sign-off

**B.2 validation is the merge gate for Module 103 Phase B.2 only.**  
Passing this spec **does not** authorize 104+, 102, 105, 201, 301, Gateway, or production implementation until implementation is separately authorized. This Layer 4 document is a **verification package** for use **after** implementation exists; creating it does not start coding.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests (after impl auth) |
| Architecture review | Package boundary, no Core/101 edits, ephemeral trees |
| Merge readiness | Diff scoped to `packages/ingestion/**` (+ workspace package registration only) |
