/**
 * 013 IPC Framework — Typed Client (renderer / preload side)
 * Contract-first. Consumers use contracts + this client (or raw bridge + isIpcError guard).
 * See spec §9.
 *
 * ponytail: no generator yet; explicit + contract helpers.
 */

import type { IpcError } from './errors.js';
import { isIpcError } from './errors.js';
import type { IpcContract } from './contracts/index.js';

export interface IpcClient {
  invoke<Req, Res>(channel: string, req: Req): Promise<Res | IpcError>;
  on<T>(channel: string, handler: (payload: T) => void): () => void;
}

/** Create a client over a provided bridge (e.g. window.rayStudio or test double). */
export function createIpcClient(bridge?: { invoke: (ch: string, p?: unknown) => Promise<unknown>; on?: (ch: string, h: (p: unknown) => void) => () => void }): IpcClient {
  const b = bridge ?? {
    invoke: async () => { throw new Error('No IPC bridge'); },
  };

  return {
    async invoke<Req, Res>(channel: string, req: Req): Promise<Res | IpcError> {
      try {
        const res = await b.invoke(channel, req as unknown);
        return res as Res | IpcError;
      } catch (e: unknown) {
        // surface as proper envelope (renderer side)
        return {
          status: 'error',
          code: 'IPC_INVOKE_FAILED',
          category: 'internal',
          message: (e as { message?: string })?.message || 'Bridge invoke failed',
          retryable: true,
        } as IpcError;
      }
    },
    on<T>(channel: string, handler: (payload: T) => void): () => void {
      if (b.on) {
        return b.on(channel, handler as (p: unknown) => void);
      }
      return () => {};
    },
  };
}

/** Convenience: call using a contract object (carries channel + version implicitly). */
export async function invokeWithContract<Req, Res>(
  client: IpcClient,
  contract: IpcContract<Req, Res>,
  req: Req
): Promise<Res | IpcError> {
  // Future: could assert contract version here
  return client.invoke<Req, Res>(contract.channel, req);
}

export { isIpcError };
