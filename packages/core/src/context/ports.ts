/**
 * 101 Context Engine — ports + Null/Fake adapters (Phase B.1)
 */

import type {
  ArchitectureSummary,
  GraphQueryPort,
  SemanticSearchPort,
  SummaryPort,
  SymbolContext,
  TokenEstimatorPort,
} from './types.js';

/** ponytail: char/4 heuristic — replace with model-accurate estimator when Provider/model registry exists. */
export class HeuristicTokenEstimator implements TokenEstimatorPort {
  estimate(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}

export class NullGraphQueryPort implements GraphQueryPort {
  readonly mode = 'null' as const;
  async search(): Promise<SymbolContext[]> {
    return [];
  }
}

export class NullSemanticSearchPort implements SemanticSearchPort {
  readonly mode = 'null' as const;
  async search(): Promise<SymbolContext[]> {
    return [];
  }
}

export class NullSummaryPort implements SummaryPort {
  readonly mode = 'null' as const;
  async getSummaries(): Promise<ArchitectureSummary[]> {
    return [];
  }
}

export interface FakePortFixtures {
  symbols?: SymbolContext[];
  semantic?: SymbolContext[];
  summaries?: ArchitectureSummary[];
}

const DEFAULT_FAKE_SYMBOLS: SymbolContext[] = [
  {
    id: 'sym:ipc-error',
    path: 'packages/core/src/ipc/errors.ts',
    name: 'IpcError',
    kind: 'type',
    snippet: 'export interface IpcError { code: string }',
    score: 0.92,
  },
  {
    id: 'sym:ipc-registry',
    path: 'packages/core/src/ipc/registry.ts',
    name: 'ContractRegistry',
    kind: 'class',
    snippet: 'export class ContractRegistry { register() {} }',
    score: 0.81,
  },
  {
    id: 'sym:fs-service',
    path: 'packages/core/src/fs/service.ts',
    name: 'FileSystemService',
    kind: 'class',
    snippet: 'export class FileSystemService { readFile() {} }',
    score: 0.55,
  },
];

const DEFAULT_FAKE_SEMANTIC: SymbolContext[] = [
  {
    id: 'sem:timeout',
    path: 'packages/core/src/ipc/server.ts',
    name: 'invokeTimeout',
    kind: 'function',
    snippet: 'function invokeTimeout() {}',
    score: 0.7,
  },
];

const DEFAULT_FAKE_SUMMARIES: ArchitectureSummary[] = [
  {
    id: 'sum:ipc-boundary',
    title: 'IPC trust boundary',
    body: 'Capability → schema → dispatch. Standard IpcError envelope.',
    score: 0.88,
  },
];

export class FakeGraphQueryPort implements GraphQueryPort {
  readonly mode = 'fake' as const;
  private readonly symbols: SymbolContext[];

  constructor(fixtures?: FakePortFixtures) {
    this.symbols = fixtures?.symbols ?? DEFAULT_FAKE_SYMBOLS;
  }

  async search(query: { intent: string; limit: number }): Promise<SymbolContext[]> {
    void query.intent;
    return this.symbols.slice(0, query.limit).map((s) => ({ ...s }));
  }
}

export class FakeSemanticSearchPort implements SemanticSearchPort {
  readonly mode = 'fake' as const;
  private readonly symbols: SymbolContext[];

  constructor(fixtures?: FakePortFixtures) {
    this.symbols = fixtures?.semantic ?? DEFAULT_FAKE_SEMANTIC;
  }

  async search(query: { intent: string; limit: number }): Promise<SymbolContext[]> {
    void query.intent;
    return this.symbols.slice(0, query.limit).map((s) => ({ ...s }));
  }
}

export class FakeSummaryPort implements SummaryPort {
  readonly mode = 'fake' as const;
  private readonly summaries: ArchitectureSummary[];

  constructor(fixtures?: FakePortFixtures) {
    this.summaries = fixtures?.summaries ?? DEFAULT_FAKE_SUMMARIES;
  }

  async getSummaries(query: {
    intent: string;
    targetModule?: string;
  }): Promise<ArchitectureSummary[]> {
    void query;
    return this.summaries.map((s) => ({ ...s }));
  }
}

/** Graph port that always fails — for degradation tests. */
export class ThrowingGraphQueryPort implements GraphQueryPort {
  readonly mode = 'fake' as const;
  async search(): Promise<SymbolContext[]> {
    throw new Error('graph unavailable');
  }
}
