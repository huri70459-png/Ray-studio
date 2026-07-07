# 011 — Testing Strategy

**Status:** Reference (Sprint 0)

## Layers

### 1. Type Safety & Contracts
- Strict TypeScript + shared types in `packages/core`
- Schema validation (Zod etc.) at every boundary (gateway, ingestion, IPC/MCP)

### 2. Unit Tests
- Core domain logic: entity models, relationship rules, context assembly
- Ingestion parsers
- Gateway routing and prompt construction (with fixtures)

### 3. Integration Tests
- Roundtrip: ingest → store in graph → retrieve relevant context → build prompt
- Multi-provider LLM abstraction (using test doubles)
- Graph query correctness

### 4. E2E / Studio Tests
- Desktop UI flows (command palette, capture, graph navigation)
- Playwright or equivalent for the webview layer
- Full ingestion of a small sample project

### 5. Knowledge Graph Specific
- Test that important decisions are actually persisted and retrievable
- Trace accuracy
- Performance with growing graph sizes

### 6. Security & Privacy Audits
- Key leakage checks
- MCP capability enforcement
- Ingestion redaction

### 7. Manual + AI-assisted
- Use the system itself (Claude + Grok + Graphiti) to review changes
- Maintain living examples in the graph

## Gates
- Typecheck + lint must pass
- Relevant unit/integration tests
- For architecture changes: update the docs + preferably add a test or ADR

## References
- `005-development-standards.md`
