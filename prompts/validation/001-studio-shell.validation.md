# 001 — Studio Shell Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/001-studio-shell.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

Provides concrete, objective test cases, benchmarks, and checks that any implementation of the Studio Shell **must** satisfy. This document removes interpretation risk.

All acceptance criteria and test cases herein derive directly from the Layer 2 spec's Functional Requirements, Non-Functional Requirements, Performance Targets, Testing Strategy, and Acceptance Criteria.

## 2. References

- Ray Studio Engineering Constitution §9 (Definition of Done), §7 (Performance), testing & security standards
- Layer 2: 001-studio-shell.md (FR 1-10, Perf targets, AC)
- Layer 2 dependencies: 013 IPC Framework, 009 Workspace Manager, 010 Project Manager, 011 File System Service, 012 File Watcher
- Related validation specs: 013.validation.md (IPC contracts & ordering), 009.validation.md, 010.validation.md, 011.validation.md

## 3. Functional Test Cases

**FT-001: Application launch and initial usability**
- Preconditions: Fresh launch on supported desktop platform, no prior user data.
- Steps: Launch app → wait for shell readiness.
- Expected: Cold start completes with usable command palette visible and responsive. No crashes, no placeholder UI.

**FT-002: Global command palette discoverability and invocation**
- Preconditions: App running, at least one workspace/project active.
- Steps: Invoke palette (keyboard or UI) → type partial command → select and execute a core action (e.g. capture or context inspect).
- Expected: Palette opens < 80ms P95, results appear, action executes via IPC, feedback shown. All registered commands discoverable. Keyboard-only flow works.

**FT-003: Multi-surface composition and project scoping**
- Preconditions: Workspace + project active.
- Steps: Switch surfaces (graph explorer, AI workspace, capture, settings) → switch project → verify scoping.
- Expected: Surfaces update correctly. Active project/workspace context is reflected in all surfaces and command palette scope. No cross-project leakage.

**FT-004: Capture flow end-to-end (hotkey + graph write)**
- Preconditions: Active project, IPC + lower layers ready (mocked or real).
- Steps: Trigger global hotkey capture → enter text → submit.
- Expected: Input written to knowledge graph via validated path. Event appears in explorers. Provenance shown in UI.

**FT-005: Context inspector accuracy**
- Preconditions: Current task context assembled.
- Steps: Open context inspector.
- Expected: Displays accurate graph data, summaries, and Constitution references that would be sent. < 150ms computation/display. No secrets leaked.

**FT-006: Keyboard navigation and accessibility**
- Steps: Full keyboard traversal of shell, palette, major surfaces. Theme toggle.
- Expected: All primary actions keyboard accessible. Follows design system. High contrast supported. No focus traps.

**FT-007: Command registration and extension points**
- Preconditions: Shell initialized.
- Steps: Register custom command from a consumer surface → invoke via palette.
- Expected: Command appears, executes correctly, respects capability boundaries.

## 4. Edge Cases and Error Conditions

- Launch with corrupted local state or missing dependencies → graceful degradation, clear user message, no crash.
- Command execution fails downstream (e.g. IPC consumer unavailable) → deterministic error via standard envelope, UI feedback, no unhandled promise.
- Rapid project switches during background operations → state machine prevents invalid transitions; last-wins or queued correctly.
- Large graph (5k+ nodes) render in explorer → virtualized, remains responsive.
- Palette search with no matches or many results → graceful UI, no performance degradation.

## 5. Performance Benchmarks & Measurement

Targets (from Layer 2; verify with automated instrumentation):
- Cold start (launch → usable command palette): < 1.5s on mid-range hardware.
- Command palette open + first results: < 80ms P95.
- Graph view initial render (≤5k nodes): < 300ms.
- Context inspector: < 150ms.
- View transitions: < 200ms.
- Memory: shell < 150MB baseline; renderer bounded.

**Verification method:** Instrumented CI runs (e.g. Playwright + performance marks), automated benchmarks on representative hardware profile. Fail build if P95 breached.

## 6. Security, Boundary & IPC Checks

- All privileged actions go exclusively through 013 IPC contracts (no direct Node/FS/graph access from renderer).
- Context inspector and capture flows carry validated scope only.
- No secrets, full paths outside scope, or raw privileged data ever rendered to untrusted surfaces.
- Capability checks + schema validation + dispatch ordering (see 013.validation.md) enforced for every crossing.
- Global hotkeys and capture entry points are sandboxed; input sanitized before IPC.

**Test:** Attempt direct privileged calls from renderer (must be blocked). Inspect IPC traffic for every user action.

## 7. Resilience, Lifecycle & Shutdown

- App shutdown during active capture or graph op → graceful drain, no data loss for committed actions, clean IPC close.
- Background ingestion or graph load during heavy UI interaction → shell stays responsive.
- IPC service (e.g. FS) becomes unavailable mid-session → clear "unavailable" error category, surfaces degrade gracefully, no renderer crash.
- Restart after abrupt kill → recent state and open surfaces restored appropriately (where specified).

## 8. Observability & Provenance Requirements

- Every user action and AI-assisted flow must expose correlationId traceable through IPC.
- Context inspector must show exactly what will be sent (graph slices + Constitution refs).
- Structured logs for shell lifecycle, command execution, surface switches (sanitized).
- Performance metrics (duration at boundary) emitted for key paths.

## 9. Integration & Cross-Module Scenarios (E2E)

- Launch → open workspace (009) → activate project (010) → FS validation (011) → capture → graph visible → context inspect → switch project → all surfaces update.
- Command palette action that triggers watcher (012) or SQLite (016) → event propagates back.
- Full failure matrix cases for IPC (see 013.validation.md) exercised from shell surfaces.

## 10. Definition of Done Verification Checklist

Must satisfy **all**:
- [ ] Constitution §9 DoD (build, lint, types, tests, perf targets, no TODOs/placeholders, docs, constitution:check, graph ingest).
- [ ] All FT-001..007 and edge cases pass.
- [ ] All performance targets met (P95) in automated runs.
- [ ] Security/boundary/IPC checks pass (no bypasses).
- [ ] Resilience and shutdown scenarios pass.
- [ ] Observability and provenance requirements met.
- [ ] Layer 2 Acceptance Criteria (001-studio-shell.md §21) fully demonstrated.
- [ ] Relevant validation cases from dependent modules (009,010,011,013,016) exercised.
- [ ] Explicit reference in implementation to this validation spec + Layer 2.

**Verification owner:** Separate verification agent or CI step must sign off against this document before merge.

---

**Notes:** This spec is the single source of truth for "done" for the Studio Shell implementation. Update only via ADR when Layer 2 changes.
