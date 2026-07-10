/**
 * FileWatcher consumer for Studio Shell — via 013 IPC.
 * 012 owns detection; 013 owns transport + contracts + events.
 * Renderer subscribes via bridge 'on'; sets roots via invoke contract.
 */

import type { FsChangeEvent } from '@ray-studio/core';
import { watcherSubscribeContract, watcherEventChannel } from '@ray-studio/core';

const WATCH_SUB = watcherSubscribeContract.channel;

type RayStudio = (Window['rayStudio'] & { invoke?: (ch: string, p?: unknown) => Promise<unknown>; on?: (ch: string, h: (p: unknown) => void) => () => void }) | undefined;

function getApi(): RayStudio {
  // 013 contract surface; preload provides invoke/on
  return (window as any).rayStudio;
}

let currentRoots: string[] = [];
let listeners: Array<(e: FsChangeEvent) => void> = [];
let unsubBridge: (() => void) | null = null;

export async function initFileWatcher(validatedRoots: string[] = []) {
  return updateWatcherRoots(validatedRoots);
}

export async function updateWatcherRoots(validatedRoots: string[]) {
  const api = getApi();
  currentRoots = validatedRoots || [];
  if (!api?.invoke) {
    console.warn('[module=file-watcher] phase=ipc-missing');
    return;
  }
  const res = await api.invoke(WATCH_SUB, { roots: currentRoots });
  console.warn('[module=file-watcher] phase=subscribe-via-ipc', res);
  // ensure bridge listener
  ensureEventBridge();
}

function ensureEventBridge() {
  const api = getApi();
  if (!api?.on || unsubBridge) return;
  unsubBridge = api.on(watcherEventChannel, (payload: unknown) => {
    // payload is FsChangeEvent (validated by 013 contract on emit side)
    listeners.forEach((l) => l(payload as FsChangeEvent));
  });
}

export function subscribeToFsChanges(listener: (event: FsChangeEvent) => void): () => void {
  listeners.push(listener);
  ensureEventBridge();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function disposeFileWatcher() {
  listeners = [];
  if (unsubBridge) {
    unsubBridge();
    unsubBridge = null;
  }
  // server side dispose not directly callable; future contract
  console.warn('[module=file-watcher] phase=client-dispose');
}

export function getWatcherState() {
  return currentRoots.length > 0 ? 'watching' : 'idle';
}

export function getWatcherRoots() {
  return [...currentRoots];
}

// Legacy direct getter removed from renderer (013 contract boundary).
export function getFileWatcher() {
  return {
    setWatches: updateWatcherRoots,
    subscribe: subscribeToFsChanges,
    dispose: disposeFileWatcher,
    getState: getWatcherState,
    getActiveRoots: getWatcherRoots,
  } as any;
}
