# 101 — Context Engine

**Module ID:** 101-Context-Engine  
**Status:** Ready  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-10  
**Implementation Slice:** Phase B.1 — Ports-first orchestrator  
**Related Packages:** `packages/core` (`src/context/**` only)  
**Depends On (frozen Core Platform):** 009, 010, 011, 012, 013, 016 (consume contracts / metadata only; do not modify)

---

## 1. Purpose

The Context Engine assembles the minimal, relevant, high-quality context package used for layered AI prompts. It is the product enforcement point for Constitution §4 (token optimization) and the layered prompt system: Constitution → Module Spec → symbols → summaries.

It sits **above** the frozen Core Platform and **below** future Gateway / Provider layers. Phase B.1 delivers a deterministic orchestrator with injectable retrieval ports so implementation does not invent graph storage, ingestion pipelines, Memory, or Providers.

## 2. Responsibilities

- Own context **assembly**, ranking policy, compression, token budgeting, and provenance.
- Load required governance layers (Constitution excerpts, target module specification) when paths resolve.
- Coordinate retrieval **only** through declared ports (`GraphQueryPort`, `SemanticSearchPort`, `SummaryPort`, `TokenEstimatorPort`).
- Degrade gracefully when optional ports return empty or unavailable (Null/Fake adapters).
- Emit structured assembly results suitable for later Gateway consumption (consumer is out of scope).
- Remain independently testable with synthetic port fixtures (no live graph required for B.1).

## 3. Scope (Phase B.1)

**In scope**
- `packages/core/src/context/**` orchestrator, types, ports, Null/Fake adapters, layered builder, token budget enforcement.
- Unit/integration tests against fake ports and golden assembled shapes.
- Optional read of Constitution / module specs from known repo paths (read-only).
- Optional use of frozen platform **as inputs only**: project/workspace scope ids (009/010), path-validated FS reads (011), change signals for cache invalidation hooks (012), IPC registration **only if** a main-process API is exposed (013), ingestion_status / project metadata reads (016) — never graph storage in SQLite.

**Out of scope for B.1 (explicit)**
- Production graph database, Graphiti, Neo4j, or embeddings index.
- Incremental indexer, tree-sitter, symbol extractor, dependency graph modules (102–105+).
- Memory Engine (201+), Provider Router / any provider (301+), AI Gateway package.
- Renderer UI for context inspection.
- End-to-end “first AI coding flow.”

## 4. Non-Goals

- Direct LLM calls (Provider / Gateway).
- Long-term memory storage (Memory Engine).
- Raw file ingestion / parsing / embedding generation (Ingestion / later 10x).
- Owning or extending 016 schema for graph entities (016 remains metadata-only; immutable).
- Modifying frozen modules 001, 009–013, 016 except via their public contracts as a consumer.
- MCP server implementation (future infrastructure).

## 5. Functional Requirements

1. Given a `ContextRequest` (intent, optional `targetModule`, `maxTokens`, optional scope, optional exclusions), return an `AssembledContext` that never exceeds `maxTokens` by estimate.
2. Always attempt Constitution layer inclusion when a constitution path is configured and readable; never silently omit when content was successfully loaded.
3. When `targetModule` is set and the corresponding `prompts/modules/<id>-*.md` resolves, include a module-spec layer (reference or bounded excerpt).
4. Invoke registered ports in a defined order; merge results with symbol-level preference over raw file blobs (Constitution §4).
5. Deduplicate items by stable id/path before budgeting.
6. Attach provenance (`source`, `reason`, `score`) to every included non-empty layer item.
7. If `GraphQueryPort` or `SemanticSearchPort` is unavailable or throws a port-unavailable error, continue with remaining ports and governance layers (graceful degradation).
8. If token budget would be exceeded, drop lowest-score optional items first; never drop a successfully loaded Constitution layer to make room for optional symbols (budget error if Constitution alone exceeds budget).
9. Same request + same port fixture state ⇒ deterministic output (stable ordering).

## 6. Non-Functional Requirements

- P95 assembly with in-memory Fake ports and ≤8k budget: **&lt; 50ms** in unit tests (platform-independent). Hardware/graph-backed P95 (&lt; 400ms) is a **later** gate when real ports exist — not a B.1 merge blocker.
- Deterministic given identical inputs and port responses.
- No network I/O in B.1 default adapters.
- No new runtime dependency on Provider SDKs.
- Token estimator: ship a `TokenEstimatorPort` with a simple char/4 heuristic adapter labeled `ponytail: replace with model-accurate estimator when Provider/model registry exists`.

## 7. Architecture

```
ContextRequest
    → LayeredContextBuilder (Constitution + Module Spec — required when resolvable)
    → RetrievalCoordinator
         → GraphQueryPort      (Null | Fake | future 105/graph client)
         → SemanticSearchPort  (Null | Fake | future 107/108)
         → SummaryPort         (Null | Fake | future 109)
    → Rank + Dedup + TokenBudget (TokenEstimatorPort)
    → AssembledContext + provenance
```

