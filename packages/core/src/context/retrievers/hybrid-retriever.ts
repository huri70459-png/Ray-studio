/**
 * 101 — Merge graph + semantic results (symbol-level preference, stable dedup)
 */

import type { ProvenanceItem, SymbolContext } from '../types.js';

export interface HybridRetrieveResult {
  symbols: SymbolContext[];
  provenance: ProvenanceItem[];
}

function dedupeKey(s: SymbolContext): string {
  return s.id || s.path || s.name;
}

/**
 * Prefer higher score; on tie prefer graph over semantic (Constitution §4 symbol preference).
 */
export function mergeSymbolResults(
  graph: SymbolContext[],
  semantic: SymbolContext[],
): HybridRetrieveResult {
  const map = new Map<string, { symbol: SymbolContext; source: 'graph' | 'semantic' }>();

  for (const s of graph) {
    const key = dedupeKey(s);
    map.set(key, { symbol: { ...s }, source: 'graph' });
  }

  for (const s of semantic) {
    const key = dedupeKey(s);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { symbol: { ...s }, source: 'semantic' });
      continue;
    }
    if (s.score > existing.symbol.score) {
      map.set(key, { symbol: { ...s }, source: 'semantic' });
    }
    // tie: keep graph (already present)
  }

  const merged = [...map.values()];
  merged.sort(
    (a, b) =>
      b.symbol.score - a.symbol.score || a.symbol.id.localeCompare(b.symbol.id),
  );

  const symbols = merged.map((m) => m.symbol);
  const provenance: ProvenanceItem[] = merged.map((m) => ({
    itemId: m.symbol.id,
    source: m.source,
    reason:
      m.source === 'graph'
        ? 'graph traversal / symbol match'
        : 'semantic similarity match',
    score: m.symbol.score,
  }));

  return { symbols, provenance };
}
