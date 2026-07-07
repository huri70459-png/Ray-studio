---
name: module-validation
description: Use when a module implementation is finished and you need to validate it against its manifest, module spec, acceptance criteria, and Definition of Done.
---

# Module Validation

Validates that the delivered module satisfies its contract before architecture review or merge.

## Inputs

- The module's implementation-manifest
- Module Specification (prompts/modules/<id>)
- Paired Validation spec (prompts/validation/<id>.validation.md)
- Implementation Template expectations
- Constitution §9 Definition of Done
- Actual produced artifacts (code, tests, docs)

## Checks

Against:
- Manifest (all `required` delivered; `forbidden` untouched)
- Module Spec (FRs, NFRs, responsibilities, contracts, IPC if applicable)
- Acceptance Criteria (explicit in spec + validation doc)
- Definition of Done (Constitution)
- 7 Gates evidence

## Produces

**Validation Report**

- Coverage of each requirement (pass/fail + evidence)
- Missing Items
- Deviations (with justification if any)
- Test coverage notes
- Ready For Merge? (yes / no + blockers)

## Process

1. Read manifest + specs.
2. Map delivered files/changes to requirements.
3. Run or review build/typecheck/test results.
4. Cross-check contracts, boundaries, performance notes.
5. List any gaps.
6. Clear verdict: Ready For Merge? or list exact missing items.

## Output Template

**Module <ID> Validation Report**

- Manifest compliance: PASS/FAIL
- Spec compliance: ...
- Gates status: ...
- Missing Items:
  - ...
- Ready For Merge?: YES | NO (blockers: ...)

## Related Skills

- module-implementation
- architecture-compliance-review
- merge-readiness
