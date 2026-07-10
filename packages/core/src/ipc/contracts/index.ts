/**
 * 013 IPC Framework — Contract Registry + Typed Contracts
 * Canonical naming: <namespace>:<operation>@<major>.<minor>
 * See 013 spec §2 (ownership), §7 (naming, registry, versioning, capability), §12.
 *
 * No module may invent ad-hoc channels. All go through registry.
 * Phase 1: contract definitions + registration. Business logic stays in owners (011/012 etc).
 */

import type { IpcError } from '../errors.js';

// Base contract shape (conceptual; runtime uses validators + TS)
export interface IpcContract<Req = unknown, Res = unknown, Evt = never> {
  channel: string; // full 'ns:op@1.0'
  version: string; // '1.0'
  namespace: string; // 'fs' | 'watcher' | 'shell' ...
  ownerModule: string; // '011' | '012' | '001' | '013'
  requestSchema: (data: unknown) => data is Req; // predicate validator (strict)
  responseSchema?: (data: unknown) => data is Res;
  eventSchema?: (data: unknown) => data is Evt;
  description?: string;
}

// Helper to make channel
export function makeChannel(ns: string, op: string, v = '1.0'): string {
  return `${ns}:${op}@${v}`;
}

// === Shell contracts (001 / demo boundary) ===
export interface ShellPingReq { message: string }
export interface ShellPingRes { pong: string; timestamp: number }

export interface ShellCaptureReq { content: string; metadata?: Record<string, unknown> }
export interface ShellCaptureRes { success: boolean; id?: string }

export const shellPingContract: IpcContract<ShellPingReq, ShellPingRes> = {
  channel: makeChannel('shell', 'ping'),
  version: '1.0',
  namespace: 'shell',
  ownerModule: '001',
  requestSchema: (d: unknown): d is ShellPingReq =>
    !!d && typeof (d as Record<string, unknown>).message === 'string',
  responseSchema: (d: unknown): d is ShellPingRes =>
    !!d && typeof (d as Record<string, unknown>).pong === 'string' && typeof (d as Record<string, unknown>).timestamp === 'number',
  description: 'Health ping for shell boundary',
};

export const shellCaptureContract: IpcContract<ShellCaptureReq, ShellCaptureRes> = {
  channel: makeChannel('shell', 'capture'),
  version: '1.0',
  namespace: 'shell',
  ownerModule: '001',
  requestSchema: (d: unknown): d is ShellCaptureReq =>
    !!d && typeof (d as Record<string, unknown>).content === 'string',
  responseSchema: (d: unknown): d is ShellCaptureRes =>
    !!d && typeof (d as Record<string, unknown>).success === 'boolean',
  description: 'Capture quick thought (routes to ingestion later)',
};

// === FS contracts (011) — selected ops for renderer ===
export interface FsReadReq { path: string }
export type FsReadRes = { path: string; content: string; metadata: { path: string; size: number; mtime: number; isDirectory: boolean; isFile: boolean } } | IpcError;

export interface FsListReq { path: string }
export type FsListRes = { path: string; entries: Array<{ name: string; path: string; isDirectory: boolean }> } | IpcError;

export const fsReadContract: IpcContract<FsReadReq, FsReadRes> = {
  channel: makeChannel('fs', 'read'),
  version: '1.0',
  namespace: 'fs',
  ownerModule: '011',
  requestSchema: (d: unknown): d is FsReadReq => !!d && typeof (d as Record<string, unknown>).path === 'string' && String((d as Record<string, unknown>).path).length > 0,
  // response may be data or IpcError; caller checks
  description: 'Read file content (validated path only)',
};

export const fsListContract: IpcContract<FsListReq, FsListRes> = {
  channel: makeChannel('fs', 'list'),
  version: '1.0',
  namespace: 'fs',
  ownerModule: '011',
  requestSchema: (d: unknown): d is FsListReq => !!d && typeof (d as Record<string, unknown>).path === 'string' && String((d as Record<string, unknown>).path).length > 0,
  description: 'List directory entries',
};

// === Watcher contracts (012) ===
export interface WatcherSubscribeReq { roots: string[] }
export interface WatcherSubscribeRes { subscriptionId: string; activeRoots: string[] }

export interface FsChangeEventPayload {
  type: string; // e.g. fs:change:created@1.0 or fs:watcher:overflow@1.0
  path: string;
  oldPath?: string;
  timestamp: number;
  root: string;
}

/** Thin bridge surface implemented by preload / transport layer (013 owns the contract for this interface) */
export interface IpcBridge {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  on: (channel: string, handler: (payload: unknown) => void) => () => void;
}

export const watcherSubscribeContract: IpcContract<WatcherSubscribeReq, WatcherSubscribeRes> = {
  channel: makeChannel('watcher', 'subscribe'),
  version: '1.0',
  namespace: 'watcher',
  ownerModule: '012',
  requestSchema: (d: unknown): d is WatcherSubscribeReq =>
    !!d && Array.isArray((d as Record<string, unknown>).roots) && ((d as Record<string, unknown>).roots as unknown[]).every((r: unknown) => typeof r === 'string'),
  description: 'Set/replace watches on 011-validated roots. Events emitted separately.',
};

