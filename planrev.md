# Plan: Resume Module 016 SQLite — Validate → Review → Merge → Freeze

**Exported:** 2026-07-10
**Source session plan:** resume compact handoff · Module 016 Phase 1 gates
**Repo:** `F:\Projects\Ray-studio Creations\Ray Studio`
**HEAD (at plan):** `main` @ `8074b3d` · tag `core-platform-001-013-complete` · not pushed

---

## Context

Ray Studio Sprint 1 / Phase A. Modules **001–013 are frozen** (`main` @ `8074b3d`, tag `core-platform-001-013-complete`, not pushed). **Sole active module is 016 SQLite Layer.**

Phase 1 implementation is already in the working tree (**uncommitted**, not Layer-4 validated, not merged):

| Area          | Paths                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Domain        | `packages/core/src/db/**` (13 files: connection, migrations, repos, service, transactions, errors, tests) |
| IPC contracts | `packages/core/src/ipc/contracts/index.ts` (`db:*@1.0`)                                                   |
| Exports       | `packages/core/src/index.ts`                                                                              |
| Studio wiring | `apps/studio/electron-main/main.ts` (handlers + userData DB path + `db` capability)                       |
| Status docs   | `docs/handoff.md`, `docs/000-current-status.md`, `project-status.json` (synced to handoff state)          |
| Lockfile      | `pnpm-lock.yaml` (may include noise from earlier native-driver attempts)                                  |

**Driver decision (already made):** Node `node:sqlite` via `process.getBuiltinModule` (no better-sqlite3; native rebuild failed). Electron 31 may lack runtime SQLite → `DB_UNAVAILABLE` path is intentional Phase 1 ceiling.

**Goal of this session:** Finish the proven pipeline for 016 only — re-verify gates → Layer 4 validation → architecture (+ IPC) review → merge-readiness → independent merge sequence → post-merge freeze. **Do not** implement Phase 2 (consumer swap, backup, perf CI), 101+, Memory, or Providers.

Truth sources (do not trust prior chat alone): `docs/handoff.md`, `project-status.json`, `docs/000-current-status.md`, Constitution, git.

---

## Scope Declaration (Scope Guard)

```
Active Module:
016 SQLite Layer

Allowed (edits only if validation/review finds defects):
✓ packages/core/src/db/**
✓ packages/core/src/ipc/contracts/index.ts  (db:* contracts only)
✓ packages/core/src/index.ts               (re-exports only)
✓ apps/studio/electron-main/**             (db wiring / capability only)
✓ history/016-*.md                         (gate artifacts at gate time)
✓ docs/handoff.md, docs/000-current-status.md, project-status.json  (at merge/finalize only)

May Read:
✓ Constitution, AGENTS.md, project-status.json, docs/000-current-status.md, docs/handoff.md
✓ implementation-manifests/016-sqlite-layer.json
✓ prompts/modules/016-sqlite-layer.md
✓ prompts/validation/016-sqlite-layer.validation.md
✓ prompts/templates/implementation.md
✓ docs/006-database-architecture.md (optional)
✓ history/013-*.md (pattern reference)
✓ Frozen 009–013 surfaces for boundary checks only

Forbidden:
✗ 101+ / Memory / Providers / process expansion
✗ Coupling DB to Context Engine or Provider logic
✗ Replacing InMemory stores in 009/010 (Phase 2)
✗ Committing apps/studio/electron-main/preload.* build artifacts blindly
✗ Push to origin without explicit user request
✗ Expanding workflow/skills/Constitution docs
```

**Manifest:** `implementation-manifests/016-sqlite-layer.json`
**dependsOnModules:** 009, 010, 011, 013 (all frozen)
**forbidden modules:** 101*, 102*, 201*, 301*

This session is constrained to the declaration above.

---

## Recommended Approach

Follow the **existing proven cadence** (same as 011–013). No process redesign.

```
Re-verify gates
  → module-validation (Layer 4) → history/016-validation.md
  → architecture-compliance-review (+ ipc-contract-reviewer + security-review for SQLite)
       → history/016-arch-review.md (or 016-review.md)
  → merge-readiness → history/016-merge-readiness.md
  → Independent merge decision (do not reorder):
       commit feat 016 → branch before-016-merge → commit gate artifacts
       → clean tree → FF merge main → tag core-platform-001-016-complete
       → post-merge-finalizer / documentation-sync → freeze 016
```

