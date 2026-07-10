/**
 * 101 — Token budget accounting and optional-item trimming
 */

import type {
  ArchitectureSummary,
  ProvenanceItem,
  SymbolContext,
  TokenEstimatorPort,
} from '../types.js';

export interface BudgetedLayers {
  constitution?: string;
  moduleSpec?: string;
  symbols: SymbolContext[];
  summaries: ArchitectureSummary[];
  provenance: ProvenanceItem[];
  tokenEstimate: number;
}

function symbolText(s: SymbolContext): string {
  return [s.name, s.kind ?? '', s.path ?? '', s.snippet ?? ''].join('\n');
}

function summaryText(s: ArchitectureSummary): string {
  return [s.title, s.body].join('\n');
}

export function estimateOptionalItem(
  tokens: TokenEstimatorPort,
  kind: 'symbol' | 'summary',
  item: SymbolContext | ArchitectureSummary,
): number {
  return kind === 'symbol'
    ? tokens.estimate(symbolText(item as SymbolContext))
    : tokens.estimate(summaryText(item as ArchitectureSummary));
}

/**
 * Governance layers are mandatory once loaded. Optional items ranked by score desc;
 * drop lowest first until budget fits. Caller must ensure governance alone ≤ maxTokens.
 */
export function applyTokenBudget(input: {
  tokens: TokenEstimatorPort;
  maxTokens: number;
  constitution?: string;
  moduleSpec?: string;
  symbols: SymbolContext[];
  summaries: ArchitectureSummary[];
  provenance: ProvenanceItem[];
}): BudgetedLayers {
  const { tokens, maxTokens } = input;

  let used = 0;
  if (input.constitution) used += tokens.estimate(input.constitution);
  if (input.moduleSpec) used += tokens.estimate(input.moduleSpec);

  type Ranked =
    | { kind: 'symbol'; item: SymbolContext; score: number; cost: number }
    | { kind: 'summary'; item: ArchitectureSummary; score: number; cost: number };

  const ranked: Ranked[] = [
    ...input.symbols.map((item) => ({
      kind: 'symbol' as const,
      item,
      score: item.score,
      cost: estimateOptionalItem(tokens, 'symbol', item),
    })),
    ...input.summaries.map((item) => ({
      kind: 'summary' as const,
      item,
      score: item.score,
      cost: estimateOptionalItem(tokens, 'summary', item),
    })),
  ];

  // Higher score first; stable tie-break by id
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.id.localeCompare(b.item.id);
  });

  const keptSymbols: SymbolContext[] = [];
  const keptSummaries: ArchitectureSummary[] = [];
  const keptIds = new Set<string>();

  for (const entry of ranked) {
    if (used + entry.cost > maxTokens) continue;
    used += entry.cost;
    keptIds.add(entry.item.id);
    if (entry.kind === 'symbol') keptSymbols.push(entry.item);
    else keptSummaries.push(entry.item);
  }

  // Restore score-desc order for output determinism
  keptSymbols.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  keptSummaries.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const provenance = input.provenance.filter((p) => {
    if (p.source === 'constitution' || p.source === 'moduleSpec') return true;
    return keptIds.has(p.itemId);
  });

  provenance.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.itemId.localeCompare(b.itemId);
  });

  const out: BudgetedLayers = {
    symbols: keptSymbols,
    summaries: keptSummaries,
    provenance,
    tokenEstimate: used,
  };
  if (input.constitution !== undefined) out.constitution = input.constitution;
  if (input.moduleSpec !== undefined) out.moduleSpec = input.moduleSpec;
  return out;
}
