/**
 * 010 Project Manager — Events
 * Per spec §13 Events. Consumers subscribe (via 013 IPC later).
 * Lightweight payloads only. No file content, no graph data.
 */

import type { ProjectMetadata } from './types.js';

export type ProjectEvent =
  | { type: 'project:activated'; payload: ProjectMetadata }
  | { type: 'project:deactivated'; payload: Record<string, never> }
  | { type: 'project:metadata:changed'; payload: { key: string; value: unknown } }
  | { type: 'project:config:updated'; payload: { key: string; value: unknown } };

// Simple emitter interface (real impl may use EventEmitter or IPC bridge later via 013)
export interface ProjectEventEmitter {
  emit(event: ProjectEvent): void;
  // subscribe removed from core for now (IPC will own cross-process); kept minimal
}
