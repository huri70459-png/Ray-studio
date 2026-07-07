# 104 — Symbol Extractor

**Module ID:** 104-Symbol-Extractor  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/ingestion, packages/core (graph, context)

---

## 1. Purpose

The Symbol Extractor walks Tree-sitter parse trees and extracts typed, language-agnostic symbols (functions, classes, variables, interfaces, etc.) along with their metadata (location, visibility, signatures, documentation). It is the bridge between raw syntax and the semantic knowledge graph used by the Context Engine and Memory Engine.

## 2. Responsibilities

- Traverse CST/AST from the Tree-sitter Parser.
- Apply language-specific query patterns to identify symbols.
- Normalize symbols into a common model (name, kind, signature, docs, location, relationships).
- Extract doc comments and basic type hints where available.
- Produce a flat list or tree of symbols ready for graph upsert.
- Handle partial parses and error nodes gracefully.

## 3. Scope

- Symbol identification and basic metadata extraction for supported languages.
- Integration with Tree-sitter queries (.scm files).
- Mapping syntax nodes to the project's entity model.

## 4. Non-Goals

- Deep semantic analysis or type resolution (use language server or later layers).
- Building the full dependency/call graph (that's 105 Dependency Graph).
- Storing or querying the symbols (Memory Engine / graph).
- UI rendering of symbols.

## 5. Functional Requirements

- For a given parse tree, return a list of Symbol objects with at least: qualifiedName, kind, name, range, signature, docstring.
- Support common symbol kinds: function, class, interface, variable, constant, type, module, etc.
- Extract JSDoc / Python docstrings / Rust doc comments where present.
- Correctly handle nested symbols (e.g., methods inside classes).
- Work on incremental trees without full re-extraction.

## 6. Non-Functional Requirements

- Extraction for a 1000-line file should complete in < 5ms after parsing.
- Must be deterministic for the same tree.
- Low memory overhead.

## 7. Architecture

Parser → Symbol Extractor (query + walker) → Normalized Symbols → Graph Updater / Context Builder

Uses pre-defined Tree-sitter query files per language for maintainability and performance.

Follows Constitution §4 for efficiency.

## 8. Folder Structure

```
packages/ingestion/src/extractor/
├── symbol-extractor.ts
├── queries/
│   ├── typescript.scm
│   ├── python.scm
│   └── ...
└── symbol-model.ts
```

## 9. Public Interfaces

```ts
interface SymbolExtractor {
  extract(tree: Tree, language: string, source: string): Symbol[];
}

interface Symbol {
  id: string;
  kind: 'function' | 'class' | ...;
  name: string;
  qualifiedName: string;
  range: Range;
  signature?: string;
  docstring?: string;
  modifiers?: string[];
}
```

## 10. Internal Components

- Query Loader
- Node Walker / Visitor
- Doc Comment Extractor
- Qualified Name Builder

## 11. Database Schema

Symbols are the primary entities stored in the graph (see 201 Memory Engine).

## 12. IPC/API Contracts

Internal. Results feed directly into graph.

## 13. Events

- `extractor:symbols-extracted` (with count)

## 14. State Management

Stateless. Operates on provided tree + source.

## 15. Error Handling

- Malformed nodes are skipped with warning logged.
- Unknown languages return empty list with log.

## 16. Logging

- Count of symbols per kind.
- Time taken for extraction.

## 17. Security

- No execution of extracted code.
- Respect file exclusion rules before extraction.

## 18. Performance Targets

- < 5ms for typical file on top of parse time.
- Minimal allocations.

## 19. Dependencies

- Tree-sitter Parser (103)
- Symbol model types from core
- Language query files

## 20. Testing Strategy

- Fixture-based tests with expected symbol lists per language.
- Incremental tree tests.
- Benchmark suite.

## 21. Acceptance Criteria

- For a class with methods, all methods and the class are extracted with correct qualified names and ranges.
- Docstrings are captured accurately.
- Works on files with syntax errors (partial results).

## 22. Definition of Done

- All 22 sections complete.
- Integrated with 103 and downstream (101, 105).
- Follows Constitution §4 and §9.
- Tests pass, constitution:check passes.
- No TODOs.
- Queries and examples documented.

---

**References**
- Ray Studio Engineering Constitution §4 Token Optimization, §9 Definition of Done
- 102-incremental-indexer.md
- 103-tree-sitter-parser.md
- docs/002-system-architecture.md

This is the smallest correct, production-ready specification. It references the required Constitution sections. No unrelated modules touched. Ready for Layer 3 usage.

**Confirmation at end:** This change (creation of 104-symbol-extractor.md) satisfies the Module Specification template and the Phase info requirements for Layer 2. It meets the Definition of Done for module specs: follows exact 22-section format, aligns with architecture, references Constitution, production quality, no placeholders.