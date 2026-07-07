# 010 — Security

**Status:** Reference (Sprint 0)

## Threat Model
- LLM API keys leaking to renderer or logs
- Malicious or overly broad MCP tools
- Ingestion of untrusted code / data into the knowledge graph
- Prompt injection via captured conversations or external sources
- Local database access by other processes on the machine
- Future supply-chain or confused deputy issues when routing between AIs and tools

## Core Controls
### Secrets Management
- All LLM provider keys live exclusively in the trusted layer (main process / native Rust side in Tauri, or secure storage).
- Never sent to renderer.
- Prefer OS keychain / secure storage where available.

### Process Isolation (Desktop)
- Context isolation + sandboxing (Electron) or Tauri's security model.
- Explicit allowlists for any outbound connections.
- No `nodeIntegration` equivalent.

### Graph & Data
- Ingestion pipelines should have allow/deny and sanitization steps.
- User must explicitly approve connecting external sources.
- Clear distinction between "raw captured data" and "curated knowledge".

### MCP
- Tools are registered with declared capabilities.
- User consent before enabling powerful tools (file write, shell, etc.).
- Calls are auditable.

### Prompt / Context Hygiene
- The gateway controls what context is injected.
- Sensitive files or graph nodes can be marked as private / redacted.

## Local Nature
Because the system is local-first:
- The biggest risks are local (other apps on the machine, shoulder surfing, backup leakage).
- We still apply defense-in-depth.

## Future
- Audit logs of all AI calls and tool invocations stored in the graph.
- Optional E2EE for any team/shared graph features.

## References
- `007-ipc-architecture.md`
- `008-rest-api.md`
- Existing secure patterns from AGENT RAY and similar tools in the workspace
