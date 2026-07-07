# 007 — IPC Architecture

**Status:** Reference (Sprint 0)

## Context
If Ray Studio is implemented as a desktop application (Electron or Tauri), we will have a main process / backend that must communicate securely with the renderer / frontend.

Even in a Tauri setup, secure boundaries between webview and native code are required.

## Core Principles
- Frontend (UI shell) is untrusted for privileged operations.
- Main / native side owns:
  - LLM API keys
  - Direct database connections (graph driver)
  - File system access beyond user-selected paths
  - MCP server spawning
- All cross-boundary calls are explicit and validated.

## Patterns
### Secure Channel Exposure
Use context bridge (Electron) or Tauri's invoke / event system.

Example channels (to be defined in `packages/core` or dedicated IPC package):
- `ai:send` / `ai:stream` (with context already assembled)
- `graph:query`
- `graph:ingest`
- `mcp:invokeTool`
- `capture:quickThought`
- `project:open`, `settings:get`

### Validation
- Every privileged call must validate origin / sender.
- Input schema validation (Zod or equivalent) on both sides.
- No arbitrary code execution or path traversal.

## Between Components (non-IPC)
- Within the same process: normal function calls + well-defined service interfaces.
- Gateway ↔ Graph: direct client libraries.
- Studio UI ↔ Gateway: clean API boundary.

## External Protocols
- **MCP**: Follow the Model Context Protocol (stdio, SSE, etc.).
- **LLM Providers**: OpenAI-compatible where possible + native SDKs.
- **Graph DB**: Official drivers (Bolt for Neo4j, etc.).

## Future
- Headless / server mode of the gateway (REST + WebSocket) so VS Code extensions or CLIs can talk to a running Ray Studio instance.
- Capability-based permissions for MCP tools.

## References
- `002-system-architecture.md`
- `008-rest-api.md`
- Current secure patterns from related projects (AGENT RAY, raycast-clone)
