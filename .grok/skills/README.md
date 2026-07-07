# Ray Studio — Grok Skills (Project Scope)

These skills are installed at the project level (`.grok/skills/`) and are automatically available when working inside this repository.

They enforce the **Sprint 1 rules** and the deterministic pipeline defined in:
- `AGENTS.md`
- `docs/000-current-status.md`
- `project-status.json`
- `implementation-manifests/`
- `Ray Studio Engineering Constitution.md`

**Priority order for use (as recommended):**

1. **module-implementation** (Highest Priority)  
   Use for *every* coding session. Enforces full pipeline + 7 gates.

2. **architecture-compliance-review**  
   Review-only. Checks Constitution, boundaries, IPC, drift, etc. Produces PASS/FAIL.

3. **build-repair**  
   After impl or when red: build → lint → typecheck → test loop until green.

4. **module-validation**  
   Validates against manifest, module spec, acceptance criteria, DoD.

5. **merge-readiness**  
   Final pre-merge verification of all gates + evidence + docs + risks.

6. **repository-navigation**  
   Finds relevant files, deps, consumers, tests, docs, related modules (graph-first).

7. **electron-ui-review**  
   Specialized for Studio Shell: layout, a11y, palette, dark mode, IPC safety, perf.

8. **refactoring**  
   Quality/readability/maintainability only. **Never** changes arch, contracts, or ownership.

9. **documentation-sync**  
   Keeps README, 000-current-status, handoff, summaries in sync (no arch changes).

10. **security-review**  
    Electron main, IPC, secrets, SQLite, FS, isolation, injection, validation.

## Usage

- Skills load automatically when intent matches the `description`.
- Explicit: `/module-implementation`, `/architecture-compliance-review`, etc.
- TUI: skills menu.

These skills implement the exact workflows requested for disciplined, zero-drift Sprint 1 execution.
One module. One review. All gates green.

See individual `SKILL.md` for full responsibilities and output formats.
