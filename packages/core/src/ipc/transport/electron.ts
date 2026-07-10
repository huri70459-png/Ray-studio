/**
 * 013 IPC Framework — Thin Electron Transport Adapter
 * See spec §8, §10.
 *
 * ponytail: imported only by studio electron files; never by core consumers.
 * Core stays free of Electron types.
 */

export interface IpcBridge {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  on: (channel: string, handler: (payload: unknown) => void) => () => void;
}

// Real setup lives in preload.ts (manual for exact surface control).
// This is a marker + types only for the module.
export function setupElectronBridge(_exposeName = 'rayStudioIpc'): void {
  // no-op in core; implemented where electron is available (preload)
}
