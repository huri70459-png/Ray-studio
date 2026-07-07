# Ray Studio — Agent Instructions

**FROZEN BASELINE** (architectural — changes require ADR)

**You are operating under the Ray Studio Engineering Constitution v1.0.0 (root file).**  
This is the permanent Layer 1 source of truth for the entire project. All code, reviews, and decisions must follow it.

## Implementation Entry Point (Updated Workflow)

For any implementation or validation task, follow this **deterministic order** with zero interpretation:

1. **Read this AGENTS.md**
2. **Read docs/000-current-status.md**
   - Understand the current phase, which modules are frozen, what is next, and what must not be touched.
3. **Read `project-status.json`**
   - Machine-readable facts: phase, nextModule, architectureFrozen, approvedModules, implementation progress (for agents, Codex, CI, automation).
4. **Load the relevant implementation manifest** from `implementation-manifests/<module-id-or-name>.json`
   - The manifest declares the exact:
     - `required` files
     - `optional` files
     - `forbidden` files
     - `dependsOnModules`
     - automation fields (estimatedContextTokens, priority, implementationOrder, validationRequired)
5. Follow the chain declared by the manifest + status:
   - Engineering Constitution (Layer 1)
   - Specific Module Specification (Layer 2)
   - Implementation Template (Layer 3)
6. Use the **Repository Graph** (Codebase Memory MCP tools) for symbols.
7. Implement (only the declared module).
8. Run / prepare for Validation (Layer 4) — preferably in a separate chat.
9. Produce summary and stop.

The combination of AGENTS.md + Current Status + project-status.json + Manifest removes all decisions about scope and context loading.

## Mandatory Graph Retrieval (Token Optimization §4)

**ALWAYS** after loading the manifest:

1. Call the Codebase Memory MCP tools:
   - `list_projects`
   - `get_architecture(project)`
   - `search_graph` / `trace_call_path` / `get_code_snippet` for targeted symbols

2. Only then use `read_file` for the exact text needed for an edit.

3. Explicitly state in your reasoning:
   - The manifest you followed.
   - Which sections of the Constitution apply.
   - That graph-first retrieval was used.
   - The token-efficient approach taken.

Never load whole files or the entire repo when symbol-level or graph-derived context is sufficient. AGENTS.md + Current Status + Manifest + Graph is the complete, deterministic context strategy.

**Example correct session start (for "Implement Module 011")**:
- Read AGENTS.md
- Read docs/000-current-status.md
- Read implementation-manifests/011-file-system-service.json
- Read only the required files listed
- Then proceed with graph tools for symbols only as needed.

## Key Rules from the Constitution (internalize)
- Ponytail ladder + Enterprise priorities (Safety > Correctness > ...).
- No placeholder code. Production-ready only.
- Layered prompts only (Constitution → Module Spec → relevant symbols).
- Definition of Done is strict (see Constitution §9).
- Update docs/ADR and ingest lasting decisions to the graph.

Full details: read `Ray Studio Engineering Constitution.md` (root).

## Current Monorepo
See the approved structure in the Constitution §5 and `docs/004-folder-structure.md`.

Start every session by confirming you have the latest Constitution and the graph context.

## Codebase Memory MCP

**MANDATORY: use Codebase Memory MCP graph tools FIRST — before reading files or making code changes.**

This rule applies to every request involving this codebase.

Always call `list_projects` first when you do not already know the project name, then use the `display_name` or exact `name` returned by that tool.

```json
// Step 0 — discover project names
mcp_codebase-memo_list_projects()

// Step 1 — use the project identifier returned above
mcp_codebase-memo_get_architecture({ "project": "<display_name>" })
```

### Workflow

1. Call `list_projects` to discover the correct project name.
2. Call `get_architecture(project)` to understand the codebase structure.
3. Use `search_graph` to find relevant symbols, `trace_call_path` for call chains.
4. Use `get_code_snippet` to read specific function implementations.
5. Only use `read_file` when you need exact raw content to edit a specific line.

### Available Tools (14 MCP tools)

**Indexing:**
- `index_repository(repo_path)` — Index a repository into the knowledge graph
- `list_projects` — List all indexed projects with node/edge counts
- `delete_project(project)` — Remove a project and all its graph data
- `index_status(project)` — Check indexing status

**Querying:**
- `search_graph(name_pattern, name_scope, label, file_pattern, exclude_file_pattern)` — Structured search by label, name/qualified_name, include/exclude file globs
- `trace_call_path(function_name, direction, depth)` — BFS call chain traversal
- `detect_changes(project)` — Map git diff to affected symbols + risk
- `query_graph(query)` — Execute Cypher-like graph queries (read-only)
- `get_graph_schema(project)` — Node/edge counts, relationship patterns
- `get_code_snippet(qualified_name)` — Read source code for a function
- `get_architecture(project)` — Codebase overview: languages, packages, routes, hotspots
- `search_code(pattern, project)` — Grep-like text search within indexed files
- `manage_adr(action)` — CRUD for Architecture Decision Records
- `ingest_traces(traces)` — Ingest runtime traces to validate HTTP edges
