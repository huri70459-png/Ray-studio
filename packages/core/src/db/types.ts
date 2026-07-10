/**
 * 016 SQLite Layer — Entity + service types
 * Metadata only. No graph entities, no raw file content (docs/006).
 */

export type DbServiceState =
  | 'closed'
  | 'opening'
  | 'migrating'
  | 'ready'
  | 'error'
  | 'closing';

export interface WorkspaceRecord {
  id: string;
  name: string;
  rootPathRef: string;
  createdAt: string; // ISO UTC
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  rootPathRef: string;
  status: string;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionStatusRecord {
  projectId: string;
  stage: string;
  progress: number; // 0..1
  lastError: string | null;
  updatedAt: string;
}

export interface ConfigRecord {
  key: string;
  value: string; // JSON-serialized; bounded size
  workspaceId: string | null;
  projectId: string | null;
  updatedAt: string;
}

/** Active scope for strict multi-tenant isolation (009/010). */
export interface DbScope {
  workspaceId?: string | undefined;
  projectId?: string | undefined;
}

export interface OpenDatabaseOptions {
  /** Absolute path or ':memory:'. Caller must validate file paths via 011. */
  path: string;
  /** Busy timeout ms (default 5000). */
  busyTimeoutMs?: number | undefined;
}

/** Max JSON/string payload for config values (metadata only). */
export const CONFIG_VALUE_MAX_BYTES = 16_384;

export const SCHEMA_VERSION = 1;
