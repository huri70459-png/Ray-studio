/**
 * 016 — Workspace repository (metadata only)
 */

import type { SqlDatabase } from '../connection.js';
import { DbError } from '../errors.js';
import type { WorkspaceRecord } from '../types.js';
import { withTransaction } from '../transaction.js';

interface WorkspaceRow {
  id: string;
  name: string;
  root_path_ref: string;
  created_at: string;
  updated_at: string;
}

function mapRow(r: WorkspaceRow): WorkspaceRecord {
  return {
    id: r.id,
    name: r.name,
    rootPathRef: r.root_path_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class WorkspaceRepository {
  constructor(private db: SqlDatabase) {}

  upsert(record: Omit<WorkspaceRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string }): WorkspaceRecord {
    const now = new Date().toISOString();
    const createdAt = record.createdAt ?? now;
    return withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO workspaces (id, name, root_path_ref, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             root_path_ref = excluded.root_path_ref,
             updated_at = excluded.updated_at`,
        )
        .run(record.id, record.name, record.rootPathRef, createdAt, now);
      const row = this.get(record.id);
      if (!row) throw new DbError('INTERNAL', 'Workspace upsert failed to read back');
      return row;
    });
  }

  get(id: string): WorkspaceRecord | null {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as WorkspaceRow | undefined;
    return row ? mapRow(row) : null;
  }

  list(): WorkspaceRecord[] {
    const rows = this.db.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all() as WorkspaceRow[];
    return rows.map(mapRow);
  }

  delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return res.changes > 0;
  }
}
