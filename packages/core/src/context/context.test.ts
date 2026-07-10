/**
 * 101 Context Engine — Layer 4 validation tests (Phase B.1)
 */
import { describe, it, expect } from 'vitest';
import {
  ContextBudgetError,
  ContextEngine,
  ContextError,
  FakeGraphQueryPort,
  FakeSemanticSearchPort,
  FakeSummaryPort,
  HeuristicTokenEstimator,
  NullGraphQueryPort,
  NullSemanticSearchPort,
  NullSummaryPort,
  ThrowingGraphQueryPort,
  type SymbolContext,
} from './index.js';

const CONSTITUTION_FIXTURE = `# Ray Studio Engineering Constitution\n\n## Token Optimization\nGraph-first retrieval.\n`;
const MODULE_013_FIXTURE = `# 013 — IPC Framework\n\nCapability before schema before dispatch.\n`;

function memoryReadText(files: Record<string, string>) {
  return async (path: string): Promise<string | null> => {
    if (path in files) return files[path]!;
    // basename / suffix match for flexible paths
    for (const [k, v] of Object.entries(files)) {
      if (path.endsWith(k) || k.endsWith(path)) return v;
    }
    return null;
  };
}

function engineWithFakes(opts?: {
  graph?: ConstructorParameters<typeof FakeGraphQueryPort>[0];
  read?: Record<string, string>;
  graphPort?: FakeGraphQueryPort | ThrowingGraphQueryPort | NullGraphQueryPort;
  semanticPort?: FakeSemanticSearchPort | NullSemanticSearchPort;
  summaryPort?: FakeSummaryPort | NullSummaryPort;
}) {
  const files = opts?.read ?? {
    'Ray Studio Engineering Constitution.md': CONSTITUTION_FIXTURE,
    'prompts/modules/013-ipc-framework.md': MODULE_013_FIXTURE,
  };
  return new ContextEngine({
    graph: opts?.graphPort ?? new FakeGraphQueryPort(opts?.graph),
    semantic: opts?.semanticPort ?? new FakeSemanticSearchPort(),
    summaries: opts?.summaryPort ?? new FakeSummaryPort(),
    tokens: new HeuristicTokenEstimator(),
    readText: memoryReadText(files),
  });
}

