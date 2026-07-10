/**
 * FileSystem consumer for Studio Shell (now via 013 IPC Framework)
 * Privileged ops live in main; renderer uses contract channels only.
 * 011 owns validation + impl; 013 owns transport + contracts.
 */

import { fsReadContract, fsListContract, makeChannel, isIpcError } from '@ray-studio/core';

const FS_READ = fsReadContract.channel; // 'fs:read@1.0'
const FS_LIST = fsListContract.channel;

type RayStudio = (Window['rayStudio'] & { invoke?: (ch: string, p?: unknown) => Promise<unknown>; on?: (ch: string, h: (p: unknown) => void) => () => void }) | undefined;

function getApi(): RayStudio {
  // 013 contract surface; preload provides invoke/on
  return (window as any).rayStudio;
}

export async function fsReadFile(rawPath: string) {
  const api = getApi();
  if (!api?.invoke) return { code: 'IPC_UNAVAILABLE', message: 'No IPC bridge' };
  const res = await api.invoke(FS_READ, { path: rawPath });
  // Consumers check via isIpcError(res) — framework guarantees the envelope
  return res;
}

export async function fsListDirectory(rawPath: string) {
  const api = getApi();
  if (!api?.invoke) return { code: 'IPC_UNAVAILABLE', message: 'No IPC bridge' };
  const res = await api.invoke(FS_LIST, { path: rawPath });
  return res;
}

// Minimal shims for other commands used in App (kept for compat; real impls via invoke + contracts)
export async function fsValidatePath(rawPath: string) {
  // Validation is server-side via 011; client can call a future fs:validate contract.
  // For now pony: call list or read will validate.
  return { valid: true, validatedPath: { canonicalPath: rawPath, scope: 'workspace' as const } };
}

export async function fsWriteFile(rawPath: string, content: string) {
  // Write contract not yet registered in Phase 1; stub via error for now.
  return { code: 'NOT_IMPLEMENTED_IN_013_PHASE1', message: 'fs:write not wired in contract-first phase' };
}

export async function fsGetMetadata(rawPath: string) {
  const api = getApi();
  if (!api?.invoke) return { code: 'IPC_UNAVAILABLE' };
  // Reuse list parent or future metadata contract; for demo use list.
  return api.invoke(FS_LIST, { path: rawPath });
}

export async function initFileSystem(workspaceRoot?: string, projectRoot?: string) {
  // Roots handled server-side when first op or via watcher/fs activate flow.
  console.warn('[module=file-system-service] phase=ipc-ready roots-noted');
  return {};
}

export function updateFsRoots(workspaceRoot?: string, projectRoot?: string) {
  // No-op on renderer; server owns active roots for the services.
  console.warn('[module=file-system-service] phase=roots-via-ipc');
}

export function getFileSystemService() {
  // Legacy direct service removed from renderer. Use the fs* functions.
  // Returning a stub to avoid breaking old demo code paths that call .initialize etc.
  return {
    initialize: initFileSystem,
    updateRoots: updateFsRoots,
    readFile: fsReadFile,
    listDirectory: fsListDirectory,
    validatePath: fsValidatePath,
  } as any;
}
