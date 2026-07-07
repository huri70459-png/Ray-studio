# 013 — IPC Framework Validation Specification (Layer 4)

**Corresponding Layer 2 Spec:** prompts/modules/013-ipc-framework.md  
**Status:** Ready for Implementation Verification  
**Owner:** Core Engineering  
**Last Updated:** 2026-07-07  
**Module Maturity Alignment:** Architecture Approved

## 1. Purpose of This Validation Spec

This is the most architecturally significant validation spec. The IPC Framework is the trust boundary. All other Core Platform modules (and higher layers) depend on it being implemented exactly to the spec, including the four minor clarifications.

Every contract, validation step, error, timeout, and lifecycle behavior must be provably correct.

## 2. References

- Layer 2: 013-ipc-framework.md (full — especially Contract Registry, naming convention, capability ordering, resilience model + failure matrix, error envelope, lifecycle, security)
- Constitution §9 IPC Standards, security, observability
- All other Phase A validations (001,009-012,016) — they exercise IPC contracts
- Channel examples: fs:*, watcher:*, workspace:*, db:*, etc.

## 3. Functional Test Cases (Core Contracts & Registry)

**FT-001: Contract registration and validation at boot**
- Steps: Boot sequence → all Core modules register contracts → registry validated.
- Expected: Registry contains ownership, versions, deprecation state. Invalid/missing ownership aborts startup (per failure matrix).

**FT-002: Canonical naming convention enforcement**
- Test contracts using the permanent rule: `<namespace>:<operation>@<major>.<minor>`
- Examples to exercise: `workspace:open@1.0`, `watcher:subscribe@1.0`, `fs:read@1.0`, `db:project:get@1.0`
- Expected: All wire usage and registry entries follow this. Old forms (e.g. `fs:1.x` standalone or malformed) rejected or normalized per rules.

**FT-003: Namespace ownership (governance)**
- Steps: Attempt to register channel under `fs:*` from a non-011 module, or reuse namespace.
- Expected: Permanent ownership by exactly one module enforced. Reuse rejected. Namespaces listed in registry with owner.

**FT-004: Invoke request/response with version & correlation**
- Steps: Renderer client → invoke valid contract with version → handler.
- Expected: Version carried/inferable, correlationId propagated, typed response or error envelope.

**FT-005: Event pub/sub (privileged → renderer)**
- Steps: Service emits `watcher:change@1.0` etc. → subscribed renderer receives.
- Expected: Only authorized subscribers, versioned, scoped.

## 4. Explicit Validation Ordering (Critical)

Verify for **every** invoke:
1. Capability validation
2. Schema validation (input)
3. Handler dispatch

**Test cases:**
- Missing/wrong capability → early rejection, no schema or handler run.
- Capability ok + bad schema → schema error, no handler.
- Good capability + schema → dispatch + business logic.

Log/trace points must make ordering observable.

## 5. Error Envelope & Failure Matrix (Full Coverage)

All failures **must** use the exact IpcError shape (status, code, category, message sanitized, correlationId, retryable, contractVersion).

**Failure Matrix verification (every row must produce documented behaviour):**

| Failure                    | Expected Behaviour (must observe)          | Test Method                     |
|----------------------------|--------------------------------------------|---------------------------------|
| Registry validation fails  | Startup abort                              | Bad/missing contract registration |
| Consumer unavailable       | Deterministic error (unavailable category) | Kill or don't start consumer    |
| Version mismatch           | Reject contract                            | Client calls with unsupported version |
| Timeout                    | Standard timeout envelope                  | Slow handler + timeout config   |
| Event overflow             | Backpressure/drop policy                   | Flood event stream              |
| Shutdown during invoke     | Graceful cancellation                      | Shutdown while op in flight     |

Additional categories exercised: validation, authz, internal, contract.

Renderer never receives stacks, secrets, or raw internals.

## 6. Performance, Resilience & Lifecycle

- Invoke overhead (validation + dispatch): < 5ms P95 simple ops.
- Event fan-out: < 10ms P95 moderate load.
- Full lifecycle: Boot → Register → Validate Registry → Open Channels (with validation active) → Ready → ... → Drain → Close.
- Every Core module participates in lifecycle.
- Timeouts owned by IPC; retry/idempotency owned by consumers/business.
- Observability fields (correlationId, duration, originating/dest module, contractVersion) present on all requests/events/errors.

Test high-volume watcher storms, service crash mid-request, version evolution (additive minor ok, major requires coordination).

## 7. Security & Contract Evolution

- Origin/webContents validation on every invoke.
- Strict schema (fail-closed) both directions.
- Output sanitization.
- No dynamic code.
- Additive changes within minor version do not break prior clients (contract evolution tests).
- Major version path + deprecation.

## 8. Integration & Cross-Module

Exercise the complete set of Core contracts from 001,009,010,011,012,016:
- All paths through capability → schema → dispatch.
- Events flowing back.
- Error cases from each service mapped correctly.
- Namespace ownership respected (fs by 011, watcher by 012, db by 016, etc.).

## 9. Definition of Done Verification Checklist

- [ ] Naming convention `<namespace>:<operation>@<major>.<minor>` used everywhere and enforced.
- [ ] Channel namespaces permanently owned; no reuse possible.
- [ ] Capability before schema before dispatch proven for all paths.
- [ ] Full failure matrix produces exactly the documented behaviours.
- [ ] Standard error envelope on 100% of failures.
- [ ] Registry is first-class, validated at boot, used for dispatch.
- [ ] Lifecycle complete and participated in by all Core modules.
- [ ] Observability fields present.
- [ ] Perf, security, contract evolution, timeout ownership all verified.
- [ ] All Layer 2 AC for 013 satisfied.
- [ ] All dependent modules' validations (which rely on IPC) pass when exercised through this framework.
- [ ] Constitution §9 + IPC Standards fully met.
- [ ] No ad-hoc channels or error shapes.

**This validation spec is the gate for the entire Core Platform trust boundary. Sign-off required before any higher-layer implementation.**
