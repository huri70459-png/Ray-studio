/**
 * 013 IPC Framework — IpcServer (pure, no platform dep)
 * Handles registration, validation ordering, dispatch logic.
 * Electron wiring lives in main (apps/studio/electron-main) to keep core pure.
 * See 013 spec §10, §13, lifecycle.
 *
 * Delegates to business services (no logic here).
 * ponytail: no 'electron' in core (stdlib + contracts only).
 */

import type { IpcContract as _IpcContract, Capability } from './contracts/index.js';
import { getContractRegistry, type ContractRegistry } from './registry.js';
import { createIpcError, type IpcError } from './errors.js';
import { validateCapability, validateSchema, type ValidationContext } from './validation.js';
import { isIpcError } from './errors.js';

export type Handler<Req, Res> = (req: Req, ctx: ValidationContext) => Promise<Res | IpcError>;

export interface IpcServerOptions {
  registry?: ContractRegistry;
}

export class IpcServer {
  private registry: ContractRegistry;
  private handlers = new Map<string, Handler<any, any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any -- heterogeneous contract handlers internal only
  private activeGrants = new Map<number, ValidationContext>();

  constructor(opts: IpcServerOptions = {}) {
    this.registry = opts.registry ?? getContractRegistry();
    console.warn('[module=ipc-framework] phase=server-constructed');
  }

  /** Grant capabilities for a renderer (called at window ready) */
  grant(webContentsId: number, caps: Capability[]) {
    this.activeGrants.set(webContentsId, { grantedCaps: new Set(caps), grantedAt: Date.now() });
    console.warn(`[module=ipc-framework] phase=grant wc=${webContentsId} caps=${caps.join(',')}`);
  }

  getGrant(webContentsId: number): ValidationContext | undefined {
    return this.activeGrants.get(webContentsId);
  }

  /** Register handler (pure). Actual ipcMain.handle is done by host (main.ts) using this. */
  registerHandler<Req, Res>(channel: string, handler: Handler<Req, Res>): void | IpcError {
    const contract = this.registry.get(channel);
    if (!contract) {
      return createIpcError({ code: 'UNKNOWN_CONTRACT', category: 'contract', message: `No contract for ${channel}`, retryable: false });
    }
    if (this.handlers.has(channel)) {
      console.warn(`[module=ipc-framework] phase=handler-replaced channel=${channel}`);
    }
    this.handlers.set(channel, handler);
    console.warn(`[module=ipc-framework] phase=handler-registered channel=${channel}`);
  }

  /** Dispatch (used by host after its schema/cap checks or for direct) */
  async dispatch<Req, Res>(channel: string, payload: Req, wcId?: number): Promise<Res | IpcError> {
    const contract = this.registry.get(channel);
    if (!contract) {
      return createIpcError({ code: 'UNKNOWN_CONTRACT', category: 'contract', message: `No contract ${channel}`, retryable: false });
    }
    const handler = this.handlers.get(channel);
    if (!handler) {
      return createIpcError({ code: 'NO_HANDLER', category: 'unavailable', message: `No handler for ${channel}`, retryable: false, contractVersion: contract.version });
    }
    const ctx: ValidationContext = this.activeGrants.get(wcId || 0) || { grantedCaps: new Set() };
    const p = payload as Record<string, unknown> | undefined;
    ctx.correlationId = (p && typeof p.correlationId === 'string') ? p.correlationId : `ipc_${Date.now()}`;
    ctx.contractVersion = contract.version;

    // === Explicit ordering per 013 validation spec §4 (capability before schema before dispatch) ===
    const ns = contract.namespace as Capability;
    const capErr = validateCapability(ns, ctx);
    if (capErr) return capErr;

    const schemaErr = validateSchema(contract.requestSchema, payload, ctx);
    if (schemaErr) return schemaErr;

    // IPC owns timeout detection (spec §7, failure matrix)
    const TIMEOUT_MS = 15000; // Phase 1 default; services can be faster
    const timeoutPromise = new Promise<Res | IpcError>((_, reject) => {
      setTimeout(() => {
        reject(createIpcError({
          code: 'IPC_TIMEOUT',
          category: 'timeout',
          message: `Request timed out after ${TIMEOUT_MS}ms`,
          correlationId: ctx.correlationId,
          retryable: true,
          contractVersion: contract.version,
        }));
      }, TIMEOUT_MS);
    });

    try {
      const start = Date.now();
      const resultPromise = handler(payload as Req, ctx);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      const dur = Date.now() - start;
      console.warn(`[module=ipc-framework] phase=dispatch-ok channel=${channel} dur=${dur}ms corr=${ctx.correlationId}`);
      return result as Res | IpcError;
    } catch (e: unknown) {
      if (isIpcError(e)) return e;
      const msg = (e as { message?: string })?.message || 'Handler failure';
      return createIpcError({
        code: 'INTERNAL_ERROR',
        category: 'internal',
        message: msg,
        correlationId: ctx.correlationId,
        retryable: true,
        contractVersion: contract.version,
      });
    }
  }

  hasHandler(channel: string): boolean { return this.handlers.has(channel); }

  /** Emit helper (host will call actual webContents.send) */
  prepareEvent<T>(channel: string, payload: T) {
    // just log + return payload; host sends
    console.warn(`[module=ipc-framework] phase=event-prepared channel=${channel}`);
    return payload;
  }

  /** Lifecycle */
  async ready(): Promise<void> {
    const err = this.registry.validateAtBoot();
    if (err) throw err;
    console.warn('[module=ipc-framework] phase=server-ready');
  }

  close() {
    this.handlers.clear();
    this.activeGrants.clear();
    console.warn('[module=ipc-framework] phase=server-closed');
  }
}