**Design decisions (B.1)**
- **Ports over packages:** Do not create `packages/ingestion` or `packages/gateway` in this module.
- **Orchestrator only:** Retriever classes may exist as thin adapters over ports; they must not embed indexing logic.
- **Frozen platform:** Consume 009–016; never invert ownership (no edits under their source trees).
- **IPC:** Default is in-process API on main/desktop side. Cross-process exposure is optional and, if done, **must** register versioned contracts under namespace `context:*` owned by 101 via 013 — no ad-hoc channels.

## 8. Folder Structure

```
packages/core/src/context/
├── engine.ts                 # ContextEngine orchestrator
├── ports.ts                  # Port interfaces + Null/Fake adapters
├── retrievers/
│   ├── graph-retriever.ts    # Adapter over GraphQueryPort
│   ├── semantic-retriever.ts
│   └── hybrid-retriever.ts
├── compressors/
│   ├── token-budget.ts
│   └── summary-compressor.ts
├── builders/
│   └── layered-context-builder.ts
├── types.ts
├── errors.ts
├── index.ts
└── context.test.ts           # Unit tests with Fake ports
```

Export only from `packages/core/src/context/index.ts` and re-export from package root when ready (barrel update is in-scope for 101).

## 9. Public Interfaces

```ts
/** Primary product API for Phase B.1 */
interface ContextEngine {
  buildContext(request: ContextRequest): Promise<AssembledContext>;
}

interface ContextRequest {
  intent: string;
  /** Module id or slug, e.g. "013" or "013-ipc-framework" */
  targetModule?: string;
  maxTokens: number;
  /** Informational for future model-specific estimators; not used to call providers */
  modelId?: string;
  excludePatterns?: string[];
  workspaceId?: string;
  projectId?: string;
  /** Optional absolute or repo-relative overrides for tests */
  constitutionPath?: string;
  moduleSpecPath?: string;
}

interface AssembledContext {
  layers: {
    constitution?: string;
    moduleSpec?: string;
    symbols: SymbolContext[];
    summaries: ArchitectureSummary[];
  };
  tokenEstimate: number;
  provenance: ProvenanceItem[];
  /** Which ports contributed; aids explainability and tests */
  portsUsed: {
    graph: 'null' | 'fake' | 'live';
    semantic: 'null' | 'fake' | 'live';
    summary: 'null' | 'fake' | 'live';
  };
  degraded: boolean;
}

interface SymbolContext {
  id: string;
  path?: string;
  name: string;
  kind?: string;
  snippet?: string;
  score: number;
}

interface ArchitectureSummary {
  id: string;
  title: string;
  body: string;
  score: number;
}

interface ProvenanceItem {
  itemId: string;
  source: 'constitution' | 'moduleSpec' | 'graph' | 'semantic' | 'summary' | 'fs';
  reason: string;
  score: number;
}

// --- Ports (dependency inversion; no live graph required) ---

interface GraphQueryPort {
  readonly mode: 'null' | 'fake' | 'live';
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

interface SemanticSearchPort {
  readonly mode: 'null' | 'fake' | 'live';
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

interface SummaryPort {
  readonly mode: 'null' | 'fake' | 'live';
  getSummaries(query: { intent: string; targetModule?: string }): Promise<ArchitectureSummary[]>;
}

interface TokenEstimatorPort {
  estimate(text: string): number;
}

interface ContextEngineDeps {
  graph: GraphQueryPort;
  semantic: SemanticSearchPort;
  summaries: SummaryPort;
  tokens: TokenEstimatorPort;
  /** Optional: validated read for constitution/module files (may wrap 011 in host) */
  readText?: (path: string) => Promise<string | null>;
}
```

**Null adapters:** return empty arrays; `mode: 'null'`.  
**Fake adapters:** return deterministic fixtures for tests.  
**Live adapters:** out of B.1 ownership; wired later without changing `ContextEngine` public API.

## 10. Internal Components

- `ContextEngine` — orchestrator
- `LayeredContextBuilder` — Constitution + module spec layers
- `RetrievalCoordinator` — port fan-in
- Ranking / dedup (may be pure functions)
- `TokenBudget` compressor
- Port Null/Fake implementations
- Error types: `ContextBudgetError`, `ContextConfigError` (and map to structured results where preferred over throw)

## 11. Database Schema

**None for graph.** 101 does not own SQLite tables and must not store graph entities in 016.

Optional later (not B.1): ephemeral in-memory session cache only. Any durable metadata must use existing 016 config/ingestion APIs as a **consumer**, without schema changes in this module’s first merge unless a separate ADR reopens 016 (not authorized here).

## 12. IPC / API Contracts

**Default (B.1):** in-process TypeScript API (`ContextEngine`).

**If** renderer or other process must call assembly:
- Register under 013: namespace `context`, owner module `101`, channels e.g. `context:build@1.0`
- Capability → schema → dispatch ordering mandatory
- Standard `IpcError` envelope on failures
- No ad-hoc `ipcMain` channels

MCP tool exposure is **not** part of B.1 DoD.

## 13. Events

Optional structured log events (in-process or 013 event bus if IPC is enabled):

