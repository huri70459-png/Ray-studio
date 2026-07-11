/**
 * Module 102 Index Builder / Incremental Indexer — B.2 types.
 * No Memory Engine (201) Entity model; symbols are 104-shaped records with file path.
 */

import type { SymbolKind, SourceRange } from '../extractor/symbol-model.js';
import type { RelationshipDelta } from '../dependency/relationship-model.js';

/** Ingestion-local symbol upsert (not 201 Entity). */
export interface SymbolRecord {
  id: string;
  kind: SymbolKind | string;
  name: string;
  qualifiedName: string;
  filePath: string;
  range?: SourceRange;
  signature?: string;
  docstring?: string;
  modifiers?: string[];
}

export interface IndexMetrics {
  durationMs: number;
  filesChanged: number;
  symbolUpsertCount: number;
  symbolDeleteCount: number;
  edgeUpsertCount: number;
  edgeDeleteCount: number;
  /** Affected path count after planning */
  affectedPathCount: number;
  skippedFiles: number;
  /** Component timings (ms) when measured */
  parseMs?: number;
  extractMs?: number;
  graphMs?: number;
  planMs?: number;
}

/**
 * Index delta produced by 102 coordination.
 * upserts/deletes are symbol-level; relationshipDelta is the 105 edge delta when computed.
 */
export interface IndexDelta {
  upserts: SymbolRecord[];
  /** Symbol ids and/or file ids removed */
  deletes: string[];
  /** Normalized file paths impacted (changed + planned dependents) */
  affectedModules: string[];
  relationshipDelta?: RelationshipDelta;
  metrics: IndexMetrics;
}

export type ChangeKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'rename'
  | 'unsupported'
  | 'skip';

export interface ClassifiedChange {
  kind: ChangeKind;
  path: string;
  /** Present for rename */
  fromPath?: string;
  toPath?: string;
  reason?: string;
}

export type IndexerLogger = {
  info?(message: string, fields?: Record<string, unknown>): void;
  warn?(message: string, fields?: Record<string, unknown>): void;
  debug?(message: string, fields?: Record<string, unknown>): void;
};

/**
 * Options for reindexPath.
 *
 * ## R1 scope policy (accepted 105 B.2 debt)
 * 105 may own edges coarsely across multi-file batches (`keysByFile`).
 * 102 therefore recomputes 105 edges for the **explicit source map** passed into
 * `computeDelta` / `applyDelta` — not a finer single-file ownership model.
 *
 * Default: source map = changed path + `relatedSources` (if any).
 * `applyDelta` always receives explicit `scopeFiles` equal to those map keys.
 * Callers needing multi-file `dependsOn` edges must supply neighbor sources via
 * `relatedSources` (or use `reindexPaths`). 102 does not rewrite 105 to fix R1.
 */
export interface ReindexOptions {
  /** Source text for the path (required unless delete: true) */
  source?: string;
  projectId?: string;
  language?: string;
  /**
   * Neighbor / co-indexed sources for multi-file edge resolution.
   * Keys are paths; values are source text. Included in 105 scopeFiles.
   */
  relatedSources?: Record<string, string>;
  /** When true, treat path as deleted (empty source optional) */
  delete?: boolean;
}

export interface RenameOptions {
  projectId?: string;
  /** Source at the new path; defaults to previously indexed source at fromPath if available */
  newSource?: string;
  language?: string;
  relatedSources?: Record<string, string>;
}

/** Deterministic sort for SymbolRecord lists */
export function compareSymbolRecords(a: SymbolRecord, b: SymbolRecord): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  if (a.filePath < b.filePath) return -1;
  if (a.filePath > b.filePath) return 1;
  return 0;
}

export function emptyIndexDelta(
  partial?: Partial<IndexMetrics> & { affectedModules?: string[] },
): IndexDelta {
  const metrics: IndexMetrics = {
    durationMs: partial?.durationMs ?? 0,
    filesChanged: partial?.filesChanged ?? 0,
    symbolUpsertCount: 0,
    symbolDeleteCount: 0,
    edgeUpsertCount: 0,
    edgeDeleteCount: 0,
    affectedPathCount: partial?.affectedModules?.length ?? 0,
    skippedFiles: partial?.skippedFiles ?? 0,
  };
  if (partial?.parseMs !== undefined) metrics.parseMs = partial.parseMs;
  if (partial?.extractMs !== undefined) metrics.extractMs = partial.extractMs;
  if (partial?.graphMs !== undefined) metrics.graphMs = partial.graphMs;
  if (partial?.planMs !== undefined) metrics.planMs = partial.planMs;
  return {
    upserts: [],
    deletes: [],
    affectedModules: partial?.affectedModules ?? [],
    metrics,
  };
}
