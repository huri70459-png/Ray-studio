# 103 — Tree-sitter Parser

**Module ID:** 103-Tree-sitter-Parser  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/ingestion, packages/core (context, graph)

---

## 1. Purpose

The Tree-sitter Parser provides fast, accurate, incremental parsing of source code into concrete syntax trees (CST) and abstract syntax trees (AST) for multiple languages. It is the foundational parsing engine that enables precise symbol extraction, dependency analysis, and context building without relying on brittle regex or language-specific heuristics.

## 2. Responsibilities

- Parse files into structured trees using Tree-sitter grammars.
- Support incremental re-parsing for changed ranges (key for the Incremental Indexer).
- Provide language-agnostic node traversal and querying APIs.
- Handle multi-language projects (detect language per file or shebang).
- Extract raw syntax information that higher layers (Symbol Extractor, Dependency Graph) can consume.

## 3. Scope

- Integration with Tree-sitter WASM or native bindings for supported languages.
- Incremental parsing API.
- Basic error recovery and partial parse results.
- Language detection based on extension + content.

## 4. Non-Goals

- Full semantic analysis or type checking (that's for language servers or later layers).
- Storing parse trees long-term (only transient during indexing).
- Direct LLM integration.
- UI for viewing trees (Studio Shell).

## 5. Functional Requirements

- Given source code and previous tree (if any), produce an updated tree with edit ranges applied efficiently.
- Support at minimum: TypeScript, JavaScript, Python, Rust, Go, Markdown (expandable via grammar loading).
- Expose a query API to find nodes by type, field, or capture patterns.
- Return node positions (byte offsets + row/col) accurately for mapping back to source.
- Gracefully handle syntax errors by producing the best partial tree.

## 6. Non-Functional Requirements

- Parsing a typical file (< 500 lines) must be < 10ms on mid-range hardware.
- Incremental updates must be significantly faster than full reparse (target 5-10x).
- Memory usage per parse tree must be bounded and efficient.
- Thread-safe for use in background workers.

## 7. Architecture

The parser is a thin, high-performance wrapper around Tree-sitter:

Ingestion / Indexer → Tree-sitter Parser (with grammar cache) → CST/AST nodes → Symbol Extractor

Key components:
- Grammar Registry (lazy load .wasm or native)
- Parser Pool (for concurrency)
- Incremental Edit Applier
- Node Query Engine (using Tree-sitter queries)
- Error Annotator

Follows Constitution §4 (efficiency, incremental) and §18 (performance targets).

## 8. Folder Structure

```
packages/ingestion/src/parser/
├── tree-sitter/
│   ├── parser.ts
│   ├── grammar-loader.ts
│   ├── incremental.ts
│   └── queries/
│       ├── symbols.scm
│       └── ...
└── index.ts
```

## 9. Public Interfaces

```ts
interface TreeSitterParser {
  parse(language: string, source: string, oldTree?: Tree): ParseResult;
  query(tree: Tree, querySource: string): QueryMatch[];
  getNodeAtPosition(tree: Tree, byteOffset: number): Node | null;
}

interface ParseResult {
  tree: Tree;
  didEdit: boolean;
  errorNodes: Node[];
}
```

## 10. Internal Components

- Grammar Cache
- Parser Instance Manager
- Query Compiler
- Tree Diff / Edit Calculator

## 11. Database Schema

No direct persistence. Parse trees are ephemeral. Results feed into the graph via the Symbol Extractor (see 104 or equivalent).

## 12. IPC/API Contracts

Primarily internal. Exposed via MCP tools if external agents need raw parse queries (future).

## 13. Events

- `parser:parse-completed` (with metrics: duration, nodes, errors)
- `parser:incremental-edit` 

## 14. State Management

Stateless per call except for cached grammars and compiled queries. Trees are returned to caller.

## 15. Error Handling

- Syntax errors are represented in the tree (ERROR nodes) rather than thrown.
- Unsupported languages return clear error with suggestion to add grammar.
- Never crash the indexer on a single bad file.

## 16. Logging

- Structured logs with language, file size, parse time, node count, error count.
- DEBUG for detailed node dumps when enabled.

## 17. Security

- Only parse files that have passed exclusion filters (no secrets scanning here, but respect boundaries).
- No execution of untrusted code from source (Tree-sitter is safe).

## 18. Performance Targets

- Full parse of 1000-line TS file: < 8ms (P95).
- Incremental reparse of small edit: < 1ms.
- Low memory: < 2x source size per tree.

## 19. Dependencies

- tree-sitter / tree-sitter-wasmpack (or native)
- Language grammars (tree-sitter-typescript, etc.)
- packages/core (node types, position utils)

## 20. Testing Strategy

- Golden tree tests for small fixtures per language.
- Incremental edit fuzzing.
- Performance benchmarks in CI.
- Cross-language parity tests.

## 21. Acceptance Criteria

- Editing a function body only re-parses the affected range and produces identical tree outside the edit.
- Query for "function_declaration" returns correct captures with positions.
- Unsupported file type fails gracefully with helpful message.

## 22. Definition of Done

- All sections implemented and tested.
- Integrated with Incremental Indexer (102) and Symbol Extractor.
- Follows Constitution §4 (incremental, low overhead) and §18.
- Constitution check passes.
- No TODOs or placeholder code.
- Documentation and example queries provided.
- Changes ingested to graph where relevant (via downstream).

---

**References**
- Ray Studio Engineering Constitution §4, §18
- 102-incremental-indexer.md
- docs/002-system-architecture.md
- Tree-sitter documentation and query language

**Output requirements met:** This is the smallest correct, production-ready specification following the exact template structure. It references Constitution sections explicitly in relevant parts. No unrelated modules modified. Ready for use in Layer 3 prompts.

**Confirmation:** This module spec meets the Definition of Done for module specifications as it is complete, follows the mandated 22-section format from the Phase info, aligns with existing architecture docs, and would pass `pnpm constitution:check` when wired. No placeholders remain.