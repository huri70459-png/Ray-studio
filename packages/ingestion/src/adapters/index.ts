/**
 * Module 101 Live Adapters (Phase B.2) — public adapter surface.
 * Own: packages/ingestion/src/adapters/**
 *
 * Implements structural GraphQueryPort / SemanticSearchPort / SummaryPort
 * compatible with frozen 101 B.1 ContextEngine (core). No core runtime dependency.
 */

export { createLiveGraphQueryPort } from './live-graph-port.js';
export { createLiveSemanticSearchPort } from './live-semantic-port.js';
export { createLiveSummaryPort } from './live-summary-port.js';
export {
  tokenizeIntent,
  scoreSymbolRecord,
  rankSymbols,
  compareScored,
} from './rank.js';
export { resolveSymbolRecords, indexById } from './source.js';

export type {
  PortMode,
  SymbolContext,
  ArchitectureSummary,
  GraphQueryPort,
  SemanticSearchPort,
  SummaryPort,
  AdapterLogger,
  GraphExpandPolicy,
  LiveAdapterSymbolOptions,
  LiveGraphQueryPortOptions,
  LiveSemanticSearchPortOptions,
  LiveSummaryPortOptions,
} from './types.js';
