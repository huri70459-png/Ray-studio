/**
 * 013 IPC Framework public entry
 * Contract-first. All consumers import from here.
 */

export * from './errors.js';
export * from './contracts/index.js';
export * from './registry.js';
export * from './validation.js';
export * from './server.js';
export * from './client.js';

// transport/electron is platform adapter (imported only from studio main/preload to avoid electron dep in core)
// Re-export IpcBridge + key contracts for typed usage in preload/renderer shims (contract-first)
export type { IpcBridge } from './contracts/index.js';
export { makeChannel } from './contracts/index.js';
