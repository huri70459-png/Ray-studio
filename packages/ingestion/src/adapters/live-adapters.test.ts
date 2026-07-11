/**
 * Module 101 Live Adapters (B.2) — Layer 4 FT coverage.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTreeSitterParser } from '../parser/parser.js';
import type { TreeSitterParser } from '../parser/types.js';
import { createSymbolExtractor } from '../extractor/symbol-extractor.js';
import type { SymbolExtractor } from '../extractor/symbol-extractor.js';
import { createDependencyGraph } from '../dependency/index.js';
import {
  createIncrementalIndexerSync,
  createSymbolRegistry,
  applySymbolBatch,
  type IncrementalIndexer,
  type SymbolRecord,
  type SymbolRegistry,
} from '../incremental/index.js';
import {
  createLiveGraphQueryPort,
  createLiveSemanticSearchPort,
  createLiveSummaryPort,
  type GraphQueryPort,
  type SemanticSearchPort,
  type SummaryPort,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../incremental/__fixtures__');

function load(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

function handRegistry(records: SymbolRecord[]): SymbolRegistry {
  const reg = createSymbolRegistry();
  const byPath: Record<string, SymbolRecord[]> = {};
  for (const r of records) {
    const p = r.filePath;
    if (!byPath[p]) byPath[p] = [];
    byPath[p]!.push(r);
  }
  applySymbolBatch(reg, byPath, []);
  return reg;
}

describe('Module 101 Live Adapters (B.2 slice)', () => {
  let parser: TreeSitterParser;
  let extractor: SymbolExtractor;

  beforeAll(async () => {
    parser = await createTreeSitterParser();
    extractor = createSymbolExtractor(parser);
  });

  function freshIndexer(): IncrementalIndexer {
    return createIncrementalIndexerSync({
      parser,
      extractor,
      graph: createDependencyGraph(),
      defaultProjectId: 'test',
      coalesceMs: 5,
    });
  }

  it('FT-001: live graph over pre-indexed symbols (happy path)', async () => {
    const idx = freshIndexer();
    const delta = await idx.reindexPath('util.ts', {
      source: load('util.ts.txt'),
      projectId: 'test',
    });
    expect(delta.upserts.length).toBeGreaterThanOrEqual(1);

    const port = createLiveGraphQueryPort({ symbols: delta.upserts });
    expect(port.mode).toBe('live');

    const hits = await port.search({ intent: 'add', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.name === 'add' || h.id.includes('add'))).toBe(
      true,
    );
    for (const h of hits) {
      expect(h.score).toBeGreaterThan(0);
      expect(h.score).toBeLessThanOrEqual(1);
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
    }
  });

  it('FT-002: intent maps to path / qualifiedName tokens (deterministic)', async () => {
    const records: SymbolRecord[] = [
      {
        id: 'sym:util/add',
        kind: 'function',
        name: 'add',
        qualifiedName: 'util.add',
        filePath: 'packages/core/src/math/util.ts',
        signature: 'function add(a, b)',
      },
      {
        id: 'sym:other/foo',
        kind: 'function',
        name: 'foo',
        qualifiedName: 'other.foo',
        filePath: 'packages/other/src/foo.ts',
      },
    ];
    const port = createLiveGraphQueryPort({
      registry: handRegistry(records),
    });

    const byPath = await port.search({
      intent: 'math/util',
      limit: 10,
    });
    expect(byPath.some((h) => h.id === 'sym:util/add')).toBe(true);

    const a = await port.search({ intent: 'util.add', limit: 5 });
    const b = await port.search({ intent: 'util.add', limit: 5 });
    expect(a.map((h) => h.id)).toEqual(b.map((h) => h.id));
    expect(a.map((h) => h.score)).toEqual(b.map((h) => h.score));
  });

  it('FT-003: empty registry degrades cleanly', async () => {
    const port = createLiveGraphQueryPort({
      registry: createSymbolRegistry(),
    });
    expect(port.mode).toBe('live');
    const hits = await port.search({ intent: 'anything', limit: 10 });
    expect(hits).toEqual([]);
  });

  it('FT-003b: empty options still live + empty', async () => {
    const port = createLiveGraphQueryPort();
    expect(port.mode).toBe('live');
    expect(await port.search({ intent: 'x', limit: 5 })).toEqual([]);
  });

  it('FT-004: limit honored + stable order', async () => {
    const records: SymbolRecord[] = [];
    for (let i = 0; i < 20; i++) {
      const n = `fn${String(i).padStart(2, '0')}`;
      records.push({
        id: `sym:${n}`,
        kind: 'function',
        name: n,
        qualifiedName: `mod.${n}`,
        filePath: `src/${n}.ts`,
      });
    }
    // shared token "fn" matches all
    const port = createLiveGraphQueryPort({ symbols: records });
    const hits = await port.search({ intent: 'fn', limit: 5 });
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(hits.length).toBe(5);
    // stable: score desc, id asc
    for (let i = 1; i < hits.length; i++) {
      const prev = hits[i - 1]!;
      const cur = hits[i]!;
      expect(prev.score >= cur.score).toBe(true);
      if (prev.score === cur.score) {
        expect(prev.id <= cur.id).toBe(true);
      }
    }
    const again = await port.search({ intent: 'fn', limit: 5 });
    expect(again.map((h) => h.id)).toEqual(hits.map((h) => h.id));
  });

  it('FT-004b: limit <= 0 returns []', async () => {
    const port = createLiveGraphQueryPort({
      symbols: [
        {
          id: 'a',
          kind: 'function',
          name: 'hello',
          qualifiedName: 'hello',
          filePath: 'a.ts',
        },
      ],
    });
    expect(await port.search({ intent: 'hello', limit: 0 })).toEqual([]);
    expect(await port.search({ intent: 'hello', limit: -1 })).toEqual([]);
  });

  it('FT-005: optional 105 direct expansion', async () => {
    const graph = createDependencyGraph();
    const idx = createIncrementalIndexerSync({
      parser,
      extractor,
      graph,
      defaultProjectId: 'test',
    });
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const delta = await idx.reindexPaths(
      [
        { path: 'util.ts', source: utilSrc },
        { path: 'service.ts', source: serviceSrc },
      ],
      { projectId: 'test' },
    );

    const port = createLiveGraphQueryPort({
      symbols: delta.upserts,
      graph: idx.getGraph(),
      expand: 'direct',
    });

    // Search leaf add; expansion may pull related ids when edges exist
    const hits = await port.search({ intent: 'add', limit: 20 });
    expect(hits.some((h) => h.name === 'add' || h.id.includes('add'))).toBe(
      true,
    );
    // Without expansion still works; with expansion length >= primary
    const noExp = createLiveGraphQueryPort({
      symbols: delta.upserts,
      expand: 'none',
    });
    const primary = await noExp.search({ intent: 'add', limit: 20 });
    expect(hits.length).toBeGreaterThanOrEqual(primary.length);
  });

  it('FT-006: structural GraphQueryPort compatibility', async () => {
    const port: GraphQueryPort = createLiveGraphQueryPort({
      symbols: [
        {
          id: 'sym:x',
          kind: 'function',
          name: 'x',
          qualifiedName: 'x',
          filePath: 'x.ts',
        },
      ],
    });
    expect(port.mode).toBe('live');
    expect(typeof port.search).toBe('function');
    const r = await port.search({ intent: 'x', limit: 1 });
    expect(r[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      score: expect.any(Number),
    });
  });

  it('FT-007: live lexical semantic port', async () => {
    const idx = freshIndexer();
    const delta = await idx.reindexPath('util.ts', {
      source: load('util.ts.txt'),
      projectId: 'test',
    });
    const port: SemanticSearchPort = createLiveSemanticSearchPort({
      symbols: delta.upserts,
    });
    expect(port.mode).toBe('live');
    const hits = await port.search({ intent: 'mul', limit: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.name === 'mul')).toBe(true);
  });

  it('FT-008: live inventory summary port', async () => {
    const records: SymbolRecord[] = [
      {
        id: 'a',
        kind: 'function',
        name: 'add',
        qualifiedName: 'util.add',
        filePath: 'util.ts',
      },
      {
        id: 'b',
        kind: 'function',
        name: 'mul',
        qualifiedName: 'util.mul',
        filePath: 'util.ts',
      },
    ];
    const port: SummaryPort = createLiveSummaryPort({ symbols: records });
    expect(port.mode).toBe('live');
    const sums = await port.getSummaries({ intent: 'util' });
    expect(sums.length).toBeGreaterThanOrEqual(1);
    expect(sums[0]!.title).toContain('util.ts');
    expect(sums[0]!.body).toContain('add');
    expect(sums[0]!.score).toBeGreaterThan(0);
  });

  it('FT-009: does not reimplement parse/extract — uses 102 upserts only', async () => {
    const idx = freshIndexer();
    const delta = await idx.reindexPath('util.ts', {
      source: load('util.ts.txt'),
    });
    // Adapter is pure over injected symbols (no parser call site in adapters)
    const port = createLiveGraphQueryPort({ registry: handRegistry(delta.upserts) });
    const hits = await port.search({ intent: 'add', limit: 3 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    // registry live view: mutate registry via applySymbolBatch and re-search
    const reg = handRegistry(delta.upserts);
    const live = createLiveGraphQueryPort({ registry: reg });
    expect((await live.search({ intent: 'add', limit: 10 })).length).toBeGreaterThan(
      0,
    );
    applySymbolBatch(reg, { 'util.ts': [] }, []);
    expect(await live.search({ intent: 'add', limit: 10 })).toEqual([]);
  });

  it('FT-010: end-to-end index → live graph search', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const delta = await idx.reindexPaths(
      [
        { path: 'util.ts', source: utilSrc },
        { path: 'service.ts', source: serviceSrc },
      ],
      { projectId: 'test' },
    );

    const port = createLiveGraphQueryPort({
      symbols: delta.upserts,
      graph: idx.getGraph(),
      expand: 'direct',
    });
    const hits = await port.search({ intent: 'runService', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(
      hits.some(
        (h) => h.name === 'runService' || h.path === 'service.ts',
      ),
    ).toBe(true);
  });

  it('edge: nonsense intent → empty, no throw', async () => {
    const port = createLiveGraphQueryPort({
      symbols: [
        {
          id: 'a',
          kind: 'function',
          name: 'known',
          qualifiedName: 'known',
          filePath: 'a.ts',
        },
      ],
    });
    await expect(
      port.search({ intent: 'zzzznotfound999', limit: 10 }),
    ).resolves.toEqual([]);
  });

  it('edge: concurrent search isolated', async () => {
    const records: SymbolRecord[] = [
      {
        id: 'a',
        kind: 'function',
        name: 'alpha',
        qualifiedName: 'alpha',
        filePath: 'a.ts',
      },
      {
        id: 'b',
        kind: 'function',
        name: 'beta',
        qualifiedName: 'beta',
        filePath: 'b.ts',
      },
    ];
    const port = createLiveGraphQueryPort({ symbols: records });
    const [ra, rb] = await Promise.all([
      port.search({ intent: 'alpha', limit: 5 }),
      port.search({ intent: 'beta', limit: 5 }),
    ]);
    expect(ra.every((h) => h.name === 'alpha')).toBe(true);
    expect(rb.every((h) => h.name === 'beta')).toBe(true);
  });

  it('perf: search P95 small registry prefer < 20ms', async () => {
    const records: SymbolRecord[] = [];
    for (let i = 0; i < 150; i++) {
      records.push({
        id: `sym:s${i}`,
        kind: 'function',
        name: `symbol${i}`,
        qualifiedName: `pkg.symbol${i}`,
        filePath: `src/f${i % 20}.ts`,
        signature: `function symbol${i}()`,
      });
    }
    const port = createLiveGraphQueryPort({ symbols: records });
    const times: number[] = [];
    // warm
    await port.search({ intent: 'symbol42', limit: 10 });
    for (let n = 0; n < 50; n++) {
      const t0 = performance.now();
      await port.search({ intent: 'symbol42', limit: 10 });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    // Soft gate documented in Layer 4; assert generous ceiling so CI variance is ok
    expect(p95).toBeLessThan(50);
  });
});
