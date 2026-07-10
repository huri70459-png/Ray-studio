/**
 * 016 — Project repository (scoped by workspace)
 */

import type { SqlDatabase } from '../connection.js';
import { DbError } from '../errors.js';
import type { ProjectRecord } from '../types.js';
import { withTransaction } from '../transaction.js';

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  root_path_ref: string;
  status: string;
  last_indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: ProjectRow): ProjectRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    rootPathRef: r.root_path_ref,
    status: r.status,
    lastIndexedAt: r.last_indexed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class ProjectRepository {
  constructor(private db: SqlDatabase) {}

  upsert(
    record: Omit<ProjectRecord, 'createdAt' | 'updatedAt' | 'lastIndexedAt'> & {
      createdAt?: string;
      lastIndexedAt?: string | null;
    },
  ): ProjectRecord {
    const now = new Date().toISOString();
    const createdAt = record.createdAt ?? now;
    const lastIndexed = record.lastIndexedAt ?? null;
    return withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO projects (id, workspace_id, name, root_path_ref, status, last_indexed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             workspace_id = excluded.workspace_id,
             name = excluded.name,
             root_path_ref = excluded.root_path_ref,
             status = excluded.status,
             last_indexed_at = excluded.last_indexed_at,
             updated_at = excluded.updated_at`,
        )
        .run(
          record.id,
          record.workspaceId,
          record.name,
          record.rootPathRef,
          record.status,
          lastIndexed,
          createdAt,
          now,
        );
      const row = this.get(record.id);
      if (!row) throw new DbError('INTERNAL', 'Project upsert failed to read back');
      return row;
    });
  }

  get(id: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    return row ? mapRow(row) : null;
  }

  /** List projects in a workspace (strict scope). */
  listByWorkspace(workspaceId: string): ProjectRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY name ASC')
      .all(workspaceId) as ProjectRow[];
    return rows.map(mapRow);
  }

  delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return res.changes > 0;
  }
}