- `context:assembled` — summary (tokenEstimate, portsUsed, degraded)
- `context:token-limit-exceeded` — when budget cannot be satisfied without dropping Constitution

Do not implement Analytics (501+) pipelines.

## 14. State Management

Stateless per `buildContext` call. Any cache must be optional, bounded, and invalidatable; default is no cross-request cache in B.1.

## 15. Error Handling

- Port failures: degrade + set `degraded: true`; do not fail the whole request if governance layers remain.
- Unreadable Constitution when path was explicitly required: `ContextConfigError` or failed result with clear code.
- Budget: Constitution-only over budget → hard error; optional layers trimmed first.
- Never execute untrusted code during retrieval.

## 16. Logging

- INFO: assembly summary (tokenEstimate, layer counts, degraded, portsUsed).
- DEBUG: per-item include/exclude decisions.
- No secrets; truncate long snippets in logs.

## 17. Security

- If using 011, only read paths under validated roots / known governance paths.
- Respect `excludePatterns`.
- No provider API keys, no network calls in default adapters.
- Renderer must not construct privileged FS/DB clients; use 013 if cross-process.

## 18. Performance Targets

| Target | B.1 gate | Future (live ports) |
|--------|----------|---------------------|
| Assembly P95 | &lt; 50ms Fake ports, ≤8k budget | &lt; 400ms typical coding task |
| Token estimate accuracy | Heuristic documented | ±5% with model-aware estimator |
| Determinism | Required | Required |

## 19. Dependencies

**Allowed (frozen Core Platform — consume only)**  
- 009 / 010: optional scope identity on `ContextRequest`  
- 011: optional validated file reads for governance docs  
- 012: optional future invalidation hook (not required for B.1 merge)  
- 013: required **if** IPC surface is added; otherwise not used  
- 016: optional `ingestion_status` / project metadata read; **never** graph rows  

**Allowed (this module)**  
- `packages/core/src/context/**`  
- stdlib / already-installed monorepo tooling (vitest, typescript)  
- `TokenEstimatorPort` heuristic (no new Provider SDK)

**Forbidden as implementation dependencies for B.1**  
- `packages/gateway`, provider SDKs, Memory Engine packages  
- Creating production Graphiti/Neo4j clients inside 101  
- Editing `packages/core/src/{db,ipc,fs,watcher,project,workspace}/**`

## 20. Testing Strategy

- Unit: builder, budget, rank/dedup, Null vs Fake ports.
- Property: `tokenEstimate ≤ maxTokens` for random Fake corpora (within estimator rules).
- Golden: stable `AssembledContext` shape for fixed fixtures.
- Degradation: graph port throws → still returns Constitution/module when available.
- No live external graph required for merge.

## 21. Acceptance Criteria

1. `buildContext` with Fake ports returns layers + provenance + `portsUsed` + `tokenEstimate ≤ maxTokens`.
2. With a readable Constitution path and resolvable `targetModule` for an **existing** Phase A module spec (e.g. `013`), output includes constitution and moduleSpec content or references.
3. Null graph + Null semantic still succeeds with governance layers and `degraded: true` or empty symbol lists without throwing.
4. Token budget trims optional symbols before failing; provenance retained for included items.
5. Layer 4 validation cases in `prompts/validation/101-context-engine.validation.md` pass.
6. No imports from gateway/provider/memory packages; no 016 schema migrations authored by 101.
7. Frozen module source trees listed in the implementation manifest `forbidden` are unmodified.

## 22. Definition of Done (Phase B.1)

- [ ] All B.1 sections of this Ready spec implemented under `packages/core/src/context/**`.
- [ ] Port interfaces + Null and Fake adapters present and tested.
- [ ] Layer 4 validation spec fully green.
- [ ] Constitution compliance: ownership, dependency direction, no Core Platform edits, no graph-in-SQLite.
- [ ] Public `ContextEngine` API exported from context index.
- [ ] No TODOs / placeholders in shipped code.
- [ ] No Gateway integration, no Provider calls, no Memory Engine work.
- [ ] Documentation: this spec remains Ready; implementation notes only in history/101.md at post-merge finalizer (not a B.1 coding task to invent new governance).

**Explicitly deferred (not B.1 DoD):** live graph ports, hybrid production retrieval quality, Gateway wiring, provider-accurate tokenizers, MCP tools, &lt;400ms live P95.

---

## Phase B sequencing note

101 B.1 is an **orchestrator with ports**. Later modules (102–112) and/or Memory (201) supply live adapters. Do not block B.1 on those modules. Do not implement those modules under this manifest.

---

**References**
- Ray Studio Engineering Constitution v1.0.0 (§3 Architecture, §4 Token Optimization, §5 Monorepo, §9 DoD)
- Frozen Core Platform: 001, 009–013, 016 (`core-platform-001-016-complete`)
- `history/phase-a-completion.md` (Phase B readiness assumptions)
- `docs/002-system-architecture.md`, `docs/006-database-architecture.md` (graph is future source of truth; not owned by 101)
- Layer 4: `prompts/validation/101-context-engine.validation.md`
- Manifest: `implementation-manifests/101-context-engine.json`
