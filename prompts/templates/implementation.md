# Ray Studio Layer 3 — Standardized Implementation Prompt

**You are implementing the following module.**

You have already read (per AGENTS.md + Current Status):
- AGENTS.md
- docs/000-current-status.md
- The module's `implementation-manifests/<MODULE-ID>-<name>.json`

**Mandatory inputs (exactly as declared in the manifest):**
- All files listed under `required` in the manifest.
- Ray Studio Engineering Constitution (Layer 1)
- Module Specification (Layer 2)
- Implementation Template (this file)
- Paired Validation Specification (Layer 4) — use it as your acceptance checklist.

**Context:**
- Use only graph-retrieved symbols, summaries, and the two documents above.
- Follow the Constitution exactly, especially §4 (Token Optimization), §5 (Repository & Monorepo Standards), and §9 (Definition of Done).
- Do not modify unrelated modules.
- Implement only within the approved scope defined in the Module Specification.
- Produce production-ready code. No TODOs, placeholders, or mocks unless explicitly allowed in the spec.
- Maintain backward compatibility where defined.
- Update tests, documentation, and the knowledge graph as required.

**Module being implemented:** <MODULE-ID> — <Human Readable Name>

**User request / task:**
<PASTE THE SPECIFIC TASK HERE>

**Validation requirement:** The implementation must satisfy every case, benchmark, edge condition, and DoD check listed in the paired Layer 4 validation spec above. Verification will be performed against that document.

**Additional constraints for this task:**
- [List any task-specific constraints here]

**Output requirements:**
- Smallest correct change that satisfies the request and the Module Specification.
- Explicitly reference which sections of the Constitution and Module Spec you are satisfying.
- At the end, confirm that the change meets the Definition of Done for this module.

Proceed only after confirming:
- You have loaded the module's implementation-manifest.json
- You are loading exactly the declared required files (plus graph symbols)
- You understand the forbidden modules

Then load the Constitution and the relevant Module Specification from the manifest.