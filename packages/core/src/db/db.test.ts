/**
 * 016 SQLite Layer — unit tests
 * Covers Layer 4 FT-001..004 core paths: boot/migrate, CRUD, scope, lookups.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from './service.js';
import { DbError, isDbError } from './errors.js';
import { CONFIG_VALUE_MAX_BYTES } from './types.js';
import { MigrationRunner } from './migrations/runner.js';
import { ConnectionManager } from './connection.js';
import {
  getContractRegistry,
  dbProjectGetContract,
  dbProjectListContract,
  dbConfigGetContract,
  dbConfigSetContract,
  dbIngestionGetContract,
  dbIngestionSetContract,
  dbWorkspaceUpsertContract,
  IpcServer,
  isIpcError,
} from '../ipc/index.js';

describe('016 SQLite Layer', () => {
  let db: DatabaseService;

  beforeEach(() => {
    db = new DatabaseService();
    db.open({ path: ':memory:' });
  });

  afterEach(() => {
    db.close();
  });

  it('FT-001: boot + automatic migrations reach schema v1', () => {
    expect(db.getState()).toBe('ready');
    const conn = new ConnectionManager();
    conn.open({ path: ':memory:' });
    const runner = new MigrationRunner();
    const r1 = runner.migrate(conn.getDb());
    expect(r1.toVersion).toBe(1);
    expect(r1.applied.length).toBeGreaterThan(0);
    // idempotent second run
    const r2 = runner.migrate(conn.getDb());
    expect(r2.applied).toEqual([]);
    expect(r2.toVersion).toBe(1);
    conn.close();
  });

  it('FT-001: file-backed open + migrate + reopen durable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ray-db-'));
    const file = path.join(dir, 'meta.sqlite');
    const a = new DatabaseService();
    a.open({ path: file });
    a.upsertWorkspace({ id: 'ws1', name: 'W', rootPathRef: '/w' });
    a.close();

    const b = new DatabaseService();
    b.open({ path: file });
    expect(b.getWorkspace('ws1')?.name).toBe('W');
    b.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('FT-002: CRUD project / config / ingestion / workspace', () => {
    const ws = db.upsertWorkspace({ id: 'ws-a', name: 'Alpha', rootPathRef: '/alpha' });
    expect(ws.id).toBe('ws-a');

    db.upsertProject({
      id: 'p1',
      workspaceId: 'ws-a',
      name: 'Proj',
      rootPathRef: '/alpha/p',
      status: 'active',
    });
    expect(db.getProject('p1')?.name).toBe('Proj');
    expect(db.listProjects('ws-a')).toHaveLength(1);

    const cfg = db.setConfig('theme', 'dark', { workspaceId: 'ws-a' });
    expect(cfg.value).toBe('dark');
    expect(db.getConfig('theme', { workspaceId: 'ws-a' })?.value).toBe('dark');

    const ing = db.setIngestionStatus('p1', 'indexing', 0.5, null);
    expect(ing.progress).toBe(0.5);
    expect(db.getIngestionStatus('p1')?.stage).toBe('indexing');

    // update project
    db.upsertProject({
      id: 'p1',
      workspaceId: 'ws-a',
      name: 'Proj2',
      rootPathRef: '/alpha/p',
      status: 'idle',
    });
    expect(db.getProject('p1')?.name).toBe('Proj2');
  });

  it('FT-003: strict scoping blocks cross-workspace reads', () => {
    db.upsertWorkspace({ id: 'ws-a', name: 'A', rootPathRef: '/a' });
    db.upsertWorkspace({ id: 'ws-b', name: 'B', rootPathRef: '/b' });
    db.upsertProject({
      id: 'pa',
      workspaceId: 'ws-a',
      name: 'PA',
      rootPathRef: '/a/p',
      status: 'active',
    });
    db.upsertProject({
      id: 'pb',
      workspaceId: 'ws-b',
      name: 'PB',
      rootPathRef: '/b/p',
      status: 'active',
    });

    db.setScope({ workspaceId: 'ws-a' });
    expect(db.getProject('pa')?.id).toBe('pa');
    expect(() => db.getProject('pb')).toThrow(DbError);
    try {
      db.getProject('pb');
    } catch (e) {
      expect(isDbError(e) && e.code).toBe('SCOPE_VIOLATION');
    }
    expect(() => db.listProjects('ws-b')).toThrow(DbError);

    db.setConfig('k', 'va', { workspaceId: 'ws-a' });
    expect(() => db.setConfig('k', 'vb', { workspaceId: 'ws-b' })).toThrow(DbError);
  });

  it('FT-004: fast lookups by natural key complete quickly', () => {
    db.upsertWorkspace({ id: 'ws1', name: 'W', rootPathRef: '/w' });
    for (let i = 0; i < 20; i++) {
      db.upsertProject({
        id: `p${i}`,
        workspaceId: 'ws1',
        name: `P${i}`,
        rootPathRef: `/w/p${i}`,
        status: i % 2 === 0 ? 'active' : 'idle',
      });
    }
    const t0 = performance.now();
    const row = db.getProject('p7');
    const list = db.listProjects('ws1');
    const dur = performance.now() - t0;
    expect(row?.id).toBe('p7');
    expect(list.length).toBe(20);
    // generous local bound (spec <15ms list; CI variance)
    expect(dur).toBeLessThan(50);
  });

  it('rejects oversized config values', () => {
    const big = 'x'.repeat(CONFIG_VALUE_MAX_BYTES + 1);
    expect(() => db.setConfig('big', big)).toThrow(DbError);
  });

  it('transaction rolls back on error', () => {
    db.upsertWorkspace({ id: 'ws1', name: 'W', rootPathRef: '/w' });
    expect(() =>
      db.transaction(() => {
        db.upsertProject({
          id: 'px',
          workspaceId: 'ws1',
          name: 'X',
          rootPathRef: '/w/x',
          status: 'active',
        });
        throw new Error('boom');
      }),
    ).toThrow();
    // project may or may not exist depending on nested txn join — outer rollback should undo
    expect(db.getProject('px')).toBeNull();
  });

  it('maps errors with stable codes', () => {
    expect(isDbError(new DbError('NOT_FOUND', 'x'))).toBe(true);
  });
});

describe('016 IPC contracts (db namespace)', () => {
  it('registers db contracts under owner 016 with canonical names', () => {
    const reg = getContractRegistry();
    expect(reg.register(dbWorkspaceUpsertContract)).toBeUndefined();
    expect(reg.register(dbProjectGetContract)).toBeUndefined();
    expect(reg.register(dbProjectListContract)).toBeUndefined();
    expect(reg.register(dbConfigGetContract)).toBeUndefined();
    expect(reg.register(dbConfigSetContract)).toBeUndefined();
    expect(reg.register(dbIngestionGetContract)).toBeUndefined();
    expect(reg.register(dbIngestionSetContract)).toBeUndefined();

    expect(dbProjectGetContract.channel).toBe('db:project:get@1.0');
    expect(dbIngestionSetContract.channel).toBe('db:ingestion:status:set@1.0');
    expect(dbConfigGetContract.channel).toBe('db:config:get@1.0');
    expect(dbWorkspaceUpsertContract.channel).toBe('db:workspace:upsert@1.0');
    expect(dbProjectGetContract.ownerModule).toBe('016');
    expect(dbProjectGetContract.namespace).toBe('db');
  });

  it('IPC dispatch requires db capability then schema', async () => {
    const reg = getContractRegistry();
    reg.register(dbProjectGetContract);
    const server = new IpcServer({ registry: reg });
    const svc = new DatabaseService();
    svc.open({ path: ':memory:' });
    svc.upsertWorkspace({ id: 'ws', name: 'W', rootPathRef: '/w' });
    svc.upsertProject({
      id: 'p1',
      workspaceId: 'ws',
      name: 'P',
      rootPathRef: '/w/p',
      status: 'active',
    });

    server.registerHandler(dbProjectGetContract.channel, async (req: { id: string }) => {
      return svc.getProject(req.id);
    });

    // no capability
    const denied = await server.dispatch(dbProjectGetContract.channel, { id: 'p1' }, 99);
    expect(isIpcError(denied)).toBe(true);
    if (isIpcError(denied)) expect(denied.code).toBe('CAPABILITY_DENIED');

    server.grant(1, ['db']);
    const ok = await server.dispatch(dbProjectGetContract.channel, { id: 'p1' }, 1);
    expect(isIpcError(ok)).toBe(false);
    expect((ok as { id?: string }).id).toBe('p1');

    const badSchema = await server.dispatch(dbProjectGetContract.channel, { id: 1 } as unknown as { id: string }, 1);
    expect(isIpcError(badSchema)).toBe(true);

    svc.close();
  });
});
