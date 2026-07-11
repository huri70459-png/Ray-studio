/**
 * Live SummaryPort — thin inventory-style summaries from indexed paths.
 *
 * ponytail: true architecture-summary engine is deferred. B.2 produces one summary
 * per file path (symbol inventory), optionally filtered by intent tokens / targetModule.
 */

import type { SymbolRecord } from '../incremental/types.js';
import { tokenizeIntent } from './rank.js';
import { resolveSymbolRecords } from './source.js';
import type {
  ArchitectureSummary,
  LiveSummaryPortOptions,
  SummaryPort,
} from './types.js';

function groupByPath(
  records: readonly SymbolRecord[],
): Map<string, SymbolRecord[]> {
  const map = new Map<string, SymbolRecord[]>();
  for (const r of records) {
    const path = r.filePath || '(unknown)';
    const list = map.get(path);
    if (list) list.push(r);
    else map.set(path, [r]);
  }
  return map;
}

function pathMatches(
  path: string,
  tokens: readonly string[],
  targetModule?: string,
): boolean {
  const p = path.toLowerCase();
  if (targetModule) {
    const tm = targetModule.toLowerCase();
    if (!p.includes(tm) && !p.includes(tm.replace(/^0+/, ''))) {
      // still allow if any token matches
    } else {
      return true;
    }
  }
  if (tokens.length === 0) return true;
  return tokens.some((t) => p.includes(t));
}

class LiveInventorySummaryPort implements SummaryPort {
  readonly mode = 'live' as const;

  constructor(private readonly options: LiveSummaryPortOptions) {}

  async getSummaries(query: {
    intent: string;
    targetModule?: string;
  }): Promise<ArchitectureSummary[]> {
    const records = resolveSymbolRecords(this.options);
    const byPath = groupByPath(records);
    const tokens = tokenizeIntent(query.intent);
    const summaries: ArchitectureSummary[] = [];

    const paths = [...byPath.keys()].sort();
    for (const path of paths) {
      if (!pathMatches(path, tokens, query.targetModule)) continue;
      const syms = byPath.get(path) ?? [];
      syms.sort((a, b) => a.id.localeCompare(b.id));
      const names = syms.map((s) => s.name).join(', ');
      const body =
        syms.length === 0
          ? `No symbols indexed for ${path}.`
          : `Indexed symbols (${syms.length}): ${names}`;
      // Prefer paths that match more tokens
      let score = 0.5;
      if (tokens.length > 0) {
        const p = path.toLowerCase();
        const hits = tokens.filter((t) => p.includes(t)).length;
        score = Math.min(1, 0.4 + (hits / tokens.length) * 0.6);
      }
      if (query.targetModule && path.toLowerCase().includes(query.targetModule.toLowerCase())) {
        score = Math.min(1, score + 0.2);
      }
      summaries.push({
        id: `sum:file:${path}`,
        title: `Inventory: ${path}`,
        body,
        score,
      });
    }

    summaries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

    this.options.logger?.debug?.('live-summary inventory', {
      intent: query.intent,
      paths: summaries.length,
      registrySize: records.length,
    });

    return summaries.map((s) => ({ ...s }));
  }
}

/**
 * Create a live inventory SummaryPort (not a full architecture-summary engine).
 */
export function createLiveSummaryPort(
  options: LiveSummaryPortOptions = {},
): SummaryPort {
  return new LiveInventorySummaryPort(options);
}