export const watcherEventChannel = makeChannel('watcher', 'event'); // events published here

// === DB contracts (016) — metadata only; namespace permanently owned by 016 ===
export interface DbProjectGetReq { id: string }
export interface DbProjectListReq { workspaceId: string }
export interface DbProjectUpsertReq {
  id: string;
  workspaceId: string;
  name: string;
  rootPathRef: string;
  status: string;
  lastIndexedAt?: string | null;
}

export interface DbIngestionGetReq { projectId: string }
export interface DbIngestionSetReq {
  projectId: string;
  stage: string;
  progress: number;
  lastError?: string | null;
}

export interface DbConfigGetReq {
  key: string;
  workspaceId?: string;
  projectId?: string;
}
export interface DbConfigSetReq {
  key: string;
  value: string;
  workspaceId?: string;
  projectId?: string;
}

export interface DbWorkspaceUpsertReq {
  id: string;
  name: string;
  rootPathRef: string;
}
export interface DbWorkspaceGetReq { id: string }

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export const dbProjectGetContract: IpcContract<DbProjectGetReq, unknown> = {
  channel: makeChannel('db', 'project:get'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbProjectGetReq =>
    !!d && isNonEmptyString((d as DbProjectGetReq).id),
  description: 'Get project metadata by id (scoped)',
};

export const dbProjectListContract: IpcContract<DbProjectListReq, unknown> = {
  channel: makeChannel('db', 'project:list'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbProjectListReq =>
    !!d && isNonEmptyString((d as DbProjectListReq).workspaceId),
  description: 'List projects in a workspace',
};

export const dbProjectUpsertContract: IpcContract<DbProjectUpsertReq, unknown> = {
  channel: makeChannel('db', 'project:upsert'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbProjectUpsertReq => {
    if (!d || typeof d !== 'object') return false;
    const o = d as DbProjectUpsertReq;
    return (
      isNonEmptyString(o.id) &&
      isNonEmptyString(o.workspaceId) &&
      isNonEmptyString(o.name) &&
      isNonEmptyString(o.rootPathRef) &&
      isNonEmptyString(o.status)
    );
  },
  description: 'Create or update project metadata',
};

export const dbIngestionGetContract: IpcContract<DbIngestionGetReq, unknown> = {
  channel: makeChannel('db', 'ingestion:status:get'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbIngestionGetReq =>
    !!d && isNonEmptyString((d as DbIngestionGetReq).projectId),
  description: 'Get ingestion status for a project',
};

export const dbIngestionSetContract: IpcContract<DbIngestionSetReq, unknown> = {
  channel: makeChannel('db', 'ingestion:status:set'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbIngestionSetReq => {
    if (!d || typeof d !== 'object') return false;
    const o = d as DbIngestionSetReq;
    return (
      isNonEmptyString(o.projectId) &&
      isNonEmptyString(o.stage) &&
      typeof o.progress === 'number' &&
      o.progress >= 0 &&
      o.progress <= 1
    );
  },
  description: 'Set ingestion status for a project',
};

export const dbConfigGetContract: IpcContract<DbConfigGetReq, unknown> = {
  channel: makeChannel('db', 'config:get'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbConfigGetReq =>
    !!d && isNonEmptyString((d as DbConfigGetReq).key),
  description: 'Get scoped config key',
};

export const dbConfigSetContract: IpcContract<DbConfigSetReq, unknown> = {
  channel: makeChannel('db', 'config:set'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbConfigSetReq => {
    if (!d || typeof d !== 'object') return false;
    const o = d as DbConfigSetReq;
    return isNonEmptyString(o.key) && typeof o.value === 'string';
  },
  description: 'Set scoped config key (bounded value)',
};

export const dbWorkspaceGetContract: IpcContract<DbWorkspaceGetReq, unknown> = {
  channel: makeChannel('db', 'workspace:get'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbWorkspaceGetReq =>
    !!d && isNonEmptyString((d as DbWorkspaceGetReq).id),
  description: 'Get workspace metadata by id',
};

export const dbWorkspaceUpsertContract: IpcContract<DbWorkspaceUpsertReq, unknown> = {
  channel: makeChannel('db', 'workspace:upsert'),
  version: '1.0',
  namespace: 'db',
  ownerModule: '016',
  requestSchema: (d: unknown): d is DbWorkspaceUpsertReq => {
    if (!d || typeof d !== 'object') return false;
    const o = d as DbWorkspaceUpsertReq;
    return isNonEmptyString(o.id) && isNonEmptyString(o.name) && isNonEmptyString(o.rootPathRef);
  },
  description: 'Create or update workspace metadata',
};

// Capability tokens (narrow grants)
export type Capability = 'shell' | 'fs' | 'watcher' | 'db' | 'system';

export interface CapabilityGrant {
  caps: Capability[];
  grantedAt: number;
}
