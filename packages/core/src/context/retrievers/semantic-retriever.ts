/**
 * 101 — Thin adapter over SemanticSearchPort
 */

import type { SemanticSearchPort, SymbolContext } from '../types.js';

export class SemanticRetriever {
  constructor(private readonly port: SemanticSearchPort) {}

  get mode() {
    return this.port.mode;
  }

  async retrieve(intent: string, limit = 32): Promise<SymbolContext[]> {
    const rows = await this.port.search({ intent, limit });
    return rows.map((r) => ({ ...r }));
  }
}
