import {
  compareRelationships,
  type Relationship,
  type RelationshipDelta,
  type DeltaMetrics,
} from './relationship-model.js';

/**
 * Diff previous edges for affected node endpoints against newly computed edges.
 * B.2 policy: full recompute for analyzed file ids; delete prior edges that
 * touch those files (as from/to file ids or via tracked file edge set).
 */
export function calculateDelta(
  previous: Iterable<Relationship>,
  next: Relationship[],
  /**
   * Edge keys currently owned by the recomputed file set (from last snapshot).
   * When provided, deletes = ownedKeys - nextKeys.
   * When empty/undefined, deletes = [] (first apply / pure compute).
   */
  previousKeysForScope: Iterable<string> | undefined,
  metricsBase: Omit<DeltaMetrics, 'upsertCount' | 'deleteCount' | 'durationMs'> & {
    durationMs: number;
  },
): RelationshipDelta {
  const nextSorted = [...next].sort(compareRelationships);
  const nextKeys = new Set(nextSorted.map((r) => r.key));

  const deletes: string[] = [];
  if (previousKeysForScope) {
    for (const key of previousKeysForScope) {
      if (!nextKeys.has(key)) deletes.push(key);
    }
    deletes.sort();
  }

  // Idempotent upserts: include all next edges (apply is key-based)
  void previous;

  return {
    upserts: nextSorted,
    deletes,
    metrics: {
      durationMs: metricsBase.durationMs,
      upsertCount: nextSorted.length,
      deleteCount: deletes.length,
      unresolvableImports: metricsBase.unresolvableImports,
      filesAnalyzed: metricsBase.filesAnalyzed,
    },
  };
}
