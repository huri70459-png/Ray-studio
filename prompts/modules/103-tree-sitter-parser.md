# 103 — Tree-sitter Parser

**Module ID:** 103-Tree-sitter-Parser  
**Status:** Ready  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-10  
**Implementation Slice:** Phase B.2 — Foundation parser (in-process API)  
**Related Packages:** `packages/ingestion` (`src/parser/**` only)  
**Depends On:** Frozen Core Platform (001, 009–013, 016) as **optional consumers only** — do not modify  
**Sequencing authority:** `docs/phase-b2-sequencing-decision.md` (D1 — first governance/implementation target)

---

## 1. Purpose

The Tree-sitter Parser provides fast, accurate, incremental parsing of source code into concrete syntax trees for multiple languages. It is the **foundational parsing engine** for Phase B.2 (D1 Foundation First): precise syntax trees that later modules (104 Symbol Extractor, 105 Dependency Graph slice, 102 Incremental Indexer) consume **without** this module owning symbols, graph storage, indexing orchestration, Memory, or Providers.

Phase B.2 delivers a production-ready, independently testable parser package so 103 can **freeze without** live integration into 102/104/105.

## 2. Responsibilities

- Own **parse** and **incremental re-parse** of source text into Tree-sitter trees.
- Own **language detection** (extension + optional content heuristics) and **grammar registry** (lazy load).
- Own a language-agnostic **node query** API (Tree-sitter query language).
- Own **position mapping** (byte offset + row/col) for nodes.
- Own **error recovery representation** (ERROR/missing nodes in tree; no indexer crash).
- Expose a stable public TypeScript API for in-process consumers (future 104/102 hosts).
- Emit structured parse metrics suitable for logs (duration, node count, error count).
- Remain independently testable with fixtures (no 102/104/105, Memory, Gateway, or live graph required).

## 3. Scope (Phase B.2)

**In scope**
- Create and own `packages/ingestion` monorepo package (first ingestion package).
- Implement `packages/ingestion/src/parser/**`: parser service, grammar loader/registry, incremental edit apply, query engine, language detection, types, errors, tests.
- Wire package into pnpm workspace / turbo **only as required** for `@ray-studio/ingestion` to build, lint, and test (root workspace already includes `packages/*`).
- Bundle or lazy-load Tree-sitter runtime + grammars for **required languages** (see §5).
- Unit/integration tests: golden trees, incremental edit, unsupported language, partial parse with syntax errors.
- Optional: in-process event callbacks / emitter for parse metrics (not 013 IPC).

**Out of scope for Phase B.2 (explicit)**
- Symbol extraction (104), dependency graph (105), incremental indexer orchestration (102).
- Storing parse trees long-term (DB/graph/files).
- Memory Engine (201), Providers (301+), AI Gateway, MCP server tools.
- Live adapters into Module 101 ports.
- Studio Shell UI for tree visualization.
- Renderer / IPC surface (default is **in-process only**; no `parser:*` channels in B.2).
- Editing frozen modules: 001, 009–013, 016, **101 B.1**.
- Implementing 104/105/102 “integration” beyond documenting the public API contract 104 will call.

## 4. Non-Goals

- Full semantic analysis or type checking (language servers / later layers).
- Direct LLM integration.
- Owning graph entity models or 016 schema changes.
- Regex-based “fake AST” fallback as the primary path (Tree-sitter is required for supported languages).
- Coupling parser internals to Electron main lifecycle (host may construct the parser; 103 does not own shell).

## 5. Functional Requirements

1. Given `language` (or auto-detect from path/extension) and `source: string`, return a `ParseResult` with a Tree-sitter tree and metadata.
2. Given prior `tree` + source edit(s) (`ParseEdit[]`) + new source, perform **incremental** re-parse when the runtime supports it; set `didEdit: true` when edit path was used.
3. Support **required languages for B.2 merge:** `typescript`, `tsx`, `javascript`, `jsx`, `python`.
4. Support **registry extensibility** for additional languages (e.g. `rust`, `go`, `markdown`) without changing the public `TreeSitterParser` interface; shipping extra grammars in B.2 is allowed but not a merge blocker if detection returns a clear unsupported error.
5. Expose `query(tree, querySource): QueryMatch[]` using Tree-sitter query syntax; invalid query → structured error (not process crash).
6. Expose `getNodeAtPosition(tree, byteOffset)` (and optionally row/col helpers) returning node or null.
7. Node positions must be accurate for mapping back to source (byte offsets + row/col where the runtime provides them).
8. Syntax errors produce a **partial tree** with error nodes listed in `ParseResult.errorNodes` (or equivalent); parse call **resolves**, does not throw solely due to bad syntax.
9. Unsupported language → structured `UnsupportedLanguageError` (or result error code); never crash the host.
10. Same source + language + grammar version ⇒ **deterministic** tree structure for tests (stable node types / ranges for golden fixtures).
11. Grammar loading is **lazy** and cacheable; concurrent parse of different languages must not corrupt the registry.
12. Do not execute user source as code; Tree-sitter parse only.

