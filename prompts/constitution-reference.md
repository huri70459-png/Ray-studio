# Ray Studio Constitution — Quick Reference (Layer 1)

**You MUST follow the full Ray Studio Engineering Constitution.md (root) at all times.**

## Layered System (per Phase info)

- **Layer 1**: This Constitution (philosophy, standards, token optimization rules).
- **Layer 2**: Module Specifications — see `prompts/modules/`. Use `_template.md` and follow the exact 22-section structure.
- **Layer 3**: Short implementation prompts — use `prompts/templates/implementation.md` (references Layer 1 + specific Layer 2 spec).

## Core Mandates (always apply)
- Graph-first retrieval: ALWAYS start with Codebase Memory MCP tools (`list_projects` → `get_architecture` → targeted `search_graph` / `get_code_snippet`).
- Token optimization: symbol-level + summaries + layered context only. Never dump whole files or repos.
- Ponytail ladder + Enterprise priorities (Safety > Correctness > Reliability > Maintainability > Perf).
- No placeholder code. Production-ready only.
- Explicitly state applicable Constitution sections + the Module Spec you are following.

## Key Sections to Internalize
- §4 Token Optimization (the heart of Ray Studio)
- §5 Monorepo & Repository Rules
- §9 Definition of Done (strict checklist)
- §11 Layered Prompt System

Reference the full document + the specific module spec in `prompts/modules/`. Do not improvise standards.