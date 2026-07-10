/**
 * 101 Context Engine — orchestrator (Phase B.1 ports-first)
 */

import { loadGovernanceLayers, type ReadTextFn } from './builders/layered-context-builder.js';
import { compressSummaries } from './compressors/summary-compressor.js';
import { applyTokenBudget } from './compressors/token-budget.js';
import { ContextBudgetError, ContextError } from './errors.js';
import { HeuristicTokenEstimator } from './ports.js';
import { GraphRetriever } from './retrievers/graph-retriever.js';
import { mergeSymbolResults } from './retrievers/hybrid-retriever.js';
import { SemanticRetriever } from './retrievers/semantic-retriever.js';
import type {
  ArchitectureSummary,
  AssembledContext,
  ContextEngine as IContextEngine,
  ContextEngineDeps,
  ContextRequest,
  ProvenanceItem,
  SymbolContext,
} from './types.js';

function matchesExclude(pathOrId: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (!p) continue;
    // Simple substring / glob-lite: * → .*
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    if (new RegExp(escaped).test(pathOrId)) return true;
  }
  return false;
}

function filterExcluded(
  symbols: SymbolContext[],
  patterns: string[] | undefined,
): SymbolContext[] {
  if (!patterns?.length) return symbols;
  return symbols.filter((s) => {
    const candidates = [s.id, s.path ?? '', s.name];
    return !candidates.some((c) => matchesExclude(c, patterns));
  });
}

export class ContextEngine implements IContextEngine {
  private readonly deps: ContextEngineDeps;
  private readonly readText: ReadTextFn;
  private readonly graphRetriever: GraphRetriever;
  private readonly semanticRetriever: SemanticRetriever;

  constructor(deps: ContextEngineDeps) {
    this.deps = {
      ...deps,
      tokens: deps.tokens ?? new HeuristicTokenEstimator(),
    };
    this.readText = deps.readText ?? (async () => null);
    this.graphRetriever = new GraphRetriever(deps.graph);
    this.semanticRetriever = new SemanticRetriever(deps.semantic);
  }

  async buildContext(request: ContextRequest): Promise<AssembledContext> {
    this.validateRequest(request);

    const governance = await loadGovernanceLayers(request, this.readText);

    let degraded = false;
    let graphSymbols: SymbolContext[] = [];
    let semanticSymbols: SymbolContext[] = [];
    let summaries: ArchitectureSummary[] = [];

    try {
      graphSymbols = await this.graphRetriever.retrieve(request.intent);
    } catch {
      degraded = true;
      graphSymbols = [];
    }

    try {
      semanticSymbols = await this.semanticRetriever.retrieve(request.intent);
    } catch {
      degraded = true;
      semanticSymbols = [];
    }

    try {
      const summaryQuery: { intent: string; targetModule?: string } = {
        intent: request.intent,
      };
      if (request.targetModule !== undefined) {
        summaryQuery.targetModule = request.targetModule;
      }
      summaries = await this.deps.summaries.getSummaries(summaryQuery);
    } catch {
      degraded = true;
      summaries = [];
    }

    // Null ports ⇒ empty optional layers; treat as degraded for explainability
    if (
      this.deps.graph.mode === 'null' ||
      this.deps.semantic.mode === 'null' ||
      this.deps.summaries.mode === 'null'
    ) {
      degraded = true;
    }

    const hybrid = mergeSymbolResults(graphSymbols, semanticSymbols);
    const symbols = filterExcluded(hybrid.symbols, request.excludePatterns);
    summaries = compressSummaries(summaries);
    summaries = filterExcludedSummaries(summaries, request.excludePatterns);

    const provenance: ProvenanceItem[] = [];

    if (governance.constitution) {
      provenance.push({
        itemId: 'layer:constitution',
        source: 'constitution',
        reason: 'layered prompt: Constitution (required when readable)',
        score: 1,
      });
    }
    if (governance.moduleSpec) {
      provenance.push({
        itemId: 'layer:moduleSpec',
        source: 'moduleSpec',
        reason: 'layered prompt: target module specification',
        score: 1,
      });
    }
    provenance.push(...hybrid.provenance.filter((p) => symbols.some((s) => s.id === p.itemId)));
    for (const s of summaries) {
      provenance.push({
        itemId: s.id,
        source: 'summary',
        reason: 'architecture summary',
        score: s.score,
      });
    }

    const tokens = this.deps.tokens;
    let govCost = 0;
    if (governance.constitution) govCost += tokens.estimate(governance.constitution);
    if (governance.moduleSpec) govCost += tokens.estimate(governance.moduleSpec);

    if (govCost > request.maxTokens) {
      throw new ContextBudgetError(
        `Governance layers require ~${govCost} tokens but maxTokens=${request.maxTokens}`,
      );
    }

    const budgetInput: {
      tokens: typeof tokens;
      maxTokens: number;
      constitution?: string;
      moduleSpec?: string;
      symbols: SymbolContext[];
      summaries: ArchitectureSummary[];
      provenance: ProvenanceItem[];
    } = {
      tokens,
      maxTokens: request.maxTokens,
      symbols,
      summaries,
      provenance,
    };
    if (governance.constitution !== undefined) {
      budgetInput.constitution = governance.constitution;
    }
    if (governance.moduleSpec !== undefined) {
      budgetInput.moduleSpec = governance.moduleSpec;
    }

    const budgeted = applyTokenBudget(budgetInput);

    const layers: AssembledContext['layers'] = {
      symbols: budgeted.symbols,
      summaries: budgeted.summaries,
    };
    if (budgeted.constitution !== undefined) layers.constitution = budgeted.constitution;
    if (budgeted.moduleSpec !== undefined) layers.moduleSpec = budgeted.moduleSpec;

    return {
      layers,
      tokenEstimate: budgeted.tokenEstimate,
      provenance: budgeted.provenance,
      portsUsed: {
        graph: this.deps.graph.mode,
        semantic: this.deps.semantic.mode,
        summary: this.deps.summaries.mode,
      },
      degraded,
    };
  }

  private validateRequest(request: ContextRequest): void {
    if (!request || typeof request.intent !== 'string' || request.intent.trim() === '') {
      throw new ContextError('INVALID_ARGUMENT', 'intent must be a non-empty string');
    }
    if (typeof request.maxTokens !== 'number' || !(request.maxTokens > 0)) {
      throw new ContextError('INVALID_ARGUMENT', 'maxTokens must be a positive number');
    }
  }
}

function filterExcludedSummaries(
  summaries: ArchitectureSummary[],
  patterns: string[] | undefined,
): ArchitectureSummary[] {
  if (!patterns?.length) return summaries;
  return summaries.filter((s) => {
    const candidates = [s.id, s.title];
    return !candidates.some((c) => matchesExclude(c, patterns));
  });
}

/** Factory with heuristic estimator default. */
export function createContextEngine(
  deps: Pick<ContextEngineDeps, 'graph' | 'semantic' | 'summaries'> &
    Partial<Pick<ContextEngineDeps, 'tokens' | 'readText'>>,
): ContextEngine {
  const full: ContextEngineDeps = {
    graph: deps.graph,
    semantic: deps.semantic,
    summaries: deps.summaries,
    tokens: deps.tokens ?? new HeuristicTokenEstimator(),
  };
  if (deps.readText !== undefined) full.readText = deps.readText;
  return new ContextEngine(full);
}