**Rejected alternative:** Start Phase 2 consumer integration or 101 Context Engine while 016 is unmerged. Violates one-active-module, assessment order, and handoff Watch Outs.

---

## Execution Steps

### 1. Bootstrap (read-only)

- Confirm `project-status.json` → `nextModule: "016"`, HEAD `8074b3d`, dirty tree for 016 paths.
- Inventory uncommitted set; **exclude** untracked `preload.js` / `preload.d.ts` / maps unless project policy requires them (handoff: treat as build output).
- Note `pnpm-lock.yaml` delta — only keep if required by Phase 1 deps; drop noise if pure better-sqlite3 experiment residue (verify before commit).

### 2. Re-verify gates (must re-run; prior 35/35 is stale)

From repo root `F:\Projects\Ray-studio Creations\Ray Studio`:

| Gate         | Command (expected)                                                          |
| ------------ | --------------------------------------------------------------------------- |
| Core build   | `pnpm --filter @ray-studio/core build`                                      |
| Core lint    | `pnpm --filter @ray-studio/core lint`                                       |
| Core test    | `pnpm --filter @ray-studio/core test` → expect **35/35** (10 new 016)       |
| Studio build | `pnpm --filter @ray-studio/studio build` (or project’s studio package name) |
| Typecheck    | core `tsc --noEmit`; studio renderer/main as for 013                        |

If red → **build-repair** only within allowed paths. If green → proceed.

### 3. Layer 4 validation (`module-validation`)

Inputs:

- Manifest + `prompts/modules/016-sqlite-layer.md` + `prompts/validation/016-sqlite-layer.validation.md`
- Constitution §9 DoD
- Implemented tree + gate evidence

Map FT cases to evidence:

| FT                       | Expected evidence                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| FT-001 Boot + migrations | `db.test.ts` memory + file reopen; `MigrationRunner`; schema v1 idempotent                      |
| FT-002 CRUD via IPC      | repos + contracts `db:project:*`, `db:workspace:*`, `db:config:*`, `db:ingestion:*@1.0`         |
| FT-003 Scoping           | `DatabaseService.setScope` + `SCOPE_VIOLATION` tests                                            |
| FT-004 Fast lookups      | unit path; note Phase 1 may mark formal P95 microbench as partial / deferred with justification |

Also check: parameterized SQL only, no renderer sqlite, `dbErrorToIpc` envelope, capability `db`, WAL for file DBs, no graph/raw file content storage.

**Output:** `history/016-validation.md` (mirror structure of `history/013-validation.md`).
Verdict: Ready for arch review? YES/NO + blockers.

**Phase 1 explicit non-failures** (document, do not expand scope):

- Backup/recovery, consumer swap of InMemory 009/010, measured P95 CI benches, native driver adapter for Electron 31.

### 4. Architecture + IPC + security reviews

Skills (review-only):

- `architecture-compliance-review`
- `ipc-contract-reviewer` (db namespace ownership, `@1.0` naming, cap → schema → dispatch)
- `security-review` (SQLite path, no SQL injection, renderer isolation, secrets not logged)
- Optionally `dependency-boundary-checker` / `constitution-compliance-checker`

**Output:** `history/016-arch-review.md` (or `016-review.md` matching 013 style).
PASS required before merge-readiness. FAIL → fix only allowed paths → re-gate → re-review.

### 5. Merge readiness

Skill: `merge-readiness`. Produce `history/016-merge-readiness.md`.

Checklist:

- All gates green with fresh evidence
- Arch + IPC reviews PASS
- One-active-module respected (diff only 016 surfaces + gate docs)
- Forbidden higher modules untouched
- Risks accepted (node:sqlite / Electron 31 ceiling documented)
- Preload artifacts **not** staged unless intentional

**Merge Approved** only when clean.

### 6. Independent merge sequence (after explicit Approve)

Do **not** reorder:

