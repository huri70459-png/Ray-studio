# 001 — Studio Shell

**Module ID:** 001-Studio-Shell  
**Status:** Architecture Approved  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Related Packages:** apps/studio

---

## 1. Purpose

The Studio Shell is the primary desktop application host and user-facing container for Ray Studio. It provides the window management, global command system, navigation framework, and integration surface through which all other capabilities (graph exploration, AI interactions, capture, settings) are accessed.

It exists to deliver a fast, keyboard-first, information-dense experience that makes the persistent knowledge graph immediately actionable while maintaining strict separation between the untrusted UI layer and privileged operations (secrets, direct graph access, file system, MCP).

## 2. Responsibilities

- Own the top-level desktop window lifecycle, layout, and theming.
- Provide a global, always-available command palette as the primary interaction model.
- Host and compose all major surfaces: graph explorer, AI workspaces, capture flows, project views, and settings.
- Expose safe extension points and APIs for internal modules and future plugins.
- Manage navigation state, focus, and keyboard shortcuts across the entire application.
- Coordinate with lower layers exclusively through defined IPC/API boundaries.
- Ensure all user interactions remain responsive and provide clear provenance for AI-driven actions.

The Studio Shell owns exclusively the presentation and orchestration of the user experience. It does not own data models, retrieval logic, LLM calls, or direct persistence.

## 3. Scope

- Desktop application shell (Electron) including main/renderer boundary.
- Global command palette and keyboard navigation system.
- High-level layout, theming, and component composition for all user-facing features.
- Integration surfaces for context inspection, quick capture, and AI scoping.
- Basic window management, multi-project awareness at the UI level, and session persistence for UI state only.

## 4. Non-Goals

- Direct implementation of graph queries, embeddings, or retrieval (belongs to Context Engine / core).
- LLM provider calls or context assembly (belongs to AI Gateway).
- Raw code indexing or ingestion pipelines (belongs to Ingestion layer).
- Persistent storage of project knowledge or decisions (belongs to Memory / core layers).
- Low-level file system or secret management (belongs to platform services).
- Standalone CLI or headless operation (future concern for Gateway only).

## 5. Functional Requirements

1. Launch and render the full desktop application with cold-start time meeting performance targets.
2. Present a discoverable, searchable global command palette that can invoke any registered action from any surface.
3. Support multiple concurrent AI workspaces, each scoped to relevant graph context.
4. Provide live-updating graph visualization and exploration views with filtering, search, and navigation to source artifacts.
5. Offer low-friction capture mechanisms (global hotkey, dedicated bar) that write user input directly into the knowledge graph.
6. Display a context inspector that shows exactly what graph data, summaries, and Constitution sections will be sent for the current task.
7. Allow seamless switching between projects while preserving relevant UI state.
8. Support dark and light themes with full keyboard navigation and high-contrast accessibility.
9. Enable extension of the command palette and surfaces via well-defined registration mechanisms.
10. Surface clear feedback and provenance for every AI-assisted action or graph-derived view.

## 6. Non-Functional Requirements

- The application must feel instantaneous: command palette response < 100ms P95, view transitions < 200ms.
- Full keyboard-first operation; mouse is secondary.
- Strict context isolation between renderer/UI and privileged main/native process.
- Memory footprint must remain bounded even with large graphs loaded (lazy loading and virtualization).
- All UI state that is not project knowledge must be persisted locally without affecting the graph.
- The shell must degrade gracefully when graph or AI services are unavailable.
- Follow Constitution §7 UI/UX standards: Cursor-inspired density + Claude Desktop simplicity, shadcn/ui primitives, AA contrast, dark/light parity.

## 7. Architecture

The Studio Shell is the outermost layer of the desktop application. It follows the principles in the Ray Studio Engineering Constitution:

- Composition over inheritance.
- Explicit boundaries via IPC.
- The UI layer is intentionally untrusted for privileged operations.
- All data and actions flow through the knowledge graph where possible.

High-level layering (from user outward):

```
User / Keyboard
      │
Studio Shell (this module)
  - Command Palette
  - Layout / Navigation
  - Surfaces (Graph Explorer, AI Workspace, Capture, Inspector)
      │ (typed, validated IPC)
Core Platform Services (Workspace Manager, IPC Framework, etc.)
      │
Knowledge + Gateway Layers
```

**Lifecycle**

Startup
↓
Shell boot (Electron main + renderer initialization)
↓
IPC bootstrap (establish typed contracts with core services)
↓
Workspace load (discover recent projects, apply UI preferences)
↓
Project activation (load last active workspace context)
↓
Surface composition (initialize command palette, default views)
↓
Ready (user can interact; command palette fully available)
↓
Shutdown
↓
Persist UI state (window geometry, open panels, command history)
↓
Graceful termination of renderer and native host

**Failure Dependencies / Resilience**

