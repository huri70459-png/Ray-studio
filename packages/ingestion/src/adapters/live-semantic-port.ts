/**
 * Live SemanticSearchPort — **lexical** keyword search over the same symbol source.
 *
 * ponytail: true embedding / vector semantic search is deferred (future 107/108-class).
 * This B.2 port uses the same token ranking as live graph, labeled mode: 'live',
 * so hosts can wire createContextEngine({ semantic: liveLexical, ... }) without 201/embeddings.
 */

import { rankSymbols } from './rank.js';
import { resolveSymbolRecords } from './source.js';
import type {
  LiveSemanticSearchPortOptions,
  SemanticSearchPort,
  SymbolContext,
} from './types.js';

const DEFAULT_SNIPPET = 200;

class LiveLexicalSemanticSearchPort implements SemanticSearchPort {
  readonly mode = 'live' as const;

  constructor(private readonly options: LiveSemanticSearchPortOptions) {}

  async search(query: {
    intent: string;
    limit: number;
  }): Promise<SymbolContext[]> {
    if (query.limit <= 0) return [];
    const maxSnippet = this.options.maxSnippetLength ?? DEFAULT_SNIPPET;
    const records = resolveSymbolRecords(this.options);
    const t0 = performance.now();
    const results = rankSymbols(
      records,
      query.intent,
      query.limit,
      maxSnippet,
    );
    this.options.logger?.debug?.('live-semantic (lexical) search', {
      intent: query.intent,
      limit: query.limit,
      hits: results.length,
      registrySize: records.length,
      durationMs: Math.round((performance.now() - t0) * 1000) / 1000,
    });
    return results.map((s) => ({ ...s }));
  }
}

/**
 * Create a live lexical SemanticSearchPort (not embeddings).
 */
export function createLiveSemanticSearchPort(
  options: LiveSemanticSearchPortOptions = {},
): SemanticSearchPort {
  return new LiveLexicalSemanticSearchPort(options);
}
