---
name: post-merge-finalizer
description: Use only after merge-readiness has approved and the fast-forward merge + tag have completed. Performs the exact post-merge governance steps: update status, handoff, merge metadata, freeze the module, activate the next module.
---

# Post-Merge Finalizer

**Dedicated skill for the final governance steps after a successful merge.**

This skill exists to keep the deterministic post-merge sequence repeatable and auditable. It is deliberately separated from Merge Readiness (which only decides) and from implementation (which must never touch status/history during coding).

## When to Invoke

- Immediately after a fast-forward merge of a module
- After the tag (e.g. core-platform-001-012-complete) has been created
- Only when merge-readiness returned "Merge Approved"

## Responsibilities (Exactly These — Nothing Else)

- Update `project-status.json`:
  - Set module status to frozen
  - Record merge metadata (commit, date, scores, tag)
  - Update `nextModule`
  - Add to `approvedModules` if not present
- Update `docs/000-current-status.md` (module table, next action, frozen note)
- Update `docs/handoff.md` (current state, next actions, watch-outs)
- Create or update `history/<module>.md` (final record)
- Mark the module as frozen in relevant places
- Activate the next module in status (per roadmap)
- Never modify specs, Constitution, manifests, or source code

## Process

1. Confirm merge-readiness approval and that the merge + tag have occurred (read git log / tag if available).
2. Read current project-status.json and the module's merge-readiness output.
3. Perform the exact updates listed above in order.
4. Verify one-active-module rule is still respected (next module only).
5. Emit a completion summary.

## Output Format

**Post-Merge Finalization Complete**

**Module:** 012 File Watcher  
**Tag:** core-platform-001-012-complete  
**Commit:** ...

**Updates Performed:**
- project-status.json: module012Status = Frozen, nextModule = 013, mergeMetadata.012 = {...}
- docs/000-current-status.md: table updated, 012 marked Frozen
- docs/handoff.md: next action = begin 013
- history/012.md: final record appended

**Next Active Module:** 013 IPC Framework

**Rule Reminder:** Do not begin implementation on 013 (or any module) until a fresh Scope Guard + Manifest Resolver step has been performed in a new session.

## Related Skills

- merge-readiness (must have approved first)
- documentation-sync (now limited; this skill owns the governance updates)
- scope-guard (run at start of next module)
- manifest-resolver (run at start of next module)
- architecture-compliance-review