## 6. Non-Functional Requirements

| Metric | B.2 gate | Notes |
|--------|----------|--------|
| Full parse typical file (&lt; 500 lines TS) | P95 &lt; 10ms in Node test env | Aligns with draft; measure in Vitest timed loop |
| Full parse ~1000-line TS fixture | P95 &lt; 15ms preferred; hard gate &lt; 25ms | Document hardware variance |
| Incremental small edit | Faster than full reparse on same fixture (assert ratio or absolute &lt; 5ms) | |
| Memory | Documented; no unbounded grammar cache growth without eviction policy note | |
| Concurrency | Safe for concurrent `parse` from multiple async tasks on **separate** parser instances or documented pool | |
| Determinism | Required for golden fixtures | |
| Network | No network I/O at parse time | Grammars local to package or monorepo assets |

## 7. Architecture

```
Host (future 102/104 / tests)
    → TreeSitterParser
         → LanguageDetector
         → GrammarRegistry (lazy load WASM/native grammar)
         → ParserRuntime (web-tree-sitter or approved binding)
         → IncrementalEditApplier
         → QueryEngine
    → ParseResult { tree, language, didEdit, errorNodes, metrics }
```

**Design decisions (B.2)**
- **Package boundary:** Own `packages/ingestion`; do **not** place parser under `packages/core` (core stays free of heavy native/WASM parse deps).
- **Foundation first:** Public API is what 104 will call later; 103 does not import or implement 104.
- **No frozen Core edits:** Range/position types live in `packages/ingestion` (or thin local types). Do not reopen 101 or 016.
- **Runtime choice:** Prefer **WASM** (`web-tree-sitter` or equivalent maintained binding) for Electron/portability. If native bindings are used, document platform constraints and keep the public API identical. Label any temporary simplification with `ponytail:` + ceiling.
- **IPC:** Not in B.2. Future optional `parser:*@x.y` via 013 would be a separate authorization.
- **Ephemeral trees:** Callers own tree lifetime; 103 may document dispose/delete if the binding requires it.

## 8. Folder Structure

```
packages/ingestion/
├── package.json                 # @ray-studio/ingestion
├── tsconfig.json
├── src/
│   ├── index.ts                 # package public exports
│   └── parser/
│       ├── index.ts             # parser public exports
│       ├── types.ts
│       ├── errors.ts
│       ├── language-detect.ts
│       ├── grammar-registry.ts
│       ├── parser.ts            # TreeSitterParser implementation
│       ├── incremental.ts
│       ├── query.ts
│       ├── grammars/            # loaders + asset refs (not raw secrets)
│       │   └── ...
│       └── parser.test.ts
└── assets/                      # optional .wasm grammars if not inlined via deps
    └── grammars/
```

Queries that are **parser-owned** (generic helpers) may live under `parser/queries/`. Language-specific **symbol** query packs for extraction belong to **104**, not 103 — do not pre-build the 104 surface inside 103 DoD.

## 9. Public Interfaces

