/**
 * Module 101 Live Adapters (B.2) — structural port shapes.
 *
 * Mirrors packages/core/src/context/types.ts GraphQueryPort / SemanticSearchPort /
 * SummaryPort / SymbolContext / ArchitectureSummary for dependency inversion.
 * No runtime import of @ray-studio/core (core must not depend on ingestion).
 */

import type { SymbolRegistry } from '../incremental/batch-applier.js';
import type { SymbolRecord } from '../incremental/types.js';
import type { DependencyGraph } from '../dependency/dependency-graph.js';

export type PortMode = 'null' | 'fake' | 'live';

export interface SymbolContext {
  id: string;
  path?: string;
  name: string;
  kind?: string;
  snippet?: string;
  score: number;
}

export interface ArchitectureSummary {
  id: string;
  title: string;
  body: string;
  score: number;
}

export interface GraphQueryPort {
  readonly mode: PortMode;
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

export interface SemanticSearchPort {
  readonly mode: PortMode;
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

export interface SummaryPort {
  readonly mode: PortMode;
  getSummaries(query: {
    intent: string;
    targetModule?: string;
  }): Promise<ArchitectureSummary[]>;
}

export type AdapterLogger = {
  info?(message: string, fields?: Record<string, unknown>): void;
  warn?(message: string, fields?: Record<string, unknown>): void;
  debug?(message: string, fields?: Record<string, unknown>): void;
};

/**
 * How to expand graph search results using optional 105 edge queries.
 *
 * R1: 105 keysByFile multi-file ownership may be coarse — expansion may include
 * wider neighbors than ideal single-file truth. Adapters never rewrite 105.
 *
 * - `none` (default): keyword/token rank only
 * - `direct`: after keyword hits, include direct deps + dependents present in the
 *   symbol source (when graph is injected)
 */
export type GraphExpandPolicy = 'none' | 'direct';

export interface LiveAdapterSymbolOptions {
  /**
   * Preferred live view: read registry.byFile on every search.
   * Adapter never mutates the registry.
   */
  registry?: SymbolRegistry;
  /**
   * Static / snapshot symbol list when no registry is available
   * (e.g. IndexDelta.upserts after reindexPath).
   */
  symbols?: readonly SymbolRecord[];
  logger?: AdapterLogger;
  /** Max characters for SymbolContext.snippet (default 200). */
  maxSnippetLength?: number;
}

export interface LiveGraphQueryPortOptions extends LiveAdapterSymbolOptions {
  /**
   * Optional 105 graph for neighbor expansion.
   * Only getDirectDependencies / getDirectDependents are used.
   */
  graph?: Pick<
    DependencyGraph,
    'getDirectDependencies' | 'getDirectDependents'
  >;
  expand?: GraphExpandPolicy;
}

export type LiveSemanticSearchPortOptions = LiveAdapterSymbolOptions;

export type LiveSummaryPortOptions = LiveAdapterSymbolOptions;
