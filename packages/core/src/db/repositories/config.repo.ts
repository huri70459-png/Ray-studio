/**
 * 016 — App config repository (scoped key/value metadata)
 */

import type { SqlDatabase } from '../connection.js';
import { DbError } from '../errors.js';
import { CONFIG_VALUE_MAX_BYTES, type ConfigRecord, type DbScope } from '../types.js';
import { withTransaction } from '../transaction.js';

interface ConfigRow {
  key: string;
  value: string;
  workspace_id: string | null;
  project_id: string | null;
  updated_at: string;
}

function mapRow(r: ConfigRow): ConfigRecord {
  return {
    key: r.key,
    value: r.value,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    updatedAt: r.updated_at,
  };
}

/** SQLite PRIMARY KEY treats NULLs as distinct; we normalize scope keys to '' for uniqueness. */
function scopeKey(id: string | null | undefined): string {
  return id ?? '';
}

function denorm(id: string): string | null {
  return id === '' ? null : id;
}

export class ConfigRepository {
  constructor(private db: SqlDatabase) {}

  get(key: string, scope: DbScope = {}): ConfigRecord | null {
    const ws = scopeKey(scope.workspaceId);
    const proj = scopeKey(scope.projectId);
    const row = this.db
      .prepare(
        `SELECT key, value,
                CASE WHEN workspace_id = '' THEN NULL ELSE workspace_id END AS workspace_id,
                CASE WHEN project_id = '' THEN NULL ELSE project_id END AS project_id,
                updated_at
         FROM app_config
         WHERE key = ? AND workspace_id = ? AND project_id = ?`,
      )
      .get(key, ws, proj) as ConfigRow | undefined;
    return row ? mapRow(row) : null;
  }

  set(key: string, value: string, scope: DbScope = {}): ConfigRecord {
    if (typeof key !== 'string' || key.length === 0) {
      throw new DbError('INVALID_ARGUMENT', 'Config key required');
    }
    if (typeof value !== 'string') {
      throw new DbError('INVALID_ARGUMENT', 'Config value must be a string');
    }
    if (Buffer.byteLength(value, 'utf8') > CONFIG_VALUE_MAX_BYTES) {
      throw new DbError('VALUE_TOO_LARGE', `Config value exceeds ${CONFIG_VALUE_MAX_BYTES} bytes`);
    }

    const now = new Date().toISOString();
    const ws = scopeKey(scope.workspaceId);
    const proj = scopeKey(scope.projectId);

    return withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO app_config (key, value, workspace_id, project_id, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(key, workspace_id, project_id) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`,
        )
        .run(key, value, ws, proj, now);

      return {
        key,
        value,
        workspaceId: denorm(ws),
        projectId: denorm(proj),
        updatedAt: now,
      };
    });
  }

  /** List configs visible under scope (exact workspace+project match). */
  list(scope: DbScope = {}): ConfigRecord[] {
    const ws = scopeKey(scope.workspaceId);
    const proj = scopeKey(scope.projectId);
    const rows = this.db
      .prepare(
        `SELECT key, value,
                CASE WHEN workspace_id = '' THEN NULL ELSE workspace_id END AS workspace_id,
                CASE WHEN project_id = '' THEN NULL ELSE project_id END AS project_id,
                updated_at
         FROM app_config
         WHERE workspace_id = ? AND project_id = ?
         ORDER BY key ASC`,
      )
      .all(ws, proj) as ConfigRow[];
    return rows.map(mapRow);
  }
}