```ts
/** Primary product API for Phase B.2 */
interface TreeSitterParser {
  /** Parse full source. language may be omitted if path/extension provided via options. */
  parse(input: ParseInput): Promise<ParseResult>;

  /**
   * Incremental re-parse. Applies edits to oldTree then parses newSource.
   * If incremental path unavailable, may full-parse and set didEdit: false
   * only when documented fallback is used — prefer real incremental when runtime allows.
   */
  parseIncremental(input: IncrementalParseInput): Promise<ParseResult>;

  query(tree: SyntaxTree, querySource: string): QueryMatch[];
  getNodeAtPosition(tree: SyntaxTree, byteOffset: number): SyntaxNode | null;

  /** Optional: list languages currently loadable */
  supportedLanguages(): string[];
}

interface ParseInput {
  source: string;
  /** Canonical id: typescript | tsx | javascript | jsx | python | ... */
  language?: string;
  /** Used for detection when language omitted */
  filePath?: string;
}

interface ParseEdit {
  /** Byte offsets into the *previous* source */
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  /** Optional row/col if required by binding */
  startPosition?: { row: number; column: number };
  oldEndPosition?: { row: number; column: number };
  newEndPosition?: { row: number; column: number };
}

interface IncrementalParseInput {
  language: string;
  previousSource: string;
  newSource: string;
  oldTree: SyntaxTree;
  edits: ParseEdit[];
}

interface ParseResult {
  tree: SyntaxTree;
  language: string;
  didEdit: boolean;
  errorNodes: SyntaxNode[];
  metrics: {
    durationMs: number;
    nodeCount?: number;
    sourceBytes: number;
  };
}

/** Opaque handles — wrap tree-sitter types; do not leak binding details into 104 unnecessarily */
interface SyntaxTree {
  readonly rootNode: SyntaxNode;
  /** Binding-specific dispose if required */
  delete?(): void;
}

interface SyntaxNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly startPosition: { row: number; column: number };
  readonly endPosition: { row: number; column: number };
  readonly childCount: number;
  child(index: number): SyntaxNode | null;
  namedChild(index: number): SyntaxNode | null;
  /** True when node is ERROR / missing per tree-sitter */
  readonly hasError?: boolean;
  readonly isError?: boolean;
}

interface QueryMatch {
  pattern: number;
  captures: Array<{ name: string; node: SyntaxNode }>;
}

type ParserErrorCode =
  | 'UNSUPPORTED_LANGUAGE'
  | 'GRAMMAR_LOAD_FAILED'
  | 'INVALID_QUERY'
  | 'INVALID_INPUT'
  | 'PARSER_INTERNAL';
```

**Construction:** Export a factory e.g. `createTreeSitterParser(options?: ParserOptions): Promise<TreeSitterParser>` or sync if load can be deferred to first parse. Options may include grammar base path and logger.

## 10. Internal Components

- `LanguageDetector` — extension / filename / light content hints
- `GrammarRegistry` — lazy load + cache grammars
- `ParserRuntime` — binding adapter (WASM/native)
- `IncrementalEditApplier` — map `ParseEdit` → runtime edit API
- `QueryEngine` — compile/cache queries
- Error types implementing clear codes for hosts

## 11. Database Schema

**None.** Parse trees are ephemeral. No 016 migrations. No graph writes.

## 12. IPC / API Contracts

**Default (B.2):** in-process TypeScript API only (`@ray-studio/ingestion` exports).

**Not authorized in B.2:**
- 013 channels under `parser:*`
- MCP tools for raw parse
- Renderer access to native/WASM without main-process ownership

If a later module needs IPC, it must register via 013 with owner `103` and a separate authorization.

## 13. Events

Optional in-process hooks (not Analytics 501+):

- `parser:parse-completed` — language, durationMs, sourceBytes, errorCount, didEdit
- `parser:grammar-loaded` — language, loadMs

Do not implement cross-process event bus for B.2.

## 14. State Management

- Stateless per successful parse regarding caller trees (caller holds `SyntaxTree`).
- Stateful caches allowed: grammars, compiled queries, parser pool — must be bounded and documented.
- No global mutable “current file” singleton required.

## 15. Error Handling

| Condition | Behavior |
|-----------|----------|
| Syntax errors in source | Partial tree + `errorNodes`; success path |
| Unsupported language | `UNSUPPORTED_LANGUAGE` structured error |
| Grammar load failure | `GRAMMAR_LOAD_FAILED`; no crash |
| Invalid query string | `INVALID_QUERY` |
| Empty source | Valid empty/minimal tree or documented equivalent |
| Null/undefined source | `INVALID_INPUT` |

Never crash the host process on a single bad file.

## 16. Logging

- Structured logs: `module=tree-sitter-parser`, language, sourceBytes, durationMs, errorCount, didEdit.
- DEBUG: grammar load paths (no dumping full source by default).
- No secrets; do not log entire file contents at INFO.

## 17. Security

- Parse only; **no** `eval`, **no** shell, **no** dynamic code execution from source.
- Grammars loaded from package-controlled paths or declared dependencies only.
- Do not read arbitrary filesystem paths inside the parser unless the host passes source strings (preferred: host uses 011 and passes text).
- If optional path-based helpers exist, they must not bypass future host exclusion filters — path open is **host responsibility**.

## 18. Performance Targets

See §6. Constitution alignment: incremental, low overhead (Constitution §4 retrieval/incremental indexing foundations; §18 performance discipline).

## 19. Dependencies