- If Workspace Manager unavailable → Operate in read-only mode with limited project switching; surfaces remain usable for previously loaded data.
- If Context Engine unavailable → Hide or disable the Context Inspector; AI actions may still be available with reduced context.
- If Provider Router unavailable → Disable all AI-related actions and surfaces while keeping graph exploration and capture functional.
- If IPC Framework unavailable → Shell cannot start; graceful error dialog with restart guidance.

Key decisions:
- Use a webview-based renderer (Electron) for rapid UI iteration while keeping native capabilities isolated.
- Command palette is the unifying interaction primitive (inspired by Raycast).
- Graph visualization is first-class but the shell only renders; retrieval is delegated.
- UI state (open panels, recent commands, theme) is kept separate from project knowledge graph.
- Token efficiency is supported by exposing the Context Inspector so users understand (and can influence) what is sent to models.

References: Constitution §3 (Architecture Principles), §7 (UI/UX, IPC, Performance), docs/002-system-architecture.md, docs/009-ui-design-system.md.

## 8. Folder Structure

```
apps/studio/
├── src/                     # Renderer / UI layer (webview)
│   ├── components/
│   │   ├── ui/              # Design system primitives
│   │   ├── command-palette/
│   │   ├── graph/
│   │   ├── ai/
│   │   └── capture/
│   ├── views/               # Top-level surfaces
│   ├── hooks/
│   ├── lib/                 # UI-only utilities
│   └── main.tsx (or equivalent entry)
├── electron-main/           # Electron main process + preload
│   └── src/                 # Thin native host (window management, IPC bridge)
├── public/
├── package.json
└── ...
```

The shell implementation lives in apps/studio. Shared UI primitives may live in packages/ui (to be defined by later modules).

## 9. Public Interfaces

The Studio Shell defines the following conceptual contracts for interaction with internal modules and extensions (exact TypeScript signatures are reserved for Layer 3 implementation or dedicated API specifications):

**Command Management Contract**
- Inputs: Command definition consisting of unique identifier, human-readable title, optional keywords, and execution logic.
- Outputs: Execution result (success/failure with optional payload).
- Lifecycle: Commands can be registered at startup or dynamically; execution is synchronous or asynchronous as declared.
- Ownership: Shell owns discovery, ranking, and invocation surface. Feature modules own command semantics.

**Surface Navigation Contract**
- Inputs: Target surface identifier and optional parameters.
- Outputs: Navigation state update.
- Lifecycle: Surfaces can be opened, closed, or focused; state is preserved across project switches where appropriate.
- Ownership: Shell owns composition and focus; individual surfaces own their internal content.

**Capture Contract**
- Inputs: User-provided content and optional metadata.
- Outputs: Acknowledgment that capture was routed to the knowledge layer.
- Lifecycle: Available globally; may be scoped by current workspace.
- Ownership: Shell provides the entry point; ingestion is delegated.

**Context Inspection Contract**
- Inputs: Current task context.
- Outputs: Structured view of what will be sent to AI providers.
- Lifecycle: Live-updating based on current selection and graph state.
- Ownership: Shell renders the inspector; content is provided by the context assembly layer.

The shell consumes contracts from lower modules (e.g., current workspace state, read-only graph queries, and typed IPC channels) but never bypasses defined boundaries.

## 10. Internal Components

- CommandPalette: discovery, ranking, execution, history.
- LayoutManager: window chrome, panels, split views, focus management.
- SurfaceHost: composes and switches between major views (GraphExplorer, AIWorkspace, ProjectView, Settings).
- CaptureService: low-friction input that routes directly to graph ingestion via IPC.
- ContextInspector: visualizes the current assembled context for the active task.
- ThemeManager: applies design tokens and dark/light switching.
- KeyboardRouter: global shortcut handling and focus management.

These components interact only through well-defined internal events or the public interfaces above. All cross-process communication goes through the IPC layer.

## 11. Database Schema

The Studio Shell owns zero authoritative data.

Everything it persists is UI cache, preferences, layout, and session state. All such state is non-authoritative, local to the shell, and can be safely discarded or reconstructed without impacting project knowledge.

The shell never writes to the primary knowledge graph or project entities. All persistent project data flows through the designated core platform and knowledge layers.

See docs/006-database-architecture.md for overall graph schema.

## 12. IPC/API Contracts

The shell communicates with the rest of the system exclusively through the IPC Framework (to be defined in 013).

Example contracts the shell will use (to be formalized by the IPC module):

- `workspace:current` — get active project/workspace
- `graph:query` — read-only queries for visualization
- `capture:ingest` — submit user-captured thoughts/decisions
- `context:inspect` — request current context preview
- `ai:session:start` — create scoped AI interaction

All contracts are versioned, validated on both sides, and never expose secrets or raw Node capabilities to the renderer.

## 13. Events

The shell emits:

- `shell:command:executed` (id, success, duration)
- `shell:surface:changed` (surfaceId, params)
- `shell:capture:submitted` (type, targetGraphEntity?)

The shell subscribes to:

- `graph:updated` (to refresh explorers)
- `workspace:changed` (to update title, recent lists)
- `context:changed` (to update inspector)

Event payloads are small and never contain full graph data.

