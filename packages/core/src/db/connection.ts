/**
 * 016 SQLite Layer — Connection lifecycle
 * WAL mode, foreign keys, busy timeout. Path validation is caller's job (011).
 *
 * Driver: Node built-in `node:sqlite` (DatabaseSync).
 * Loaded via process.getBuiltinModule (no node:module import) so renderer bundles
 * that accidentally pull this file do not hard-fail on createRequire.
 * ponytail: Electron hosts without node:sqlite need a native driver adapter (e.g. better-sqlite3) at Phase 2 host integration.
 */

import { DbError, toDbError } from './errors.js';
import type { OpenDatabaseOptions } from './types.js';

/** Minimal surface we need from node:sqlite DatabaseSync / compatible drivers. */
export interface SqlStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  close(): void;
}

export type ConnectionState = 'closed' | 'open' | 'error';

export class ConnectionManager {
  private db: SqlDatabase | null = null;
  private state: ConnectionState = 'closed';
  private path: string | null = null;

  getState(): ConnectionState {
    return this.state;
  }

  getPath(): string | null {
    return this.path;
  }

  /** Throws DbError if not open. */
  getDb(): SqlDatabase {
    if (!this.db || this.state !== 'open') {
      throw new DbError('DB_UNAVAILABLE', 'Database is not open', true);
    }
    return this.db;
  }

  open(opts: OpenDatabaseOptions): void {
    if (this.db) {
      throw new DbError('INVALID_ARGUMENT', 'Database already open');
    }
    const path = opts.path;
    if (!path || typeof path !== 'string') {
      throw new DbError('INVALID_ARGUMENT', 'Database path required');
    }

    try {
      const DatabaseSync = loadDatabaseSync();
      const busyMs = opts.busyTimeoutMs ?? 5000;
      const instance = new DatabaseSync(path) as SqlDatabase;

      // WAL only for file DBs; :memory: ignores / may error on some drivers
      if (path !== ':memory:') {
        try {
          instance.exec('PRAGMA journal_mode = WAL;');
        } catch {
          // ponytail: some environments reject WAL; continue with default journal
        }
      }
      instance.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(busyMs))};`);
      instance.exec('PRAGMA foreign_keys = ON;');
      instance.exec('PRAGMA synchronous = NORMAL;');

      this.db = instance;
      this.path = path;
      this.state = 'open';
      console.warn(`[module=sqlite-layer] phase=open path=${sanitizePath(path)}`);
    } catch (err) {
      this.state = 'error';
      this.db = null;
      this.path = null;
      throw toDbError(err);
    }
  }

  close(): void {
    if (!this.db) {
      this.state = 'closed';
      return;
    }
    try {
      // optional checkpoint for file DBs
      if (this.path && this.path !== ':memory:') {
        try {
          this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        } catch {
          // non-fatal
        }
      }
      this.db.close();
      console.warn('[module=sqlite-layer] phase=close');
    } catch (err) {
      console.warn(`[module=sqlite-layer] phase=close-error code=${toDbError(err).code}`);
    } finally {
      this.db = null;
      this.path = null;
      this.state = 'closed';
    }
  }
}

function loadDatabaseSync(): new (path: string) => unknown {
  try {
    const getBuiltin = (process as NodeJS.Process & {
      getBuiltinModule?: (id: string) => { DatabaseSync?: new (path: string) => unknown };
    }).getBuiltinModule;

    if (typeof getBuiltin !== 'function') {
      throw new DbError('DB_UNAVAILABLE', 'SQLite runtime not available in this process', true);
    }

    // Prefer scheme form; fall back to bare id
    const mod =
      getBuiltin('node:sqlite') ??
      getBuiltin('sqlite');

    if (!mod?.DatabaseSync) {
      throw new DbError('DB_UNAVAILABLE', 'SQLite DatabaseSync not found', true);
    }
    return mod.DatabaseSync;
  } catch (err) {
    if (err instanceof DbError) throw err;
    throw new DbError('DB_UNAVAILABLE', 'SQLite runtime not available in this process', true);
  }
}

function sanitizePath(p: string): string {
  if (p === ':memory:') return ':memory:';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/') || '[path]';
}
