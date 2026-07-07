# Module Specification Template

> **Copy this file** to create a new module spec (e.g. `101-context-engine.md`).
> Replace all placeholders.
> Every section is mandatory.
> Follow the Ray Studio Engineering Constitution for all principles, especially token optimization, production-ready code, and the layered prompt system.

**Module ID:** XXX-Name  
**Status:** Draft / In Progress / Stable  
**Owner:** [Team or Person]  
**Last Updated:** YYYY-MM-DD  
**Related Packages:** packages/xxx, apps/studio, etc.

---

## 1. Purpose

[One or two paragraphs explaining why this module exists and the problem it solves.]

## 2. Responsibilities

- Bullet list of primary responsibilities.
- What this module owns exclusively.

## 3. Scope

- In scope items.
- Clear boundaries.

## 4. Non-Goals

- Explicit things this module will **not** do (at least in this phase).

## 5. Functional Requirements

- Numbered list of must-have functional behaviors.
- Each should be testable.

## 6. Non-Functional Requirements

- Performance, reliability, scalability, etc.
- Must align with Constitution performance and security standards.

## 7. Architecture

[High-level description, diagrams in text or mermaid if useful, key design decisions. Reference Constitution architecture principles.]

## 8. Folder Structure

```
packages/xxx/
├── src/
│   ├── ...
docs/ or prompts/ references if needed.
```

## 9. Public Interfaces

[List of main exported functions, classes, types, or APIs. Use TypeScript-style signatures where possible.]

## 10. Internal Components

[Breakdown of major internal pieces and their interactions.]

## 11. Database Schema

[If applicable: tables, graph entity/relationship models, indexes, migrations notes. Align with docs/006-database-architecture.md.]

## 12. IPC/API Contracts

[Typed contracts, channel names (for IPC), REST endpoints if any, versioning. Follow Constitution IPC and API standards.]

## 13. Events

[Events this module emits or subscribes to. Event names, payloads, direction.]

## 14. State Management

[How state is managed (in-memory, persisted, etc.). Immutability expectations.]

## 15. Error Handling

[Error types, propagation rules, user-facing vs internal errors. No silent failures.]

## 16. Logging

[What must be logged at which levels. Structured logging requirements per Constitution.]

## 17. Security

[Threat model items specific to this module. Input validation, authz, secrets handling, etc.]

## 18. Performance Targets

[Specific measurable targets: latency, memory, throughput, cold start, etc. See Constitution §7.]

## 19. Dependencies

- Hard dependencies on other modules/packages.
- Soft / optional.
- External libraries (with justification).

## 20. Testing Strategy

- Unit, integration, E2E, performance, security, accessibility as applicable.
- Test data / fixtures approach.
- How this module will be validated (reference the paired Layer 4 <id>.validation.md in ../validation/ when it exists; for new modules, the validation spec should be created before implementation begins).

## 21. Acceptance Criteria

- Clear, verifiable criteria for when this module is considered complete.
- Must tie back to Functional + Non-Functional Requirements.

## 22. Definition of Done

- Must satisfy the project-wide Definition of Done in the Constitution.
- Additional module-specific items.

---

**Notes for Authors:**
- Keep specs focused and reasonably sized.
- Use the exact section headings above.
- All specs must be consistent with the Ray Studio Engineering Constitution (Layer 1).
- When implementing, the Layer 3 prompt will reference this spec + the Constitution.
- Update this spec when requirements or architecture change (via ADR process).