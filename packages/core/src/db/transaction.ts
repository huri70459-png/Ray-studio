/**
 * 016 SQLite Layer — Transaction abstraction
 * Nested calls re-use the outer transaction (savepoint-free for Phase 1).
 */

import type { SqlDatabase } from './connection.js';
import { toDbError } from './errors.js';

/** Depth counter per db identity (object reference). */
const depths = new WeakMap<object, number>();

/**
 * Run `fn` inside a transaction. Nested withTransaction joins the outer txn.
 * On throw: ROLLBACK (outer) or rethrow after inner join.
 */
export function withTransaction<T>(db: SqlDatabase, fn: () => T): T {
  const depth = depths.get(db as object) ?? 0;

  if (depth > 0) {
    depths.set(db as object, depth + 1);
    try {
      return fn();
    } finally {
      depths.set(db as object, depth);
    }
  }

  depths.set(db as object, 1);
  try {
    db.exec('BEGIN IMMEDIATE');
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw toDbError(err);
  } finally {
    depths.set(db as object, 0);
  }
}
