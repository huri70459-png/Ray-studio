# 008 — REST API

**Status:** Reference (Sprint 0)

## Scope
Ray Studio is primarily a **local desktop application**. It does not expose a public REST API by default.

However, several internal and semi-internal HTTP surfaces will exist:

### 1. AI Provider Proxies (Internal)
- The AI Gateway will make outbound HTTPS calls to LLM providers:
  - `https://api.openrouter.ai/...` or direct Anthropic, xAI, OpenAI, Google, etc. endpoints.
- Keys live only in the trusted layer (main process / native side).
- Context injection happens before the call.

### 2. Local AI Gateway (Future / Optional)
- When running the gateway as a standalone service, it may expose:
  - Local HTTP/WebSocket endpoint for other tools (VS Code, CLI) to request completions with full project context.
  - Endpoints like:
    - `POST /v1/chat/completions` (OpenAI compatible with extra context headers)
    - `POST /context/search`
    - `POST /graph/query` (limited)

### 3. MCP over HTTP (when applicable)
Some MCP servers use HTTP/SSE transport.

### 4. Graph Database
Neo4j exposes its own HTTP API (and Bolt). Access is local-only by default.

## Security Rules
- Never expose LLM keys to the renderer or any untrusted client.
- Local gateway (if any) must bind to localhost only by default.
- All external calls use HTTPS.
- Prompt content from the graph is filtered / summarized when appropriate for token budget and privacy.

## OpenAI-Compatible Surface (Target)
If we expose a local gateway, it should be as close as possible to the OpenAI chat completions format so existing tools integrate easily, while adding:
- `x-ray-project-context` or similar header
- Structured logging back to the graph

## Non-Goals
- Public internet-facing API in the initial versions.
- Turning Ray Studio into a hosted multi-tenant service (at least not in foundation phase).

## References
- `002-system-architecture.md`
- `007-ipc-architecture.md`
- Founding plan (AI Gateway concept)
