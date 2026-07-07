/**
 * 012 File Watcher — Core Types
 * See prompts/modules/012-file-watcher.md §9, §13.
 * Follows Constitution §3, §7 (boundaries, security via 011-validated paths only).
 *
 * Never performs validation or raw FS reads/writes — only detection on pre-validated roots.
 * Events are transport-independent (013 will own delivery later).
 */

export type FsChangeType = 'created' | 'modified' | 'deleted' | 'renamed';

export interface FsChangeEvent {
  /** Canonical event type with version for contract evolution */
  type: `fs:change:${FsChangeType}@1.0` | 'fs:watcher:overflow@1.0';
  /** Validated canonical path (from 011) */
  path: string;
  /** For renamed events */
  oldPath?: string;
  timestamp: number;
  /** The watched root this event originated from */
  root: string;
}

export interface WatchSubscription {
  id: string;
  roots: string[]; // validated canonical roots
  active: boolean;
}

export type FileWatcherState = 'idle' | 'watching' | 'error' | 'disposed';

export interface FileWatcherDeps {
  // No validator here: 011 owns validation. Optional future hook for testing/mocks.
  onEvent?: (event: FsChangeEvent) => void;
}
