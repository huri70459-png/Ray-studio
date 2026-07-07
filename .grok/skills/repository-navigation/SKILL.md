---
name: repository-navigation
description: Use when you need to locate relevant files, dependencies, consumers, tests, documentation, or previous modules for a feature or implementation task such as "Implement SQLite" or any module work.
---

# Repository Navigation

This skill replaces manual searching. It finds the minimal, targeted context needed for a task.

## Given a Task

Example input: "Implement SQLite" or "Work on file watcher" or "Add command to capture screen"

The skill discovers:

- Relevant source files (apps/, packages/)
- Direct dependencies (manifests, package.json, imports)
- Consumers (who calls this, IPC surface)
- Tests (existing or required)
- Documentation (docs/, prompts/, README, AGENTS)
- Previous / related modules (via dependsOnModules and implementation-manifests)
- Contracts (IPC, public APIs)
- Graph symbols via MCP (list_projects → get_architecture → search_graph)

## Process

1. Read the relevant implementation-manifest for the module.
2. Use codebase graph tools first (never full-repo grep as first step).
3. Trace ownership and boundaries.
4. Surface the smallest set of files + symbols required.
5. Identify test locations and doc locations that must be updated.
6. Note any forbidden areas.

## Output

- Map of key files with short roles
- Dependency graph excerpt
- Recommended read order (manifest → spec → contracts → code)
- Test files to run/extend
- Documentation that references the area
- Any historical decisions (ADRs or notes) that apply

## Goal

Give the caller (especially module-implementation) exactly the context needed with zero waste, in full compliance with §4 Token Optimization.

## Related

- module-implementation (primary consumer)
- architecture-compliance-review
