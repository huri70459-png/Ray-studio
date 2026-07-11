import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTreeSitterParser } from '../parser/parser.js';
import type { TreeSitterParser } from '../parser/types.js';
import { createSymbolExtractor } from '../extractor/symbol-extractor.js';
import type { SymbolExtractor } from '../extractor/symbol-extractor.js';
import type { Symbol } from '../extractor/symbol-model.js';
import {
  createDependencyGraph,
  fileId,
  type DependencyGraph,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '__fixtures__');

function load(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

async function extractFile(
  parser: TreeSitterParser,
  extractor: SymbolExtractor,
  path: string,
  language: string,
  source: string,
): Promise<Symbol[]> {
  const { tree } = await parser.parse({ language, source });
  return extractor.extract(tree, language, source);
}

function mapIds(path: string, symbols: Symbol[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of symbols) m[s.id] = path;
  return m;
}

describe('Module 105 Dependency Graph (B.2 slice)', () => {
  let parser: TreeSitterParser;
  let extractor: SymbolExtractor;
  let graph: DependencyGraph;

  beforeAll(async () => {
    parser = await createTreeSitterParser();
    extractor = createSymbolExtractor(parser);
  });

  beforeAll(() => {
    // separate graph per suite via beforeEach would reset; create in each test via helper
  });

  function freshGraph(warns?: string[]): DependencyGraph {
    return createDependencyGraph({
      logger: {
        warn: (msg) => {
          warns?.push(msg);
        },
      },
    });
  }

  it('FT-001: file-level dependsOn from TypeScript imports', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const sourceByPath = {
      'util.ts': utilSrc,
      'service.ts': serviceSrc,
    };
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const changedSymbols = [...utilSyms, ...serviceSyms];
    const fileBySymbolId = {
      ...mapIds('util.ts', utilSyms),
      ...mapIds('service.ts', serviceSyms),
    };

    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath,
      changedSymbols,
      fileBySymbolId,
    });

    const dep = delta.upserts.find(
      (r) =>
        r.type === 'dependsOn' &&
        r.from === fileId('service.ts') &&
        r.to === fileId('util.ts'),
    );
    expect(dep).toBeDefined();
    expect(dep!.key).toBe(`dependsOn|${fileId('service.ts')}|${fileId('util.ts')}`);
    expect(delta.metrics.filesAnalyzed).toBe(2);
  });

  it('FT-002: calls edges cross-file', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const sourceByPath = { 'util.ts': utilSrc, 'service.ts': serviceSrc };
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const add = utilSyms.find((s) => s.name === 'add' && s.kind === 'function');
    const run = serviceSyms.find(
      (s) => s.name === 'runService' && s.kind === 'function',
    );
    expect(add).toBeDefined();
    expect(run).toBeDefined();

    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath,
      changedSymbols: [...utilSyms, ...serviceSyms],
      fileBySymbolId: {
        ...mapIds('util.ts', utilSyms),
        ...mapIds('service.ts', serviceSyms),
      },
    });

    const call = delta.upserts.find(
      (r) => r.type === 'calls' && r.from === run!.id && r.to === add!.id,
    );
    expect(call).toBeDefined();
    expect(call!.metadata?.location).toBeDefined();
  });

  it('FT-003: JavaScript and Python import/dependency path', async () => {
    graph = freshGraph();
    const utilJs = load('util.js.txt');
    const serviceJs = load('service.js.txt');
    const jsDelta = await graph.computeDelta({
      projectId: 'js',
      sourceByPath: { 'util.js': utilJs, 'service.js': serviceJs },
      changedSymbols: [
        ...(await extractFile(parser, extractor, 'util.js', 'javascript', utilJs)),
        ...(await extractFile(
          parser,
          extractor,
          'service.js',
          'javascript',
          serviceJs,
        )),
      ],
      symbolsByPath: {
        'util.js': await extractFile(
          parser,
          extractor,
          'util.js',
          'javascript',
          utilJs,
        ),
        'service.js': await extractFile(
          parser,
          extractor,
          'service.js',
          'javascript',
          serviceJs,
        ),
      },
    });
    expect(
      jsDelta.upserts.some(
        (r) =>
          r.type === 'dependsOn' &&
          r.from === fileId('service.js') &&
          r.to === fileId('util.js'),
      ),
    ).toBe(true);

    graph = freshGraph();
    const utilPy = load('util.py.txt');
    const servicePy = load('service.py.txt');
    const pyUtil = await extractFile(
      parser,
      extractor,
      'util.py',
      'python',
      utilPy,
    );
    const pyService = await extractFile(
      parser,
      extractor,
      'service.py',
      'python',
      servicePy,
    );
    const pyDelta = await graph.computeDelta({
      projectId: 'py',
      sourceByPath: { 'util.py': utilPy, 'service.py': servicePy },
      changedSymbols: [...pyUtil, ...pyService],
      symbolsByPath: { 'util.py': pyUtil, 'service.py': pyService },
    });
    expect(
      pyDelta.upserts.some(
        (r) =>
          (r.type === 'dependsOn' || r.type === 'calls') &&
          (r.from.includes('service') || r.from.includes('run')),
      ) ||
        pyDelta.upserts.some(
          (r) =>
            r.type === 'dependsOn' &&
            r.from === fileId('service.py') &&
            r.to === fileId('util.py'),
        ),
    ).toBe(true);
    expect(pyDelta.upserts.length).toBeGreaterThanOrEqual(1);
  });

  it('FT-004: unresolvable import skipped with WARN', async () => {
    const warns: string[] = [];
    graph = freshGraph(warns);
    const src = load('unresolved.ts.txt');
    const syms = await extractFile(
      parser,
      extractor,
      'unresolved.ts',
      'typescript',
      src,
    );
    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: { 'unresolved.ts': src },
      changedSymbols: syms,
      fileBySymbolId: mapIds('unresolved.ts', syms),
    });
    expect(delta.metrics.unresolvableImports).toBeGreaterThanOrEqual(1);
    expect(warns.some((w) => w.includes('unresolvable'))).toBe(true);
    expect(
      delta.upserts.filter((r) => r.type === 'dependsOn').length,
    ).toBe(0);
  });

  it('FT-005: incremental delta on leaf edit keeps callers', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const sourceByPath = { 'util.ts': utilSrc, 'service.ts': serviceSrc };
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const fileBySymbolId = {
      ...mapIds('util.ts', utilSyms),
      ...mapIds('service.ts', serviceSyms),
    };
    const d1 = await graph.computeDelta({
      projectId: 'test',
      sourceByPath,
      changedSymbols: [...utilSyms, ...serviceSyms],
      fileBySymbolId,
    });
    await graph.applyDelta(d1);

    const utilEdited = utilSrc.replace('a + b', 'a + b + 0');
    const utilSyms2 = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilEdited,
    );
    const d2 = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: { 'util.ts': utilEdited, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms2, ...serviceSyms],
      fileBySymbolId: {
        ...mapIds('util.ts', utilSyms2),
        ...mapIds('service.ts', serviceSyms),
      },
    });
    await graph.applyDelta(d2);

    const utilFile = fileId('util.ts');
    const dependents = await graph.getDirectDependents(utilFile);
    expect(dependents.some((d) => d.id === fileId('service.ts'))).toBe(true);
  });

  it('FT-006: getDirectDependents / getDirectDependencies', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    });
    await graph.applyDelta(delta);

    const deps = await graph.getDirectDependencies(fileId('service.ts'));
    expect(deps.some((d) => d.id === fileId('util.ts'))).toBe(true);

    const dependents = await graph.getDirectDependents(fileId('util.ts'));
    expect(dependents.some((d) => d.id === fileId('service.ts'))).toBe(true);

    const unknown = await graph.getDirectDependencies('no-such-id');
    expect(unknown).toEqual([]);
  });

  it('FT-007: determinism', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const input = {
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    };
    const a = await graph.computeDelta(input);
    const b = await graph.computeDelta(input);
    const keysA = a.upserts.map((r) => r.key).sort();
    const keysB = b.upserts.map((r) => r.key).sort();
    expect(keysA).toEqual(keysB);
    expect(
      a.upserts.map((r) => `${r.type}|${r.from}|${r.to}`).sort(),
    ).toEqual(b.upserts.map((r) => `${r.type}|${r.from}|${r.to}`).sort());
  });

  it('FT-008: partial / missing symbols tolerance', async () => {
    graph = freshGraph();
    const serviceSrc = load('service.ts.txt');
    const utilSrc = load('util.ts.txt');
    // Sources present but empty symbol lists — dependsOn still from imports
    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [],
    });
    expect(Array.isArray(delta.upserts)).toBe(true);
    expect(
      delta.upserts.some(
        (r) =>
          r.type === 'dependsOn' &&
          r.from === fileId('service.ts') &&
          r.to === fileId('util.ts'),
      ),
    ).toBe(true);
  });

  it('FT-009: relationship types dependsOn and calls present', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    });
    const types = new Set(delta.upserts.map((r) => r.type));
    expect(types.has('dependsOn')).toBe(true);
    expect(types.has('calls')).toBe(true);
    // implements/inherits/exports deferred for B.2
  });

  it('FT-010: does not own 103/104 — uses public factories only', async () => {
    // Structural: createDependencyGraph has no GrammarRegistry; consumes extract results
    graph = freshGraph();
    expect(typeof createDependencyGraph).toBe('function');
    expect(typeof createTreeSitterParser).toBe('function');
    expect(typeof createSymbolExtractor).toBe('function');
    // Package surface: dependency module path does not re-export parser constructor internals
    const mod = await import('./dependency-graph.js');
    expect(mod.createDependencyGraph).toBeTypeOf('function');
    expect('GrammarRegistry' in mod).toBe(false);
  });

  it('edge: empty inputs → empty delta', async () => {
    graph = freshGraph();
    const delta = await graph.computeDelta({
      projectId: 'test',
      sourceByPath: {},
      changedSymbols: [],
    });
    expect(delta.upserts).toEqual([]);
    expect(delta.deletes).toEqual([]);
  });

  it('edge: concurrent computeDelta', async () => {
    const g1 = freshGraph();
    const g2 = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const input = {
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    };
    const [a, b] = await Promise.all([
      g1.computeDelta(input),
      g2.computeDelta(input),
    ]);
    expect(a.upserts.map((r) => r.key).sort()).toEqual(
      b.upserts.map((r) => r.key).sort(),
    );
  });

  it('edge: idempotent apply of same keys', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const input = {
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    };
    const d = await graph.computeDelta(input);
    await graph.applyDelta(d);
    await graph.applyDelta(d);
    const all = graph.listRelationships();
    const keys = all.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('perf: file-level delta P95 < 20ms (exclude parse/extract)', async () => {
    graph = freshGraph();
    const utilSrc = load('util.ts.txt');
    const serviceSrc = load('service.ts.txt');
    const utilSyms = await extractFile(
      parser,
      extractor,
      'util.ts',
      'typescript',
      utilSrc,
    );
    const serviceSyms = await extractFile(
      parser,
      extractor,
      'service.ts',
      'typescript',
      serviceSrc,
    );
    const input = {
      projectId: 'test',
      sourceByPath: { 'util.ts': utilSrc, 'service.ts': serviceSrc },
      changedSymbols: [...utilSyms, ...serviceSyms],
      symbolsByPath: { 'util.ts': utilSyms, 'service.ts': serviceSyms },
    };
    // warmup
    await graph.computeDelta(input);
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      const d = await graph.computeDelta(input);
      samples.push(d.metrics.durationMs);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)]!;
    expect(p95).toBeLessThan(20);

    await graph.applyDelta(await graph.computeDelta(input));
    const t0 = performance.now();
    await graph.getDirectDependents(fileId('util.ts'));
    expect(performance.now() - t0).toBeLessThan(30);
  });
});
