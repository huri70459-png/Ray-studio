/**
 * 012 File Watcher — Core Implementation
 * Detects FS changes only on 011-validated roots. Publishes normalized events.
 * See prompts/modules/012-file-watcher.md
 * Constitution: Security (caller ensures validated), Reliability (cleanup), Observability (structured logs).
 *
 * ponytail: native fs.watch + manual recursive dir attachment (no chokidar dep added per ladder rung 5/6).
 * Upgrade path: add chokidar for robust cross-platform recursive + better rename correlation when real usage scales.
 * All paths passed in MUST be pre-validated canonical paths from FileSystemService.
 * No validation, no content read, no indexing, no persistence.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type {
  FsChangeEvent,
  FileWatcherState,
  FileWatcherDeps,
} from './types.js';

export class FileWatcher {
  private state: FileWatcherState = 'idle';
  private watches = new Map<string, fs.FSWatcher>(); // dir -> watcher (for recursive coverage)
  private listeners: Array<(e: FsChangeEvent) => void> = [];
  private lastEmit = new Map<string, number>(); // path -> ts for debounce
  private recentDeletes = new Map<string, number>(); // basename@dir -> ts for rename correlation (simple)
  private activeRoots: string[] = [];
  private deps: FileWatcherDeps;

  constructor(deps: FileWatcherDeps = {}) {
    this.deps = deps;
    console.warn('[module=file-watcher] phase=constructed');
  }

  getState(): FileWatcherState {
    return this.state;
  }

  getActiveRoots(): string[] {
    return [...this.activeRoots];
  }

  subscribe(listener: (event: FsChangeEvent) => void): () => void {
    this.listeners.push(listener);
    console.warn('[module=file-watcher] phase=listener-added count=' + this.listeners.length);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Set (replace) the set of validated roots to watch. Closes previous. */
  async setWatches(validatedRoots: string[]): Promise<void> {
    if (this.state === 'disposed') {
      throw new Error('FileWatcher disposed');
    }

    console.warn(`[module=file-watcher] phase=set-watches count=${validatedRoots.length}`);

    // Close old
    this.closeAllWatches();

    this.activeRoots = [];
    this.watches.clear();
    this.recentDeletes.clear();

    for (const root of validatedRoots) {
      if (!root) continue;
      // Assume caller validated via 011. We only watch.
      await this.attachWatchTree(root);
      this.activeRoots.push(root);
    }

    this.state = this.activeRoots.length > 0 ? 'watching' : 'idle';
    console.warn(`[module=file-watcher] phase=watching roots=${this.activeRoots.length}`);
  }

  private async attachWatchTree(dir: string): Promise<void> {
    try {
      // Initial attach for this dir
      this.attachSingle(dir);

      // Recurse to subdirs for coverage (ponytail: simple sync walk at attach time)
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const sub = path.join(dir, ent.name);
          await this.attachWatchTree(sub);
        }
      }
    } catch (err) {
      console.warn(`[module=file-watcher] phase=attach-error root=${this.sanitize(dir)} err=${(err as Error).message}`);
      // continue; do not fail whole set
    }
  }

  private attachSingle(dir: string): void {
    if (this.watches.has(dir)) return;

    try {
      const watcher = fs.watch(dir, (eventType, filename) => {
        this.handleRawEvent(dir, eventType, filename || '');
      });
      this.watches.set(dir, watcher);
    } catch {
      console.warn(`[module=file-watcher] phase=watch-failed dir=${this.sanitize(dir)}`);
    }
  }

  private handleRawEvent(watchedDir: string, eventType: string, filename: string): void {
    if (!filename) return;

    const full = path.join(watchedDir, filename);
    const now = Date.now();

    // Debounce rapid repeats for same path
    const last = this.lastEmit.get(full) || 0;
    if (now - last < 60) return;

    // Determine type using stat (lightweight, path already in validated root)
    fsp.stat(full).then((_stat) => {
      let changeType: 'created' | 'modified' = 'modified';
      if (eventType === 'rename') {
        // Likely create or rename-in
        changeType = 'created';
      }
      this.emitChange({
        type: `fs:change:${changeType}@1.0`,
        path: full,
        timestamp: now,
        root: watchedDir,
      });
      this.lastEmit.set(full, now);
    }).catch(() => {
      // Does not exist → delete or rename-out
      const key = `${filename}@${watchedDir}`;
      this.recentDeletes.set(key, now);

      // Try rename correlation: look for recent create of same name? (simple heuristic)
      // For now emit delete; rename correlation is best-effort
      this.emitChange({
        type: 'fs:change:deleted@1.0',
        path: full,
        timestamp: now,
        root: watchedDir,
      });
      this.lastEmit.set(full, now);

      // Cleanup recent after window
      setTimeout(() => this.recentDeletes.delete(key), 250);
    });

    // If event suggests new dir, attach to it for future deep coverage (lazy attach)
    if (eventType === 'rename') {
      fsp.stat(full).then((_stat) => {
        if (_stat.isDirectory()) {
          this.attachWatchTree(full).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  private emitChange(event: FsChangeEvent): void {
    // Basic normalize: if we saw a recent delete for similar, upgrade to renamed (very simple)
    if (event.type.includes('created')) {
      const base = path.basename(event.path);
      for (const [k, ts] of this.recentDeletes) {
        if (Date.now() - ts < 200 && k.includes(base)) {
          // crude: treat as rename (no oldPath available easily from native)
          // emit as created still; consumers tolerate. Real rename correlation is weak with native.
          break;
        }
      }
    }

    for (const l of this.listeners) {
      try {
        l(event);
      } catch { /* listener error isolated */ }
    }
    if (this.deps.onEvent) {
      try { this.deps.onEvent(event); } catch { /* listener error isolated */ }
    }
    console.warn(`[module=file-watcher] phase=event type=${event.type} path=${this.sanitize(event.path)}`);
  }

  private closeAllWatches(): void {
    for (const [_dir, w] of this.watches) {
      try { w.close(); } catch { /* ignore close errors */ }
    }
    this.watches.clear();
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    console.warn('[module=file-watcher] phase=dispose');
    this.closeAllWatches();
    this.listeners = [];
    this.lastEmit.clear();
    this.recentDeletes.clear();
    this.activeRoots = [];
    this.state = 'disposed';
  }

  private sanitize(p?: string): string {
    if (!p) return '<none>';
    return p.replace(/\\/g, '/').split('/').slice(-2).join('/');
  }
}
