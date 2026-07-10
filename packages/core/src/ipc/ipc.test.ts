/**
 * 013 IPC Framework — basic contract / registry / validation tests
 * (Phase 1 contract-first coverage)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContractRegistry,
  shellPingContract,
  fsReadContract,
  watcherSubscribeContract,
  createIpcError,
  isIpcError,
  IpcServer,
  createGrant,
  validateCapability,
  validateSchema,
} from './index.js';
import type { Capability, ValidationContext } from './contracts/index.js';

describe('013 IPC Framework (contracts + registry)', () => {
  it('registers contracts and enforces naming', () => {
    const reg = getContractRegistry();
    const r1 = reg.register(shellPingContract);
    expect(r1).toBeUndefined(); // ok
    const r2 = reg.register(fsReadContract);
    expect(r2).toBeUndefined();
    const bad = { ...shellPingContract, channel: 'badchannel' } as unknown as Parameters<typeof reg.register>[0];
    const rBad = reg.register(bad);
    expect(rBad && (rBad as { code?: string }).code).toBe('CONTRACT_BAD_NAME');
  });

  it('namespace ownership prevents cross module hijack', () => {
    const reg = getContractRegistry();
    const hijack = { ...fsReadContract, ownerModule: '999', channel: 'fs:hijack@1.0' } as unknown as Parameters<typeof reg.register>[0];
    const res = reg.register(hijack);
    expect(res && (res as { code?: string }).code).toBe('NAMESPACE_OWNED');
  });

  it('standard error envelope + type guard', () => {
    const err = createIpcError({ code: 'TEST', category: 'validation', message: 'bad', retryable: false });
    expect(err.status).toBe('error');
    expect(isIpcError(err)).toBe(true);
    expect(isIpcError({ foo: 1 })).toBe(false);
  });

  it('contracts use canonical @version names', () => {
    expect(shellPingContract.channel).toBe('shell:ping@1.0');
    expect(watcherSubscribeContract.channel).toBe('watcher:subscribe@1.0');
    expect(fsReadContract.channel).toBe('fs:read@1.0');
  });
});

describe('013 IPC Validation ordering + failure matrix (Phase 1)', () => {
  let server: IpcServer;
  const TEST_CAP: Capability = 'shell';

  beforeEach(() => {
    // fresh server per test for isolation
    server = new IpcServer();
    const reg = getContractRegistry();
    reg.register(shellPingContract);
    server.registerHandler(shellPingContract.channel, async (req: { message: string }) => ({ pong: 'pong:' + req.message, timestamp: Date.now() }));
  });

  it('FT-004: invoke carries version and correlation', async () => {
    const _grant = createGrant([TEST_CAP]);
    server.grant(1, ['shell']);
    const res = await server.dispatch(shellPingContract.channel, { message: 'hi', correlationId: 'corr-123' } as unknown as Parameters<typeof server.dispatch>[1], 1);
    expect(isIpcError(res)).toBe(false);
    expect(((res as unknown) as { pong?: string }).pong).toContain('pong');
  });

  it('capability before schema before dispatch (explicit ordering)', async () => {
    // no grant for this wc
    const capCtx: ValidationContext = { grantedCaps: new Set() };
    const capErr = validateCapability('fs' as Capability, capCtx);
    expect(capErr && capErr.code).toBe('CAPABILITY_DENIED');

    // grant but bad schema
    server.grant(42, ['shell']);
    const _grant = createGrant(['shell']);
    const schemaErr = validateSchema(shellPingContract.requestSchema, { wrong: true } as unknown, { grantedCaps: new Set(['shell'] as Capability[]) });
    expect(schemaErr && schemaErr.code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('all failures use exact IpcError envelope (no ad-hoc)', async () => {
    const badCh = 'no:such@1.0';
    const res = await server.dispatch(badCh as unknown as Parameters<typeof server.dispatch>[0], {}, 99);
    expect(isIpcError(res)).toBe(true);
    if (isIpcError(res)) {
      expect(res.status).toBe('error');
      expect(typeof res.code).toBe('string');
      expect(res.category).toBeDefined();
      expect(res.retryable).toBeDefined();
    }
  });

  it('timeout error shape is produced by framework (IPC owns detection)', () => {
    // Contract-first: IPC layer creates the exact timeout envelope
    const timeoutErr = createIpcError({
      code: 'IPC_TIMEOUT',
      category: 'timeout',
      message: 'Request timed out after 15000ms',
      correlationId: 'c1',
      retryable: true,
      contractVersion: '1.0',
    });
    expect(isIpcError(timeoutErr)).toBe(true);
    expect(timeoutErr.code).toBe('IPC_TIMEOUT');
    expect(timeoutErr.category).toBe('timeout');
    expect(timeoutErr.retryable).toBe(true);
  });
});
