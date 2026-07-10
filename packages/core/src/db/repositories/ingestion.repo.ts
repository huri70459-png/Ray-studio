/**
 * 016 — Ingestion status repository (per-project operational state)
 */

import type { SqlDatabase } from '../connection.js';
import { DbError } from '../errors.js';
import type { IngestionStatusRecord } from '../types.js';
import { withTransaction } from '../transaction.js';

interface IngestionRow {
  project_id: string;
  stage: string;
  progress: number;
  last_error: string | null;
  updated_at: string;
}

function mapRow(r: IngestionRow): IngestionStatusRecord {
  return {
    projectId: r.project_id,
    stage: r.stage,
    progress: r.progress,
    lastError: r.last_error,
    updatedAt: r.updated_at,
  };
}

export class IngestionRepository {
  constructor(private db: SqlDatabase) {}

  get(projectId: string): IngestionStatusRecord | null {
    const row = this.db
      .prepare('SELECT * FROM ingestion_status WHERE project_id = ?')
      .get(projectId) as IngestionRow | undefined;
    return row ? mapRow(row) : null;
  }

  set(
    projectId: string,
    stage: string,
    progress: number,
    lastError: string | null = null,
  ): IngestionStatusRecord {
    if (!projectId) throw new DbError('INVALID_ARGUMENT', 'projectId required');
    if (progress < 0 || progress > 1) {
      throw new DbError('INVALID_ARGUMENT', 'progress must be between 0 and 1');
    }
    const now = new Date().toISOString();
    return withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO ingestion_status (project_id, stage, progress, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(project_id) DO UPDATE SET
             stage = excluded.stage,
             progress = excluded.progress,
             last_error = excluded.last_error,
             updated_at = excluded.updated_at`,
        )
        .run(projectId, stage, progress, lastError, now);
      const row = this.get(projectId);
      if (!row) throw new DbError('INTERNAL', 'Ingestion status upsert failed');
      return row;
    });
  }
}
