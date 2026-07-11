# 104 — Symbol Extractor Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/104-symbol-extractor.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-11  
**Module Maturity Alignment:** Layer 2 Draft file present — B.2 verification gates defined here for independent freeze  
**Checkpoint baseline:** `phase-b2-103-complete` / Module 103 frozen (consume only; do not modify)  
**Sequencing:** D1 second target per `docs/phase-b2-sequencing-decision.md`  
**Derived from:** `prompts/validation/103-tree-sitter-parser.validation.md` (structure + section order)

## 1. Purpose of This Validation Spec

Objective, auditable criteria for Module 104 Phase B.2. Validates the **symbol extractor** under `@ray-studio/ingestion` (`src/extractor/**`): query-driven / walker extraction, normalized symbol model, nested symbols, doc comments, partial-parse tolerance, determinism, and package boundaries **without** requiring 102, 105, Memory (201), Gateway, Providers, live 101 adapters, or Core Platform source changes.

## 2. References

- Layer 2: `prompts/modules/104-symbol-extractor.md` (full — especially Scope, Non-Goals, AC §21)
- Manifest: `implementation-manifests/104-symbol-extractor.json`
- Upstream Ready: `prompts/modules/103-tree-sitter-parser.md` + public package API
- Constitution §3, §4 (token / AST-aware foundations), §5, §9
- Monorepo: `docs/003-monorepo-architecture.md` (`packages/ingestion`)
- Frozen modules: 001, 009–013, 016, 101 B.1, **103** (do not modify)
- Sequencing: `docs/phase-b2-sequencing-decision.md` (D1)
- Do **not** require: 102, 105, 201, 301, gateway package, live graph upsert

### Contract note (no Layer 2 edit required)

- Consume **103 public types** (`SyntaxTree`, `SyntaxNode`, `createTreeSitterParser`, `query`) rather than inventing a parallel tree type. Draft §9 `Tree` maps to 103 `SyntaxTree`.
- Draft §19 “Symbol model types from core” is treated as **optional read-only alignment** with 101 `SymbolContext` shape. B.2 default: **ingestion-local** `Symbol` model under `src/extractor/` (matches 103 zero-`@ray-studio/core` package posture). Mapping helpers to `SymbolContext` are optional and must not edit `packages/core/**`.
- Draft §22 “Integrated with … 101, 105” is **deferred** for B.2 merge: freeze 104 independently testable on 103 trees; document consumer hooks only.

## 3. Functional Test Cases

**FT-001: Extract TypeScript functions and class**
- Preconditions: 103 parser constructed; TS fixture with at least one top-level function and one class with ≥1 method.
- Steps: Parse with language `typescript`; call `extract(tree, language, source)` (or factory equivalent).
- Expected: Returns `Symbol[]`; includes class + methods + function(s); each has non-empty `name`, `qualifiedName`, `kind`, and valid `range` within source bounds.

**FT-002: Nested qualified names**
- Preconditions: Class `Foo` with method `bar`.
- Steps: Extract from parsed tree.
- Expected: Method `qualifiedName` includes parent class (e.g. contains `Foo` and `bar`); ranges nest or method range ⊆ class range (document policy if partial).

**FT-003: JavaScript and Python symbols**
- Steps: Parse + extract JS and Python fixtures (explicit language ids `javascript`, `python`).
- Expected: Both return ≥1 symbol of an expected kind (function/class/module as appropriate to fixture); no throw.

**FT-004: Docstring / JSDoc capture**
- Preconditions: Fixture with JSDoc or Python docstring on a function or class.
- Steps: Extract.
- Expected: Corresponding symbol has non-empty `docstring` (or documented field name) containing distinctive fixture text.

**FT-005: Partial parse / syntax errors**
- Preconditions: Invalid TS (e.g. unclosed brace) still produces a 103 parse result (partial tree).
- Steps: Extract on that tree + source.
- Expected: Does **not** throw solely due to error nodes; returns partial `Symbol[]` (may be empty only if no recoverable symbols — prefer ≥0 with skip of malformed nodes); process remains healthy.

**FT-006: Unknown language**
- Steps: `extract(tree, 'not-a-real-lang-xyz', source)` (or extract after forced unknown language policy).
- Expected: Empty list **or** structured empty result; warning/log path testable; **no** process crash (aligns Layer 2 §15).

**FT-007: Determinism**
- Steps: Same tree + language + source extracted twice.
- Expected: Equal symbol multiset for stable fields (`kind`, `name`, `qualifiedName`, ranges); order stable or sorted by documented comparator.

**FT-008: TSX path**
- Steps: Parse small `tsx` fixture; extract.
- Expected: Success; at least component/function-like symbol if present in fixture (required language set follows 103: ts/tsx/js/jsx/python).

**FT-009: Symbol kinds coverage (spot check)**
- Steps: Fixture(s) covering multiple kinds among: function, class, interface, variable/constant, type, module (as language allows).
- Expected: Documented subset present for B.2; missing kinds listed as explicit deferred with owner note only if not in required set.

**FT-010: Uses 103 tree/query surface (no re-parse ownership)**
- Steps: Inspection + test: extractor accepts pre-built 103 `SyntaxTree`; does not require constructing a second Tree-sitter runtime inside extract for the happy path (lazy query load OK).
- Expected: No duplicate grammar registry ownership under `extractor/**`; parser package remains 103’s.

## 4. Edge Cases and Error Conditions