1. Commit Module 016 implementation (feat message; exclude build junk).
2. Create rollback branch `before-016-merge` at pre-feat or per 013 pattern (`before-013-merge` pointed at feat commit — match project’s proven pattern for 013).
3. Commit gate artifacts (`history/016-*.md` if not already with feat).
4. Verify clean working tree.
5. Fast-forward on `main` (already on main with uncommitted work — effectively sequential commits on main, same as prior modules).
6. Tag: `core-platform-001-016-complete`.
7. Run **post-merge-finalizer** + **documentation-sync**:
   - `project-status.json` mergeMetadata for 016; freeze 016; set next module only when Phase A complete (likely Phase B / 101 — **do not start implementing 101**)
   - `history/016.md` summary
   - Update `docs/000-current-status.md` + `docs/handoff.md`
8. **Do not push** unless user explicitly requests.

### 7. Stop condition

After freeze: Phase A Core Platform complete for modules 001–016. Handoff should state “016 frozen; next is Phase B only when authorized — do not start 101 until user says so.” Session may end there.

---

## Critical Files

### Implementation (already present; touch only on defect)

- `packages/core/src/db/service.ts` — facade, scope, lifecycle
- `packages/core/src/db/connection.ts` — open/close, WAL, busy timeout
- `packages/core/src/db/migrations/**` — `0001_initial`, runner
- `packages/core/src/db/repositories/*.ts` — workspace, project, config, ingestion
- `packages/core/src/db/transaction.ts`, `errors.ts`, `types.ts`
- `packages/core/src/db/db.test.ts` — FT coverage
- `packages/core/src/ipc/contracts/index.ts` — `db:*@1.0` contracts
- `apps/studio/electron-main/main.ts` — register handlers + grant capability

### Gate artifacts (to create)

- `history/016-validation.md`
- `history/016-arch-review.md` (or `016-review.md`)
- `history/016-merge-readiness.md`
- `history/016.md` (post-merge)

### Status (finalize only)

- `project-status.json`, `docs/handoff.md`, `docs/000-current-status.md`

### Patterns to reuse

- `history/013-validation.md`, `history/013-review.md`, `history/013-merge-readiness.md`, `history/013.md`
- 013 merge metadata shape in `project-status.json`
- `IpcServer` capability/schema/dispatch ordering from packages/core IPC

---

## Defect Fix Policy (if gates fail)

| Class                          | Action                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| Build/lint/test failure in 016 | Fix root cause in `packages/core/src/db/**` or contract wiring only  |
| Spec gap for Phase 1 AC        | Minimal code fix; re-run tests                                       |
| Phase 2 feature missing        | Document as deferred — do not implement                              |
| Frozen module drift            | Stop; report; do not “fix” frozen code unless true defect authorized |

---

## Verification (end-to-end)

1. Fresh gate commands all green (section 2).
2. Validation report maps every FT + security/IPC checklist item to file/test evidence.
3. Arch review PASS with no Context/Provider coupling and no renderer SQLite.
4. `git status` clean after merge sequence; tag `core-platform-001-016-complete` present.
5. `project-status.json`: 016 merged/frozen; `sessionHandoff` accurate.
6. Diff audit: no files outside Scope Declaration in the 016 commit set.

---

## Watch Outs (non-negotiable)

- One active module: **016 only**.
- No 101+ / Memory / Providers / process expansion.
- No DB ↔ Context/Provider coupling.
- Do not commit preload build outputs blindly.
- Do not push origin without user ask.
- `constitution:check` pre-existing wiring debt: do not expand process docs to paper over it.
- Independent merge order must not be reordered once validation passes.

---

## Session Memory (after approval, during execution)

Per nemo-rl-session-memory: create/update `session/<timestamp>/` under Ray Studio or `F:\Projects\session` only if useful; prefer project `docs/handoff.md` as durable truth. Checkpoint after validation report and after merge.

---

## Success Criteria

- [ ] Gates re-verified green on current tree
- [ ] `history/016-validation.md` PASS (Phase 1)
- [ ] Architecture + IPC + security review PASS
- [ ] Merge-readiness **Merge Approved**
- [ ] Commits + `before-016-merge` + tag `core-platform-001-016-complete`
- [ ] Post-merge finalizer: 016 frozen in status/handoff/history
- [ ] No forbidden module work; no push unless requested

---

**End of plan export.** Resume docs: `docs/handoff.md` · `project-status.json` · `docs/000-current-status.md`
