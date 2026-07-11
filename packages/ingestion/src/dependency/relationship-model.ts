/**
 * Ingestion-local relationship model (Module 105 B.2 slice).
 * No Memory Engine (201); no packages/core imports.
 */

export type RelationshipType =
  | 'dependsOn'
  | 'calls'
  | 'implements'
  | 'inherits'
  | 'references'
  | 'exports';

export interface SourceLocation {
  startIndex: number;
  endIndex: number;
}

export interface Relationship {
  /** Stable synthetic key for upsert-by-key semantics */
  key: string;
  type: RelationshipType;
  /** Qualified symbol id or file id (`file:<path>`) */
  from: string;
  to: string;
  metadata?: {
    location?: SourceLocation;
    via?: string;
    confidence?: number;
  };
}

export interface RelationshipDelta {
  upserts: Relationship[];
  /** Stable edge keys removed for the recomputed file set */
  deletes: string[];
  metrics: DeltaMetrics;
}

export interface DeltaMetrics {
  durationMs: number;
  upsertCount: number;
  deleteCount: number;
  unresolvableImports: number;
  filesAnalyzed: number;
}

export interface SymbolRef {
  id: string;
  name: string;
  kind: string;
  file?: string;
}

/** Stable edge key: type|from|to */
export function edgeKey(
  type: RelationshipType,
  from: string,
  to: string,
): string {
  return `${type}|${from}|${to}`;
}

export function fileId(path: string): string {
  return `file:${normalizePath(path)}`;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Deterministic sort for relationship lists */
export function compareRelationships(a: Relationship, b: Relationship): number {
  if (a.key < b.key) return -1;
  if (a.key > b.key) return 1;
  return 0;
}

export function compareSymbolRefs(a: SymbolRef, b: SymbolRef): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
