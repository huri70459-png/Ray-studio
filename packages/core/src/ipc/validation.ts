/**
 * 013 IPC Framework — Validation (capability before schema before dispatch)
 * Explicit ordering per 013 validation spec §4.
 */

import type { Capability } from './contracts/index.js';
import { createIpcError, type IpcError } from './errors.js';

export interface ValidationContext {
  grantedCaps: Set<Capability>;
  correlationId?: string;
  contractVersion?: string;
  grantedAt?: number;
}

/** Capability check first (authz) */
export function validateCapability(required: Capability, ctx: ValidationContext): IpcError | null {
  if (!ctx.grantedCaps.has(required)) {
    return createIpcError({
      code: 'CAPABILITY_DENIED',
      category: 'authz',
      message: `Missing capability: ${required}`,
      correlationId: ctx.correlationId,
      retryable: false,
      contractVersion: ctx.contractVersion,
    });
  }
  return null;
}

/** Then schema (strict fail-closed) */
export function validateSchema<T>(validator: (d: unknown) => d is T, data: unknown, ctx: ValidationContext): IpcError | null {
  if (!validator(data)) {
    return createIpcError({
      code: 'SCHEMA_VALIDATION_FAILED',
      category: 'validation',
      message: 'Request failed schema validation',
      correlationId: ctx.correlationId,
      retryable: false,
      contractVersion: ctx.contractVersion,
    });
  }
  return null;
}

/** Grant helper for bootstrap (narrow in real) */
export function createGrant(caps: Capability[]): ValidationContext {
  return { grantedCaps: new Set(caps), grantedAt: Date.now() };
}
