/**
 * 016 SQLite Layer — MigrationRunner
 * Forward-only, transactional, idempotent by version number.
 */

import type { SqlDatabase } from '../connection.js';
import { DbError, toDbError } from '../errors.js';
import { MIGRATIONS, type Migration } from './index.js';
import { withTransaction } from '../transaction.js';

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  applied: string[];
}

export class MigrationRunner {
  constructor(private migrations: Migration[] = MIGRATIONS) {}

  getCurrentVersion(db: SqlDatabase): number {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);
      const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as
        | { v: number | null }
        | undefined;
      return row?.v ?? 0;
    } catch (err) {
      throw toDbError(err);
    }
  }

  migrate(db: SqlDatabase): MigrationResult {
    const sorted = [...this.migrations].sort((a, b) => a.version - b.version);
    const fromVersion = this.getCurrentVersion(db);
    const applied: string[] = [];

    // Reject if DB is ahead of known migrations (downgrade / foreign schema)
    if (fromVersion > (sorted[sorted.length - 1]?.version ?? 0)) {
      throw new DbError(
        'SCHEMA_MISMATCH',
        `Database schema version ${fromVersion} is newer than supported`,
        false,
      );
    }

    for (const m of sorted) {
      if (m.version <= fromVersion) continue;

      try {
        withTransaction(db, () => {
          db.exec(m.sql);
          db.prepare(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          ).run(m.version, m.name, new Date().toISOString());
        });
        applied.push(m.name);
        console.warn(
          `[module=sqlite-layer] phase=migration applied=${m.name} version=${m.version}`,
        );
      } catch (err) {
        throw toDbError(err);
      }
    }

    const toVersion = this.getCurrentVersion(db);
    return { fromVersion, toVersion, applied };
  }
}
