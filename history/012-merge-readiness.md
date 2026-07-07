# Module 012 — File Watcher Merge Readiness

**Date:** 2026-07-08
**Performed after:** Implementation ✅ + Validation ✅ + Architecture Review (qualified) ✅
**Verdict:** Merge Readiness Approved (pending explicit user authorization for Before Merge Fallback branch + commits)

## Verified (per merge-readiness/SKILL.md + frozen Sprint 1 workflow + pasted authorization)

- Build (Gate 1+2): ✅ `pnpm --filter @ray-studio/core build` — tsc clean
- Tests (Gate 4): ✅ `pnpm --filter @ray-studio/core test` — 17/17 pass (4 watcher FTs covering lifecycle, setWatches, create/modify/delete events)
- Typecheck (Gate 3): ✅ core + studio (`tsc --noEmit`)
- Architecture review (Gate 5): ✅ APPROVED WITH NO IDENTIFIED ARCHITECTURAL DRIFT (per pasted review; based on implementation summary + this validation report + governance evidence). Note: highest-standard independent code inspection of diff/source available in this package (see Evidence below).
- Documentation updated (Gate 6): ✅ `history/012-validation.md` created, `docs/000-current-status.md` (012 status + next steps), minimal living doc sync. No spec or Constitution changes.
- Only expected areas touched for 012: ✅ (packages/core/src/watcher/** + apps/studio/src/watcher/useFileWatcher.ts + minimal core export + App.tsx demo commands + history artifact + status update)
- No forbidden files: ✅ (no 013+ implementation, no 101/201/301 series, no 011/010/009 edits)
- No drift from frozen baselines (AGENTS.md, Constitution, manifests, prompts, 00x docs): ✅
- dependsOnModules state compatible: ✅ (011 provides validated roots; 013 transport deferred with explicit comments; 009/010 consumers via roots)
- IPC / transport ownership: ✅ (pure listener/subscribe model; no IPC contracts, no preload/main changes)
- Security model: ✅ Only watches roots supplied by caller (who performed 011 validation flow). No own path validation. Bounded recursive attach under validated roots. Sanitized logging. Explicit dispose.
- Evidence package: complete (validation report, supplied reviews, fresh gates, full change set, actual diffs of tracked changes, source file inspection)

## Full Change Set (Evidence for Independent Inspection)

**Added (new module + artifacts):**
A       apps/studio/src/watcher/useFileWatcher.ts
A       history/012-validation.md
A       packages/core/src/watcher/index.ts
A       packages/core/src/watcher/types.ts
A       packages/core/src/watcher/watcher.test.ts
A       packages/core/src/watcher/watcher.ts

**Modified (integration + living docs):**
M       apps/studio/src/App.tsx          (+57 lines: 3 demo commands + imports after 011 fs commands)
M       docs/000-current-status.md       (012 status rows + date + next-work text)
M       packages/core/src/index.ts       (+1 line: `export * from './watcher/index.js';`)

**Tracked diff --stat (HEAD):**
```
 apps/studio/src/App.tsx    | 57 ++++++++++++++++++++++++++++++++++++++++++++++
 docs/000-current-status.md |  8 +++----
 packages/core/src/index.ts |  1 +
 3 files changed, 62 insertions(+), 4 deletions(-)
```

**New files summary (module core):**
- `packages/core/src/watcher/types.ts` — FsChangeEvent (fs:change:created|modified|deleted|renamed@1.0 + overflow), FileWatcherState, subscribe contract
- `packages/core/src/watcher/watcher.ts` — FileWatcher class (native fs.watch + manual recursive + debounce + best-effort rename heuristic + listeners + setWatches + dispose). Heavy `ponytail:` comments.
- `packages/core/src/watcher/watcher.test.ts` — 4 FTs (idle, events on real tmp FS, update watches, dispose)
- `packages/core/src/watcher/index.ts` — barrel
- `apps/studio/src/watcher/useFileWatcher.ts` — thin singleton wrapper (init/update/subscribe/dispose/getState) with "ponytail until 013" comments. Relies on validated roots from 011 sequence.

**Key tracked diff excerpts (actual code changes):**

```diff
diff --git c/packages/core/src/index.ts ...
+export * from './watcher/index.js';
```

```diff
diff --git c/apps/studio/src/App.tsx ...
+import { ... } from './watcher/useFileWatcher'
...
+    // 012 File Watcher demos (ponytail: direct until 013; only on 011-validated roots)
+    { id: 'watcher-activate', ... initFileSystem + initFileWatcher([root]) + subscribe ... },
+    { id: 'watcher-status', ... },
+    { id: 'watcher-dispose', ... }
```

(Full unified diff of tracked files available on request or by running `git diff HEAD` in workspace. New files are the complete watcher implementation.)

## Key Confirmations (from validation report + supplied reviews)

**Responsibility boundaries (exact match to spec + review criteria):**
- 012 owns: watcher lifecycle, subscriptions, canonical event emission, resource cleanup.
- Does **not** own: validation (011), parsing, indexing, persistence, graph, transport (013), retry, project/workspace state.

**Dependency direction:**
011 File System Service (validated roots) → 012 File Watcher (detection + events) → 013 IPC (future) → consumers. Preserved.

**Security / no unauthorized traversal:**
- All watches established only on roots passed by caller.
- attachWatchTree / readdir strictly under provided root.
- No calls into 011 validator (correct — caller contract).
- dispose + closeAllWatches explicit on every setWatches and shutdown.

**Lifecycle & resource management:**
- States: idle | watching | error | disposed
- setWatches cleanly replaces (close prior)
- subscribe returns unsub fn
- dispose clears listeners + watches + maps

**Event model:**
- Versioned canonical (`fs:change:...@1.0`)
- Minimal payload + root for scoping
- Transport independent (stdlib listeners today)

**Ponytail + Constitution:**
- Native fs + stdlib first (no chokidar).
- `ponytail:` comments with upgrade path documented.
- Structured `[module=file-watcher] phase=...` logs + sanitize().
- Small surface. No speculative abstractions.
- Matches priorities: Safety/Security/Correctness first.

**Scope discipline:**
Nothing from 013 or later. No Context/Memory/Provider. Matches "Only one active module: 012".

## Evidence Package (for highest-standard review)

- `history/012-validation.md` (full FT coverage, gates, spec mapping, security checklist, DoD — PASS)
- This file (`history/012-merge-readiness.md`)
- Supplied reviews (pasted):
  - Review of the Implementation Summary (Decision: APPROVED WITH NO IDENTIFIED ARCHITECTURAL DRIFT; proceed to Merge Readiness)
- Fresh gate runs (2026-07-08): 17/17 tests, clean build, typecheck, lint
- Actual source: packages/core/src/watcher/* + useFileWatcher.ts (readable now)
- Actual diffs: above + full `git diff` in workspace
- project-status.json (nextModule=012, 011 frozen)
- docs/000-current-status.md (current state)

**Note on Architecture Review standard:** As explicitly stated in the authorizing review, the APPROVED decision was based on implementation summary + validation report. The materials above (diffs + source + validation deep inspection) now enable fully independent code-level review of the actual implementation.

## Risks
- None blocking.
- Pre-existing (unrelated to 012): constitution check failures on .zed / .github instruction files and project-status.json comments.
- Native watcher rename correlation is best-effort (documented, acceptable per spec for current platform support; upgrade path noted).
- Demo commands in App.tsx (consistent with prior modules; volume will justify extraction later).

## Recommendation

**Merge Readiness: APPROVED**

All objective gates, boundaries, scope, dependency direction, security, and DoD verified.

**Do not execute any of the following without explicit next authorization ("yes" / "proceed with Before Merge Fallback")** because they are hard-to-reverse or affect shared state:
- `git checkout -b before-012-merge`
- `git add` of the watcher files + history/012-validation.md + doc updates
- Any commits
- Merge, tag, or status updates to project-status.json / history/012.md

**When next authorized (Before Merge Fallback):**
1. Create `before-012-merge` branch (safety snapshot at current readiness state)
2. Scoped staging + commit(s) of exactly the change set above + readiness artifact
3. Then proceed to Independent Merge Review + --ff-only merge on main, tag (`core-platform-001-012-complete` or similar), history/012.md population, project-status mergeMetadata, freeze 012, activate 013.

This continues the proven pattern from 001 / 009 / 010 / 011 with zero deviation.

**Current branch remains main (pre any 012 merge actions). Working tree reflects the complete validated implementation + validation/merge-readiness artifacts.**

Ready for explicit Before Merge Fallback authorization. Provide `git diff` / source files were already supplied in this package for any final pre-fallback inspection.

## Before Merge Phase Fallback Branch (Executed)

**Created & approved:** 2026-07-08  
**Branch name:** `before-012-merge`  
**Commit:** `20673bffaeb2984a16bc08f578eac231b949fabe` (short: 20673bf)  
**Purpose:** Official Before Merge Phase rollback / safety snapshot at the moment all gates (implementation, validation, architecture review, merge-readiness) were passed.

This branch contains the complete prepared Module 012 state:
- Full File Watcher implementation (`packages/core/src/watcher/**`)
- Thin Studio wrapper (`apps/studio/src/watcher/useFileWatcher.ts`)
- Minimal demo wiring in App.tsx + core barrel export
- All 012 review artifacts (`history/012-validation.md`, `history/012-merge-readiness.md`)
- Pre-merge documentation state (`docs/000-current-status.md`) reflecting Merge Readiness complete
- Confirmed boundaries (011-validated roots only, transport-independent events, explicit lifecycle + cleanup)

**Current branch:** `before-012-merge`

**Why this branch:**
- `main` remains at the pre-012-merge baseline (post 011 only).
- Provides instant, named rollback point before any merge commit lands on main.
- Follows the project's checkpoint discipline (before-011-merge, before-010-merge, etc.).

**Approval:** Explicitly authorized in the "Before Merge Fallback Decision" review.

**Current status:** Fallback branch created and state captured with clean working tree. Awaiting next authorization for Independent Merge Review + --ff-only merge to main.

## Before Merge Fallback Execution

**Executed:** 2026-07-08 after "Proceed with Before Merge Fallback" authorization.

- Branch created: `before-012-merge`
- HEAD at creation / commit: 20673bffaeb2984a16bc08f578eac231b949fabe
- Working tree snapshot includes all 012 implementation + audit artifacts + living doc updates.
- **Working tree verified clean** after commit.
- **No merge performed.**
- **No checkpoint tag created.**
- **No post-merge documentation finalized** (history/012.md, project-status.json mergeMetadata, freeze, etc. reserved for later).
- No changes landed on `main`.

**Deliverables met:**
- rollback branch created ✅
- commit hash recorded ✅
- working tree clean ✅
- no merge performed ✅
- no tag created ✅
- no post-merge documentation finalized ✅

**Next authorized steps only (per workflow):**
Independent Merge Review → Merge (--ff-only on main) → Checkpoint tag → history/012.md → project-status.json updates → Freeze 012 → Activate 013.