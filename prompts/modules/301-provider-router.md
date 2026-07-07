# 301 — Provider Router

**Module ID:** 301-Provider-Router  
**Status:** Draft  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** packages/gateway, packages/core (llm)

---

## 1. Purpose

The Provider Router is the single point of abstraction and routing for all calls to external (and local) AI models. It hides provider-specific details from the rest of the system and enables model selection, fallback, rate limiting, and logging.

## 2. Responsibilities

- Route requests to the correct provider implementation based on configuration and request metadata.
- Handle authentication, base URLs, and model-specific formatting.
- Implement retry, fallback, and circuit-breaker policies.
- Record usage for analytics and cost tracking.
- Enforce rate limits and quotas.

## 3. Scope

- All LLM / embedding / tool-use calls that go outside the desktop.
- Provider abstraction layer (OpenAI-compatible + native SDKs).
- Basic routing logic and policy enforcement.

## 4. Non-Goals

- Context assembly (Context Engine).
- Long-term memory (Memory Engine).
- Prompt template management.
- Direct UI for model selection (Studio Shell + Settings).

## 5. Functional Requirements

- Support at minimum: OpenAI, Anthropic, Gemini, Ollama (and easy extension for others).
- Accept a normalized request format and translate to the target provider.
- Support model aliases and capability-based selection.
- Log every call with token usage, latency, cost estimate, and outcome.
- Provide a clear error taxonomy that callers can act on.

## 6. Non-Functional Requirements

- Adding or changing a provider must not require changes in callers.
- Latency overhead of the router itself should be negligible (< 20ms P95).
- Must be resilient to individual provider outages.

## 7. Architecture

The router sits between the AI Gateway orchestration and the concrete provider clients:

Gateway (orchestration) → Provider Router → Concrete Provider Client (OpenAI, Anthropic, etc.)

It owns:
- Provider registry
- Request/response normalization
- Policy engine (rate limits, fallbacks)
- Usage recording hook

## 8. Folder Structure

```
packages/gateway/src/providers/
├── router.ts
├── registry.ts
├── base-provider.ts
├── openai/
├── anthropic/
├── gemini/
├── ollama/
└── types.ts
```

## 9. Public Interfaces

```ts
interface ProviderRouter {
  complete(request: NormalizedCompletionRequest): Promise<NormalizedCompletionResponse>;
  embed(request: NormalizedEmbedRequest): Promise<NormalizedEmbedResponse>;
  // tool calls etc. in future
}

interface ProviderConfig {
  id: string;
  type: 'openai' | 'anthropic' | ...;
  model: string;
  // credentials via desktop secret store
}
```

## 10. Internal Components

- Provider Factory
- Policy Engine
- Usage Recorder
- Error Mapper

## 11. Database Schema

Primarily logs usage to analytics / cost systems (see Phase F).

May store provider configurations (non-secret parts) in settings.

## 12. IPC/API Contracts

Internal for now.

The router is the boundary that the Gateway uses.

## 13. Events

- `provider:request-started`
- `provider:request-completed`
- `provider:request-failed`
- `provider:rate-limit-hit`

## 14. State Management

Mostly stateless per request. Configuration comes from Settings Manager.

## 15. Error Handling

- Map provider-specific errors to a small set of normalized errors (rate limit, auth, timeout, model error, etc.).
- Never leak raw provider error messages that contain keys or internal details.

## 16. Logging

- Structured logs with provider id, model, token counts, latency, and outcome.
- Never log full prompts or responses at INFO level (use DEBUG + redaction).

## 17. Security

- Credentials must be obtained only through the desktop secret management path.
- No provider keys ever cross into renderer processes.

## 18. Performance Targets

- Router overhead < 15ms P95.
- Fast failover when a provider is unhealthy.

## 19. Dependencies

- Individual provider SDKs (with version pinning)
- Settings / Config service
- Analytics / usage recording interface
- packages/core llm types

## 20. Testing Strategy

- Mock provider clients for unit tests.
- Integration tests against real local models (Ollama) where possible.
- Contract tests that verify normalization round-trips.
- Chaos tests for rate limits and failures.

## 21. Acceptance Criteria

- A caller can request completion by capability ("fast", "smart", "local") without knowing the concrete provider.
- Usage is recorded for every call.
- Switching providers or adding a new one requires only configuration + a new adapter, not caller changes.

## 22. Definition of Done

- All sections implemented and tested.
- At least three providers wired (including one local).
- Integrated with the AI Gateway.
- Follows Constitution standards for security, logging, and error handling.
- Passes constitution:check.

---

**References**
- Ray Studio Engineering Constitution
- docs/002-system-architecture.md (AI Gateway / Orchestration)
- docs/003-monorepo-architecture.md (packages/gateway)