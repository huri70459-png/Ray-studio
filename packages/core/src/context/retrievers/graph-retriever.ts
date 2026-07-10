/**
 * 101 — Thin adapter over GraphQueryPort
 */

import type { GraphQueryPort, SymbolContext } from '../types.js';

export class GraphRetriever {
  constructor(private readonly port: GraphQueryPort) {}

  get mode() {
    return this.port.mode;
  }

  async retrieve(intent: string, limit = 32): Promise<SymbolContext[]> {
    const rows = await this.port.search({ intent, limit });
    return rows.map((r) => ({ ...r, score: r.score }));
  }
}