- Empty source / minimal tree → empty `Symbol[]` (or documented minimal module symbol); no throw.
- Tree/source mismatch (ranges outside source) → skip bad nodes or structured error; no crash.
- Missing query file for a **required** language → fail clearly at init or first extract (`QUERY_LOAD_FAILED` or equivalent); no hang.
- Malformed `.scm` query → structured failure; no process crash.
- Concurrent `extract` on separate trees → both succeed without shared mutable corruption.
- Incremental: re-extract after 103 `parseIncremental` small edit → symbols for unchanged regions remain correct; changed region reflects edit (file-level full re-extract is acceptable B.2 policy if documented).

## 5. Performance Benchmarks & Measurement (B.2)

| Metric | Gate | Method |
|--------|------|--------|
| Extract after parse ~1000-line TS | P95 &lt; 5ms (Layer 2 §6/§18) | Timed loop n≥30 in Vitest; exclude parse time |
| Extract typical &lt;500-line TS | Documented; preferably &lt; 5ms | Timed loop |
| Memory | No unbounded query-cache growth without note | Document cache policy |
| Determinism | Required for golden fixtures | FT-007 |

Hardware variance: document machine; hard gate is the 1000-line extract budget unless owner waiver.

## 6. Security, Boundary & Ownership Checks

- [ ] No production code under `packages/core/src/**` modified by 104 PR (including `context/**`).
- [ ] No `apps/studio/**` required for B.2 merge (prefer zero).
- [ ] No 016 migrations or graph tables introduced.
- [ ] No imports of gateway / provider / memory packages.
- [ ] No network I/O during extraction.
- [ ] No `eval` / child_process / dynamic execution of user source or extracted text as code.
- [ ] No 102 / 105 / 201 / 301 module implementations in the same change set.
- [ ] No 101 B.1 source modifications.
- [ ] No rewrite of `packages/ingestion/src/parser/**` (103 frozen) except separate defect auth.
- [ ] If any IPC added (`extractor:*` or similar): **fail validation** for B.2 unless separate auth reopened scope (Layer 2 §12: internal).
- [ ] No graph upsert / Memory Engine client required for merge.

## 7. Package & API Contract Checks

- [ ] Work remains in `@ray-studio/ingestion` with build/lint/test scripts green.
- [ ] `SymbolExtractor` (or factory + interface) exported from package public entry **or** documented subpath — must be importable by tests without private path hacks.
- [ ] Types for `Symbol` (id, kind, name, qualifiedName, range, optional signature/docstring/modifiers) exported or co-located and imported by tests.
- [ ] `extract` accepts 103 `SyntaxTree` (or thin adapter documented once) + `language` + `source`.
- [ ] Query assets under `src/extractor/queries/` (or equivalent) for required languages: typescript, tsx, javascript, jsx, python (subset OK only with explicit B.2 slice table in PR notes matching owner waiver).
- [ ] Folder layout aligns with Layer 2 §8 (`extractor/`, queries, symbol-model) unless ponytail-documented equivalent.

## 8. Observability

- [ ] Extract path exposes duration and/or per-kind counts (return metrics, structured log, or testable counters).
- [ ] Unknown-language and skip-malformed paths log at warning/debug without dumping full source at default level.
- [ ] Event name `extractor:symbols-extracted` (Layer 2 §13) is optional for B.2 if metrics/log cover count; if emitted, in-process only (no 013 channel).

## 9. Integration Scenarios (consumer-only)

**Required for merge:**
- Unit/fixture tests: 103 parse → 104 extract → assert golden symbol lists.

**Optional (not required for merge):**
- Host script: parse a real monorepo file via 103, extract symbols, print counts.

**Forbidden integration tests for B.2:**
- Writing symbols to graph / Memory Engine (201).
- Building dependency/call graph (105) as required path.
- Driving Incremental Indexer (102).
- Live 101 `buildContext` graph ports as required path.
- Provider / Gateway calls.

## 10. Cross-Module Regression (frozen platform)

After 104 implementation, re-run:

- `@ray-studio/ingestion` **103** parser tests — **must remain green**.
- `@ray-studio/core` test suite — **must remain green** (no core edits expected).
- Diff must not include forbidden frozen paths (`packages/core/**`, `apps/studio/**`, 102/105/201 sources).

## 11. Definition of Done Verification Checklist

- [ ] FT-001 … FT-010 pass.
- [ ] Edge cases in §4 covered by tests or explicit documented skips with rationale.
- [ ] B.2 performance gates met (§5) or measured + owner waiver (default: must meet 1000-line extract budget).
- [ ] Boundary checks (§6) verified on implementation PR diff.
- [ ] Package & API checks (§7) present.
- [ ] Layer 2 Acceptance Criteria §21 true for B.2 fixtures (class+methods, docstrings, partial parse).
- [ ] Layer 2 Non-Goals §4 respected (no deep types, no 105 graph, no storage, no UI).
- [ ] B.2 independent freeze: no hard runtime dependency on 101 live adapters or 105/201.
- [ ] Manifest `forbidden` / `allowedWritePaths` respected.
- [ ] No 102/105/201/301/Gateway deliverables in the same change set.
- [ ] Constitution §4 / §9 and `pnpm constitution:check` pass when implementation is authorized and complete.
- [ ] No TODOs left in extractor production paths.

## 12. Sign-off

**B.2 validation is the merge gate for Module 104 Phase B.2 only.**  
Passing this spec **does not** authorize 102, 105, 201, 301, Gateway, or production implementation until implementation is **separately authorized**. This Layer 4 document is a **verification package** for use **after** implementation exists; creating it does not start coding.

| Role | Sign-off |
|------|----------|
| Implementation | Layer 4 green + tests (after impl auth) |
| Architecture review | Extractor ownership, 103 consume-only, no Core/101/105/201 ownership |
| Merge readiness | Diff scoped to `packages/ingestion/src/extractor/**` (+ public export wiring only) |