## 14. State Management

- UI-specific state (open panels, command history, theme preference, window geometry) is managed in-memory with optional local persistence.
- Project and knowledge state is never duplicated in the shell; it is always fetched on demand via the graph and lower modules.
- Immutability is preferred for all view models passed to components.
- Navigation state uses a simple history stack with back/forward support.

## 15. Error Handling

- All IPC failures are surfaced to the user with clear, actionable messages and a "Retry" option.
- Command execution errors are shown in the palette or toast without crashing the shell.
- Renderer crashes are isolated; the native host can restart the webview.
- No silent failures. Every user action that touches the graph or AI must produce visible feedback or an explicit error.

## 16. Logging

- Structured logs for command invocations (id, args summary, duration, success).
- Performance marks for cold start, palette open, surface switch.
- Errors with full stack and relevant context (never secrets).
- User-initiated captures and AI sessions are logged at info level for later graph ingestion.

Follow Constitution structured logging expectations.

## 17. Security

- Renderer is treated as untrusted (CSP strict, no nodeIntegration, contextIsolation enforced).
- All privileged operations (file access, API keys, direct DB) stay in the native host.
- Command handlers validate inputs and authorization before delegating via IPC.
- No arbitrary code or path injection from user input or graph data.
- Secrets never cross the IPC boundary into the shell.

See Constitution §7 Security and docs/010-security.md.

## 18. Performance Targets

- Cold start (app launch to usable command palette): < 1.5s on mid-range hardware.
- Command palette open + first results: < 80ms P95.
- Graph view initial render (for graphs up to 5k nodes): < 300ms.
- Context inspector computation and display: < 150ms.
- Memory: shell process < 150MB baseline; renderer process bounded with virtualization.
- All targets assume the graph service is already warm.

See Constitution §7 Performance.

## 19. Dependencies

**Module Maturity:** Architecture Approved

**Required Modules:**
- 009 Workspace Manager
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Current project context and navigation
- 010 Project Manager
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Project lifecycle awareness at shell level
- 013 IPC Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: All cross-boundary communication
- 007 Configuration Service
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Theme, keybindings, provider settings
- 008 Logging Framework
  - Status: Expected
  - Contract Version: 1.x
  - Purpose: Structured shell logging

**Required Services:**
- Secure IPC transport (provided by IPC Framework)
- Local UI state persistence (lightweight, non-graph)

**Required Packages:**
- packages/ui (design system primitives — to be defined alongside shell)
- apps/studio (host application)

**Required APIs:**
- Typed IPC contracts for workspace, graph read, capture, and context inspection (defined by IPC and core modules)

**Provides:**
- Command registration and execution surface for all features
- Composable UI surfaces and navigation
- Context inspector for transparency
- Capture entry points that feed the knowledge graph

**Consumers:**
- All user-facing modules (Graph Explorer, AI Workspace, Capture flows, Settings)
- Future plugin/extension system
- External AI clients that may request UI-triggered actions

**Other notes:**
- Hard dependency on the platform Core (IPC, Workspace, etc.) as defined by the reprioritized Layer 2 order.
- Soft dependency on graph visualization libraries (chosen during UI module work).
- No direct dependency on Context Engine, Memory Engine, or Provider Router at this layer.

## 20. Testing Strategy

- Unit tests for command registration, ranking, and execution logic.
- Component tests for palette, surfaces, and inspector using the project's standardized component testing approach.
- Integration tests exercising IPC round-trips (mocked native side).
- E2E flows: launch → palette → capture → graph update visible; context inspector matches actual sent payload.
- Performance benchmarks for cold start and command latency (automated in CI).
- Accessibility and keyboard navigation automated where tooling permits.
- Visual regression for key surfaces (optional but recommended).

Detailed executable test cases, benchmarks, security checks, and cross-module flows are defined in `prompts/validation/001-studio-shell.validation.md` (Layer 4). This Layer 2 Testing Strategy is implemented by satisfying the Layer 4 spec.

## 21. Acceptance Criteria

- A user can launch the application and immediately invoke any core action via the command palette without using the mouse.
- Opening the context inspector shows an accurate, explainable representation of what would be sent for the current task.
- A quick capture via global hotkey successfully writes to the knowledge graph and appears in relevant explorers.
- Switching projects updates all surfaces and the command palette scope correctly.
- The shell remains responsive and within memory targets while a large project graph is loaded in the background.
- All keyboard shortcuts are discoverable and conflict-free.
- The application follows the approved UI design system and Constitution standards.

## 22. Definition of Done

- Satisfies the project-wide Definition of Done in the Ray Studio Engineering Constitution §9.
- The specification has been self-reviewed against the Constitution (see below).
- Architectural consistency with docs/002, docs/003, docs/004, docs/007, docs/009, and the reprioritized Core Platform order has been verified.
- No placeholder content remains in this specification.
- The spec is committed inside prompts/modules/ following the approved structure.
- Relevant sections of the Constitution were explicitly considered (token optimization, UI/UX, IPC, performance, documentation rules).

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).