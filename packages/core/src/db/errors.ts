/**
 * 016 SQLite Layer — Domain errors
 * Mapped to 013 IPC envelope by host/service layer.
 */

import { createIpcError, type IpcError, type IpcErrorCategory } from '../ipc/errors.js';

export type DbErrorCode =
  | 'DB_LOCKED'
  | 'DB_CORRUPT'
  | 'SCHEMA_MISMATCH'
  | 'CONSTRAINT_VIOLATION'
  | 'NOT_FOUND'
  | 'SCOPE_VIOLATION'
  | 'VALUE_TOO_LARGE'
  | 'DB_UNAVAILABLE'
  | 'INVALID_ARGUMENT'
  | 'INTERNAL';

export class DbError extends Error {
  code: DbErrorCode;
  retryable: boolean;

  constructor(code: DbErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'DbError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function isDbError(x: unknown): x is DbError {
  return x instanceof DbError;
}

/** Map low-level driver / SQLite messages to stable codes. */
export function toDbError(err: unknown): DbError {
  if (err instanceof DbError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('database is locked') || lower.includes('busy') || lower.includes('sqlite_busy')) {
    return new DbError('DB_LOCKED', 'Database is locked', true);
  }
  if (lower.includes('corrupt') || lower.includes('malformed') || lower.includes('not a database')) {
    return new DbError('DB_CORRUPT', 'Database file is corrupt', false);
  }
  if (lower.includes('constraint') || lower.includes('unique') || lower.includes('foreign key')) {
    return new DbError('CONSTRAINT_VIOLATION', 'Constraint violation', false);
  }
  if (lower.includes('no such table') || lower.includes('schema')) {
    return new DbError('SCHEMA_MISMATCH', 'Schema version mismatch or incomplete migrations', false);
  }
  if (lower.includes('sqlite') && (lower.includes('unavailable') || lower.includes('cannot find'))) {
    return new DbError('DB_UNAVAILABLE', 'SQLite runtime not available', true);
  }
  return new DbError('INTERNAL', 'Database operation failed', false);
}

/** Map domain DbError → standard 013 envelope (for IPC handlers). */
export function dbErrorToIpc(err: unknown, correlationId?: string): IpcError {
  const dbErr = toDbError(err);
  const category = categoryFor(dbErr.code);
  return createIpcError({
    code: dbErr.code,
    category,
    message: dbErr.message,
    retryable: dbErr.retryable,
    correlationId,
  });
}

function categoryFor(code: DbErrorCode): IpcErrorCategory {
  switch (code) {
    case 'DB_LOCKED':
    case 'DB_UNAVAILABLE':
      return 'unavailable';
    case 'SCOPE_VIOLATION':
      return 'authz';
    case 'NOT_FOUND':
    case 'INVALID_ARGUMENT':
    case 'VALUE_TOO_LARGE':
    case 'CONSTRAINT_VIOLATION':
    case 'SCHEMA_MISMATCH':
      return 'validation';
    case 'DB_CORRUPT':
    case 'INTERNAL':
    default:
      return 'internal';
  }
}