**Allowed**
- Tree-sitter runtime + official/community grammars for required languages (declare in `packages/ingestion/package.json`).
- Monorepo tooling: TypeScript, Vitest, ESLint, rimraf (match core patterns).
- Node ≥20.18 as per root engines.
- Optional **type-only** or pure imports from `@ray-studio/core` **only if** needed for shared non-parse utilities — **prefer zero dependency on core** for B.2 to preserve layering. If a core import is used, it must not create cycles and must not edit core sources.

**Forbidden as implementation dependencies for B.2**
- Implementing or importing unfinished 102/104/105 modules as required runtime deps.
- Memory Engine, Gateway, Provider SDKs.
- Editing `packages/core/src/**` (including context, db, ipc, fs, watcher, project, workspace).
- Editing `apps/studio/**` for B.2 merge (parser is package-first; studio wiring is optional later and not DoD).

**Module dependency graph (governance)**
- `dependsOnModules`: none required for full-spec freeze (platform is ambient). Soft: may *read* frozen platform contracts for host integration notes only.

## 20. Testing Strategy

- Golden CST fixtures per required language (small files under `parser/__fixtures__` or equivalent).
- Incremental: edit function body → ranges outside edit remain stable; `didEdit` true when incremental path used.
- Syntax error fixture → resolves with `errorNodes.length ≥ 1`.
- Unsupported language → clear error code.
- Query: e.g. capture `function_declaration` / language-appropriate form on TS fixture.
- Performance: timed loop n≥30 for &lt;500 line TS fixture; record P95 in test or documented bench.
- No live 102 indexer, no graph, no network.

## 21. Acceptance Criteria

1. `parse` TypeScript fixture succeeds; root node type is defined; metrics.durationMs populated.
2. `parseIncremental` after a small mid-file edit succeeds; tree usable for query.
3. Invalid syntax file returns partial result without throw (or only throws on true internal failure — syntax alone must not throw).
4. Unsupported language fails with `UNSUPPORTED_LANGUAGE`.
5. `query` returns captures with valid ranges for a known pattern on TS fixture.
6. Layer 4 validation cases in `prompts/validation/103-tree-sitter-parser.validation.md` pass.
7. No modifications to frozen 001/009–016/101 source trees; no 016 migrations; no 102/104/105 implementation.
8. Package `@ray-studio/ingestion` builds, lints, and tests green in isolation.

## 22. Definition of Done (Phase B.2)

- [ ] All B.2 sections of this Ready spec implemented under `packages/ingestion/src/parser/**` (+ package root wiring).
- [ ] Public `TreeSitterParser` API exported from package index.
- [ ] Required languages: typescript, tsx, javascript, jsx, python — parse path tested.
- [ ] Incremental parse path implemented and tested.
- [ ] Layer 4 validation fully green.
- [ ] Constitution compliance: ownership, dependency direction, no Core Platform / 101 edits, no graph-in-SQLite.
- [ ] No TODOs / placeholder code in shipped paths.
- [ ] No 102/104/105/201/301/Gateway deliverables in the same change set.
- [ ] Docs: this spec remains Ready; post-merge history via finalizer only when implementation is authorized and merged.

**Explicitly deferred (not B.2 DoD)**
- Integration with Incremental Indexer (102) and Symbol Extractor (104) beyond stable API.
- Rust / Go / Markdown as required merge languages.
- 013 `parser:*` IPC, MCP tools, Studio UI.
- 101 live adapter wiring.
- Memory Engine (201) persistence of trees or symbols.
- Graph writes.

---

## Phase B.2 sequencing note

Per `docs/phase-b2-sequencing-decision.md` (D1):

```
103 → 104 → 105 (B.2 slice) → 102 → 101 live adapters → 201 (future)
```

103 is the **first** governance and (later) implementation target. Downstream modules are **not** authorized by this Ready package.

---

**References**
- Ray Studio Engineering Constitution v1.0.0 (§3 Architecture, §4 Token Optimization / incremental & AST-aware foundations, §5 Monorepo, §9 DoD)
- `docs/phase-b2-sequencing-decision.md` (D1 recorded)
- `docs/003-monorepo-architecture.md` (`packages/ingestion`)
- Frozen Core Platform: 001, 009–013, 016; frozen 101 B.1
- Layer 4: `prompts/validation/103-tree-sitter-parser.validation.md`
- Manifest: `implementation-manifests/103-tree-sitter-parser.json`
- Downstream (read-only context, not implement): Draft `104-symbol-extractor.md`