describe('101 Context Engine (Phase B.1)', () => {
  it('FT-001: buildContext with Fake ports', async () => {
    const engine = engineWithFakes();
    const result = await engine.buildContext({
      intent: 'fix IPC errors',
      targetModule: '013',
      maxTokens: 4000,
    });
    expect(result.tokenEstimate).toBeLessThanOrEqual(4000);
    expect(result.layers.symbols.length + result.layers.summaries.length).toBeGreaterThan(0);
    const optionalIds = [
      ...result.layers.symbols.map((s) => s.id),
      ...result.layers.summaries.map((s) => s.id),
    ];
    for (const id of optionalIds) {
      expect(result.provenance.some((p) => p.itemId === id)).toBe(true);
    }
    expect(result.portsUsed.graph).toBe('fake');
    expect(result.portsUsed.semantic).toBe('fake');
    expect(result.portsUsed.summary).toBe('fake');
  });

  it('FT-002: Constitution + module spec layers', async () => {
    const engine = engineWithFakes();
    const result = await engine.buildContext({
      intent: 'ipc contracts',
      targetModule: '013',
      maxTokens: 8000,
      constitutionPath: 'Ray Studio Engineering Constitution.md',
    });
    expect(result.layers.constitution).toBeTruthy();
    expect(result.layers.moduleSpec).toBeTruthy();
    expect(result.provenance.some((p) => p.source === 'constitution')).toBe(true);
    expect(result.provenance.some((p) => p.source === 'moduleSpec')).toBe(true);
  });

  it('FT-003: Null ports degrade cleanly', async () => {
    const engine = engineWithFakes({
      graphPort: new NullGraphQueryPort(),
      semanticPort: new NullSemanticSearchPort(),
      summaryPort: new NullSummaryPort(),
    });
    const result = await engine.buildContext({
      intent: 'anything',
      targetModule: '013',
      maxTokens: 8000,
    });
    expect(result.layers.symbols).toEqual([]);
    expect(result.layers.summaries).toEqual([]);
    expect(result.layers.constitution).toBeTruthy();
    expect(result.degraded).toBe(true);
    expect(result.portsUsed.graph).toBe('null');
  });

  it('FT-004: token budget never exceeded; drops lowest score first', async () => {
    const bulky: SymbolContext[] = Array.from({ length: 20 }, (_, i) => ({
      id: `bulk-${i}`,
      name: `Sym${i}`,
      path: `path/${i}.ts`,
      snippet: 'x'.repeat(200),
      score: i / 20,
    }));
    const engine = new ContextEngine({
      graph: new FakeGraphQueryPort({ symbols: bulky }),
      semantic: new NullSemanticSearchPort(),
      summaries: new NullSummaryPort(),
      tokens: new HeuristicTokenEstimator(),
      readText: async () => null,
    });
    const r = await engine.buildContext({ intent: 'bulk', maxTokens: 200 });
    expect(r.tokenEstimate).toBeLessThanOrEqual(200);
    if (r.layers.symbols.length >= 2) {
      for (let i = 1; i < r.layers.symbols.length; i++) {
        expect(r.layers.symbols[i - 1]!.score).toBeGreaterThanOrEqual(
          r.layers.symbols[i]!.score,
        );
      }
    }
    for (const s of r.layers.symbols) {
      expect(r.provenance.some((p) => p.itemId === s.id)).toBe(true);
    }
  });

  it('FT-005: Constitution-only over budget throws ContextBudgetError', async () => {
    const huge = 'C'.repeat(4000); // ~1000 tokens heuristic
    const engine = new ContextEngine({
      graph: new NullGraphQueryPort(),
      semantic: new NullSemanticSearchPort(),
      summaries: new NullSummaryPort(),
      tokens: new HeuristicTokenEstimator(),
      readText: async (p) =>
        p.includes('Constitution') || p.endsWith('const.md') ? huge : null,
    });
    await expect(
      engine.buildContext({
        intent: 'x',
        maxTokens: 50,
        constitutionPath: 'const.md',
      }),
    ).rejects.toBeInstanceOf(ContextBudgetError);
  });

  it('FT-006: determinism — identical request yields deep-equal payload', async () => {
    const engine = engineWithFakes();
    const req = { intent: 'fix IPC errors', targetModule: '013', maxTokens: 4000 };
    const a = await engine.buildContext(req);
    const b = await engine.buildContext(req);
    expect(a).toEqual(b);
  });

  it('FT-007: exclusion patterns remove matching symbols', async () => {
    const engine = engineWithFakes({
      graph: {
        symbols: [
          {
            id: 'keep',
            name: 'Keep',
            path: 'packages/core/src/ipc/keep.ts',
            score: 0.9,
            snippet: 'keep',
          },
          {
            id: 'drop',
            name: 'Drop',
            path: 'packages/core/src/fs/service.ts',
            score: 0.95,
            snippet: 'drop',
          },
        ],
      },
      semanticPort: new NullSemanticSearchPort(),
      summaryPort: new NullSummaryPort(),
    });
    const result = await engine.buildContext({
      intent: 'x',
      maxTokens: 8000,
      excludePatterns: ['**/fs/**', 'fs/service'],
    });
    expect(result.layers.symbols.every((s) => s.id !== 'drop')).toBe(true);
    expect(result.layers.symbols.some((s) => s.id === 'keep')).toBe(true);
    expect(result.provenance.every((p) => p.itemId !== 'drop')).toBe(true);
  });

  it('FT-008: port failure isolation — graph throw still succeeds', async () => {
    const engine = engineWithFakes({
      graphPort: new ThrowingGraphQueryPort(),
    });
    const result = await engine.buildContext({
      intent: 'ipc',
      targetModule: '013',
      maxTokens: 8000,
    });
    expect(result.degraded).toBe(true);
    expect(result.layers.constitution).toBeTruthy();
    expect(result.tokenEstimate).toBeLessThanOrEqual(8000);
  });

  it('edge: empty intent and maxTokens<=0 reject', async () => {
    const engine = engineWithFakes();
    await expect(engine.buildContext({ intent: '', maxTokens: 100 })).rejects.toBeInstanceOf(
      ContextError,
    );
    await expect(engine.buildContext({ intent: 'x', maxTokens: 0 })).rejects.toBeInstanceOf(
      ContextError,
    );
  });

  it('edge: unknown targetModule omits moduleSpec without throw', async () => {
    const engine = engineWithFakes();
    const result = await engine.buildContext({
      intent: 'x',
      targetModule: '999-does-not-exist',
      maxTokens: 4000,
    });
    expect(result.layers.moduleSpec).toBeUndefined();
    expect(result.layers.constitution).toBeTruthy();
  });

  it('edge: concurrent buildContext isolated', async () => {
    const engine = engineWithFakes();
    const [a, b] = await Promise.all([
      engine.buildContext({ intent: 'one', targetModule: '013', maxTokens: 4000 }),
      engine.buildContext({ intent: 'two', targetModule: '013', maxTokens: 4000 }),
    ]);
    expect(a.tokenEstimate).toBeLessThanOrEqual(4000);
    expect(b.tokenEstimate).toBeLessThanOrEqual(4000);
  });

  it('perf: Fake-port assembly P95 < 50ms @ ≤8k (n=50)', async () => {
    const engine = engineWithFakes();
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      await engine.buildContext({
        intent: 'fix IPC errors',
        targetModule: '013',
        maxTokens: 8000,
      });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(0.95 * (times.length - 1))]!;
    expect(p95).toBeLessThan(50);
  });

  it('estimator monotonicity', () => {
    const t = new HeuristicTokenEstimator();
    expect(t.estimate('abcd')).toBeLessThanOrEqual(t.estimate('abcdefgh'));
  });
});
