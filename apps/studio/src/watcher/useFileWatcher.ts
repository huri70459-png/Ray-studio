/**
 * Minimal FileWatcher consumer for Studio Shell (012 scope)
 * Real privileged watcher + IPC will live behind 013 contracts.
 * For now: thin wrapper + direct service (ponytail until 013 + main-process isolation).
 *
 * Depends on validated roots from 011 (via updateFsRoots + initFileSystem or project activation).
 * Never bypasses 011 for roots.
 */

import { FileWatcher } from '@ray-studio/core';
import type { FsChangeEvent } from '@ray-studio/core';

let _watcher: FileWatcher | null = null;

export function getFileWatcher(): FileWatcher {
  if (!_watcher) {
    _watcher = new FileWatcher();
    console.warn('[module=file-watcher] phase=shell-consumer-ready');
  }
  return _watcher;
}

export async function initFileWatcher(validatedRoots: string[] = []) {
  const w = getFileWatcher();
  await w.setWatches(validatedRoots);
  return w;
}

export async function updateWatcherRoots(validatedRoots: string[]) {
  return getFileWatcher().setWatches(validatedRoots);
}

export function subscribeToFsChanges(listener: (event: FsChangeEvent) => void): () => void {
  return getFileWatcher().subscribe(listener);
}

export function disposeFileWatcher() {
  getFileWatcher().dispose();
}

export function getWatcherState() {
  return getFileWatcher().getState();
}

export function getWatcherRoots() {
  return getFileWatcher().getActiveRoots();
}
