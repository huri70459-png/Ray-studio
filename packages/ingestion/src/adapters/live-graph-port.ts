/**
 * Live GraphQueryPort — keyword/token search over 102 SymbolRegistry / SymbolRecords.
 * Optional 105 direct neighbor expansion (R1: coarse ownership accepted).
 * mode is always 'live' (even when empty).
 */

import type { SymbolRecord } from '../incremental/types.js';
import {
  compareScored,
  rankSymbols,
  scoreSymbolRecord,
  tokenizeIntent,
  toSymbolContext,
} from './rank.js';
import { indexById, resolveSymbolRecords } from './source.js';
import type {
  GraphQueryPort,
  LiveGraphQueryPortOptions,
  SymbolContext,
} from './types.js';

const DEFAULT_SNIPPET = 200;
/** Expansion hits score lower than primary keyword matches. */
const EXPANSION_SCORE_FACTOR = 0.45;

class LiveGraphQueryPort implements GraphQueryPort {
  readonly mode = 'live' as const;

  constructor(private readonly options: LiveGraphQueryPortOptions) {}

  async search(query: {
    intent: string;
    limit: number;
  }): Promise<SymbolContext[]> {
    const limit = query.limit;
    if (limit <= 0) return [];

    const maxSnippet = this.options.maxSnippetLength ?? DEFAULT_SNIPPET;
    const records = resolveSymbolRecords(this.options);
    const expand = this.options.expand ?? 'none';
    const t0 = performance.now();

    // Primary keyword rank (no 103/104 in hot path)
    let results = rankSymbols(
      records,
      query.intent,
      expand === 'direct' && this.options.graph ? records.length : limit,
      maxSnippet,
    );

    if (
      expand === 'direct' &&
      this.options.graph !== undefined &&
      results.length > 0
    ) {
      results = await this.expandDirect(
        results,
        records,
        query.intent,
        limit,
        maxSnippet,
      );
    } else if (results.length > limit) {
      results = results.slice(0, limit);
    }

    this.options.logger?.debug?.('live-graph search', {
      intent: query.intent,
      limit,
      hits: results.length,
      registrySize: records.length,
      expand,
      durationMs: Math.round((performance.now() - t0) * 1000) / 1000,
    });

    // Defensive copies — never expose internal mutation surface
    return results.map((s) => ({ ...s }));
  }

  /**
   * Include direct deps/dependents present in the symbol source.
   * R1: may be wider than ideal single-file ownership; documented policy.
   */
  private async expandDirect(
    primary: SymbolContext[],
    records: readonly SymbolRecord[],
    intent: string,
    limit: number,
    maxSnippet: number,
  ): Promise<SymbolContext[]> {
    const graph = this.options.graph!;
    const byId = indexById(records);
    const tokens = tokenizeIntent(intent);
    const merged = new Map<string, SymbolContext>();

    for (const hit of primary) {
      merged.set(hit.id, hit);
    }

    for (const hit of primary) {
      if (merged.size >= limit * 4) break; // bound expansion work
      const [deps, dependents] = await Promise.all([
        graph.getDirectDependencies(hit.id),
        graph.getDirectDependents(hit.id),
      ]);
      for (const ref of [...deps, ...dependents]) {
        if (merged.has(ref.id)) continue;
        const rec = byId.get(ref.id);
        if (rec === undefined) continue;
        // Prefer keyword score when related symbol also matches intent; else scaled
        let score =
          tokens.length > 0 ? scoreSymbolRecord(rec, tokens) : 0;
        if (score <= 0) {
          score = Math.min(1, hit.score * EXPANSION_SCORE_FACTOR);
        }
        if (score <= 0) continue;
        merged.set(ref.id, toSymbolContext(rec, score, maxSnippet));
      }
    }

    const all = [...merged.values()].sort(compareScored);
    return all.slice(0, limit);
  }
}

/**
 * Create a live GraphQueryPort over an injectable symbol source.
 * Empty registry/symbols → search returns [] with mode still 'live'.
 */
export function createLiveGraphQueryPort(
  options: LiveGraphQueryPortOptions = {},
): GraphQueryPort {
  return new LiveGraphQueryPort(options);
}
