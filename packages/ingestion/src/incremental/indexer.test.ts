import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTreeSitterParser } from '../parser/parser.js';
import type { TreeSitterParser } from '../parser/types.js';
import { createSymbolExtractor } from '../extractor/symbol-extractor.js';
import type { SymbolExtractor } from '../extractor/symbol-extractor.js';
import { createDependencyGraph } from '../dependency/index.js';
import { fileId } from '../dependency/relationship-model.js';
import {
  createIncrementalIndexerSync,
  classifyChange,
  type IncrementalIndexer,
} from './index.js';
import { createIncrementalIndexer } from './indexer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '__fixtures__');

function load(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

describe('Module 102 Index Builder (B.2 slice)', () => {
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

  it('FT-001: reindexPath single TypeScript file (happy path)', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const delta = await idx.reindexPath('util.ts', {
      source: utilSrc,
      projectId: 'test',
    });

    expect(delta.upserts.length).toBeGreaterThanOrEqual(1);
    expect(delta.upserts.every((u) => u.filePath === 'util.ts')).toBe(true);
    expect(delta.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(delta.metrics.symbolUpsertCount).toBe(delta.upserts.length);
    // no 201 — pure in-process
    expect(delta.upserts[0]!.id).toBeTruthy();
    expect(await idx.getLastIndexedVersion('util.ts')).toBe(1);
  });

  it('FT-002: multi-file import chain coordination', async () => {
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

    expect(delta.upserts.some((u) => u.filePath === 'service.ts')).toBe(true);
    const rel = delta.relationshipDelta?.upserts ?? [];
    const dep = rel.find(
      (r) =>
        r.type === 'dependsOn' &&
        r.from === fileId('service.ts') &&
        r.to === fileId('util.ts'),
    );
    expect(dep).toBeDefined();
    expect(dep!.key).toBe(
      `dependsOn|${fileId('service.ts')}|${fileId('util.ts')}`,
    );
  });

  it('FT-002b: relatedSources on single reindexPath builds dependsOn', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    // seed util first
    await idx.reindexPath('util.ts', { source: utilSrc, projectId: 'test' });
    const delta = await idx.reindexPath('service.ts', {
      source: serviceSrc,
      projectId: 'test',
      relatedSources: { 'util.ts': utilSrc },
    });
    const dep = delta.relationshipDelta?.upserts.find(
      (r) =>
        r.type === 'dependsOn' &&
        r.from === fileId('service.ts') &&
        r.to === fileId('util.ts'),
    );
    expect(dep).toBeDefined();
  });

  it('FT-003: affected dependents planning', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    await idx.reindexPaths(
      [
        { path: 'util.ts', source: utilSrc },
        { path: 'service.ts', source: serviceSrc },
      ],
      { projectId: 'test' },
    );

    // signature-stable body edit
    const utilEdited = utilSrc.replace(
      'return a + b;',
      'return a + b; // touch',
    );
    const delta = await idx.reindexPath('util.ts', {
      source: utilEdited,
      projectId: 'test',
      relatedSources: { 'service.ts': serviceSrc },
    });

    const planned = await idx.planAffected(['util.ts']);
    expect(planned).toContain('util.ts');
    expect(planned).toContain('service.ts');
    expect(delta.affectedModules).toContain('util.ts');
  });

  it('FT-004: file delete produces deletes', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const first = await idx.reindexPath('util.ts', {
      source: utilSrc,
      projectId: 'test',
    });
    expect(first.upserts.length).toBeGreaterThanOrEqual(1);
    const ids = first.upserts.map((u) => u.id);

    const del = await idx.deletePath('util.ts', { projectId: 'test' });
    for (const id of ids) {
      expect(del.deletes).toContain(id);
    }
    expect(del.deletes).toContain('file:util.ts');
    expect(await idx.getLastIndexedVersion('util.ts')).toBeNull();
  });

  it('FT-005: rename / move (delete old + reindex new)', async () => {
    const idx = freshIndexer();
    const src = load('util.ts.txt');
    await idx.reindexPath('a.ts', { source: src, projectId: 'test' });

    const delta = await idx.renamePath('a.ts', 'b.ts', {
      projectId: 'test',
      newSource: src,
    });

    expect(delta.deletes.some((d) => d === 'file:a.ts' || d.includes('a.ts'))).toBe(
      true,
    );
    expect(delta.upserts.some((u) => u.filePath === 'b.ts')).toBe(true);
    expect(await idx.getLastIndexedVersion('a.ts')).toBeNull();
    expect(await idx.getLastIndexedVersion('b.ts')).toBe(1);
  });

  it('FT-006: JavaScript and Python path', async () => {
    const idx = freshIndexer();
    const js = await idx.reindexPath('util.js', {
      source: load('util.js.txt'),
      projectId: 'test',
    });
    expect(js.upserts.length).toBeGreaterThanOrEqual(1);

    const py = await idx.reindexPath('util.py', {
      source: load('util.py.txt'),
      projectId: 'test',
    });
    expect(py.upserts.length).toBeGreaterThanOrEqual(1);

    const multiJs = await idx.reindexPaths(
      [
        { path: 'util.js', source: load('util.js.txt') },
        { path: 'service.js', source: load('service.js.txt') },
      ],
      { projectId: 'test' },
    );
    expect(
      multiJs.relationshipDelta?.upserts.some((r) => r.type === 'dependsOn'),
    ).toBe(true);
  });

  it('FT-007: partial parse / extractor tolerance + batch-safe', async () => {
    const idx = freshIndexer();
    const broken = 'export function broken( { return 1;';
    const good = load('util.ts.txt');

    const delta = await idx.reindexPaths(
      [
        { path: 'broken.ts', source: broken },
        { path: 'util.ts', source: good },
      ],
      { projectId: 'test' },
    );

    // no process crash; util still processed
    expect(delta.upserts.some((u) => u.filePath === 'util.ts')).toBe(true);
  });

  it('FT-008: determinism', async () => {
    const utilSrc = load('util.ts.txt');

    const a = freshIndexer();
    const d1 = await a.reindexPath('util.ts', {
      source: utilSrc,
      projectId: 'test',
    });

    const b = freshIndexer();
    const d2 = await b.reindexPath('util.ts', {
      source: utilSrc,
      projectId: 'test',
    });

    expect(d1.upserts.map((u) => u.id).sort()).toEqual(
      d2.upserts.map((u) => u.id).sort(),
    );
    expect(
      (d1.relationshipDelta?.upserts.map((r) => r.key) ?? []).sort(),
    ).toEqual(
      (d2.relationshipDelta?.upserts.map((r) => r.key) ?? []).sort(),
    );
  });

  it('FT-009: does not own 103/104/105 implementations', async () => {
    const idx = await createIncrementalIndexer({
      parser,
      extractor,
      graph: createDependencyGraph(),
    });
    expect(typeof idx.reindexPath).toBe('function');

    // package public entry
    const mod = await import('../index.js');
    expect(typeof mod.createIncrementalIndexer).toBe('function');
    expect(typeof mod.createTreeSitterParser).toBe('function');
    expect(typeof mod.createSymbolExtractor).toBe('function');
    expect(typeof mod.createDependencyGraph).toBe('function');

    // no second grammar registry under incremental
    const fs = await import('node:fs');
    const path = await import('node:path');
    const incDir = path.dirname(fileURLToPath(import.meta.url));
    const files = fs.readdirSync(incDir);
    expect(files.some((f) => f.includes('grammar'))).toBe(false);
  });

  it('FT-010: debounce / rapid change coalescing (watch deferred)', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');

    // Continuous FS watch deferred; coalescer bounds pending by unique path
    for (let i = 0; i < 20; i++) {
      idx.scheduleReindex('util.ts', utilSrc + `\n// ${i}`);
    }
    expect(idx.coalescerPendingCount()).toBeLessThanOrEqual(1);

    await idx.flushCoalescer();
    const v = await idx.getLastIndexedVersion('util.ts');
    expect(v).toBeGreaterThanOrEqual(1);
  });

  it('edge: empty source does not throw', async () => {
    const idx = freshIndexer();
    const delta = await idx.reindexPath('empty.ts', {
      source: '',
      projectId: 'test',
    });
    expect(delta.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('edge: unsupported extension skips', async () => {
    const idx = freshIndexer();
    const delta = await idx.reindexPath('readme.md', {
      source: '# hi',
      projectId: 'test',
    });
    expect(delta.metrics.skippedFiles).toBe(1);
    expect(delta.upserts.length).toBe(0);
  });

  it('edge: concurrent reindexPath on distinct paths', async () => {
    const idx = freshIndexer();
    const [a, b] = await Promise.all([
      idx.reindexPath('util.ts', {
        source: load('util.ts.txt'),
        projectId: 'test',
      }),
      idx.reindexPath('service.ts', {
        source: load('service.ts.txt'),
        projectId: 'test',
        relatedSources: { 'util.ts': load('util.ts.txt') },
      }),
    ]);
    expect(a.upserts.length).toBeGreaterThanOrEqual(1);
    expect(b.upserts.length).toBeGreaterThanOrEqual(1);
  });

  it('edge: classify only is fast', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      classifyChange({
        path: 'util.ts',
        source: 'export const x = 1;',
        previouslyIndexed: true,
      });
    }
    const ms = performance.now() - t0;
    expect(ms / 1000).toBeLessThan(20); // avg << 20ms
  });

  it('perf: single-file reindex P95 budget (warm)', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    // warm
    await idx.reindexPath('util.ts', { source: utilSrc, projectId: 'test' });

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      idx.reset();
      // re-create graph after reset — reset clears graph but keep indexer
      // reset() clears graph store; reindex still works
      const d = await idx.reindexPath('util.ts', {
        source: utilSrc,
        projectId: 'test',
      });
      samples.push(d.metrics.durationMs);
    }
    samples.sort((x, y) => x - y);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples.at(-1)!;
    // Soft gate: document; hard correctness already asserted
    expect(p95).toBeLessThan(500); // generous CI bound; target <100ms local
    // Prefer <100ms when hardware allows — report via expect.soft style log
    if (p95 >= 100) {
      // eslint-disable-next-line no-console
      console.warn(
        `[102 perf] P95 single-file reindex ${p95.toFixed(1)}ms (target <100ms preferred)`,
      );
    }
  });

  it('R1: scopeFiles policy — single-file reindex does not invent multi-file ownership fix', async () => {
    const idx = freshIndexer();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    await idx.reindexPaths(
      [
        { path: 'util.ts', source: utilSrc },
        { path: 'service.ts', source: serviceSrc },
      ],
      { projectId: 'test' },
    );
    // Reindex util alone (no relatedSources) — still succeeds; may not re-assert full multi-file edges
    const d = await idx.reindexPath('util.ts', {
      source: utilSrc,
      projectId: 'test',
    });
    expect(d.metrics.filesChanged).toBe(1);
    // dependents planning still available from prior apply
    const planned = await idx.planAffected(['util.ts']);
    expect(planned).toContain('util.ts');
  });

  it('public types: IndexDelta has no 201 Entity field names required', async () => {
    const idx = freshIndexer();
    const d = await idx.reindexPath('util.ts', {
      source: load('util.ts.txt'),
      projectId: 'test',
    });
    expect(d.upserts[0]).toHaveProperty('filePath');
    expect(d.upserts[0]).toHaveProperty('qualifiedName');
    expect(d.upserts[0]).not.toHaveProperty('entityType');
  });

  it('start/stop lifecycle no-ops for deferred watch', async () => {
    const idx = freshIndexer();
    await idx.start();
    await idx.stop();
  });
});
