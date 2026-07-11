/**
 * Affected-set planner — uses 105 dependents queries when graph has edges.
 *
 * R1 note: dependents membership is correct for applied edges; edge *ownership*
 * on re-apply may be coarser than ideal. Planning expands path set for callers;
 * reindex still applies only the explicit source-map scope to 105.
 */

import type { DependencyGraph } from '../dependency/dependency-graph.js';
import {
  fileId,
  normalizePath,
} from '../dependency/relationship-model.js';

export interface AffectedSetInput {
  /** Paths that changed (normalized later) */
  changedPaths: string[];
  graph: DependencyGraph;
  /**
   * When true (default), include direct dependents of each changed file id
   * via 105 getDirectDependents.
   */
  includeDependents?: boolean;
}

/**
 * Plan ordered unique affected paths: changed paths first (sorted), then dependents (sorted).
 */
export async function calculateAffectedSet(
  input: AffectedSetInput,
): Promise<string[]> {
  const include = input.includeDependents !== false;
  const changed = [
    ...new Set(input.changedPaths.map((p) => normalizePath(p))),
  ].sort();
  const affected = new Set<string>(changed);

  if (include) {
    for (const path of changed) {
      const fid = fileId(path);
      const dependents = await input.graph.getDirectDependents(fid);
      for (const d of dependents) {
        if (d.file) {
          affected.add(normalizePath(d.file));
        } else if (d.id.startsWith('file:')) {
          affected.add(normalizePath(d.id.slice('file:'.length)));
        }
      }
    }
  }

  // Stable: changed paths in sort order, then remaining sorted
  const rest = [...affected].filter((p) => !changed.includes(p)).sort();
  return [...changed, ...rest];
}
