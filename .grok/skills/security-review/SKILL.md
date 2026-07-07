---
name: security-review
description: Use when reviewing or implementing security-sensitive areas: Electron main process, IPC, secrets handling, SQLite, file system access, permissions, renderer isolation, or any input/validation boundary.
---

# Security Review

Critical for desktop app correctness. Run before merge-readiness on any module touching privileged surfaces (especially 001, 013, 016, 011, 012).

## Checks

- Electron main:
  - Context isolation enabled
  - nodeIntegration: false in renderer
  - Preload only exposes narrow, typed APIs via contextBridge
- IPC:
  - All privileged actions validated on main side
  - No trust in renderer payloads
  - Contracts match implementation-manifest + module spec
- Secrets:
  - Never logged, never bundled into renderer
  - Proper storage (keytar / OS keychain where possible, or encrypted local)
- SQLite (016):
  - Parameterized queries only (no string concat)
  - Least-privilege DB access
  - Migration safety + rollback
- File System (011):
  - Scoped access only (user-approved directories)
  - No arbitrary path traversal
  - Proper error handling without leaking paths
- Permissions & Isolation:
  - Renderer cannot reach fs, child_process, net directly
  - No remote code execution vectors
  - CSP / webPreferences hardened
- Injection:
  - No eval / new Function from user data
  - Safe DOM updates (textContent or sanitized)
  - Command palette input sanitized before any action
- Validation:
  - All cross-boundary data validated + typed
  - Size / rate limits where applicable

## Process

1. Read relevant preload + main process code.
2. Read IPC contract definitions.
3. Trace data flow from untrusted (renderer / user) to privileged.
4. Check for the checks above.
5. Review any new file system or DB operations.
6. Note any TODOs or risky patterns.

## Output

**Security Review**

- PASS / FAIL per category
- Specific issues with file references
- Required fixes (must be addressed before merge)
- Residual risks (documented + accepted)

## Related Skills

- architecture-compliance-review (compose for full gate 5)
- module-implementation (use early on privileged modules)
- electron-ui-review (renderer side)
- merge-readiness (mandatory input for modules with security surface)
