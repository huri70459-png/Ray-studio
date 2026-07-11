/**
 * Batch applier — updates in-process symbol registry + applies 105 relationship deltas
 * with **explicit scopeFiles** (R1 / governance M3).
 */

import type { DependencyGraph } from '../dependency/dependency-graph.js';
import type { RelationshipDelta } from '../dependency/relationship-model.js';
import { normalizePath } from '../dependency/relationship-model.js';
import type { SymbolRecord } from './types.js';

export interface SymbolRegistry {
  /** path → symbols for that file */
  byFile: Map<string, SymbolRecord[]>;
  /** symbol id → path */
  pathBySymbolId: Map<string, string>;
  /** path → monotonic index version */
  versions: Map<string, number>;
}

export function createSymbolRegistry(): SymbolRegistry {
  return {
    byFile: new Map(),
    pathBySymbolId: new Map(),
    versions: new Map(),
  };
}

/**
 * Replace symbols for scope files; return { upserts, deletes } for IndexDelta.
 */
export function applySymbolBatch(
  registry: SymbolRegistry,
  /** Full new symbol sets for each path in scope (empty array = clear file) */
  symbolsByPath: Record<string, SymbolRecord[]>,
  /** Paths being removed entirely */
  deletedPaths: string[] = [],
): { upserts: SymbolRecord[]; deletes: string[] } {
  const upserts: SymbolRecord[] = [];
  const deletes: string[] = [];

  for (const raw of deletedPaths) {
    const path = normalizePath(raw);
    const prev = registry.byFile.get(path) ?? [];
    for (const s of prev) {
      deletes.push(s.id);
      registry.pathBySymbolId.delete(s.id);
    }
    deletes.push(`file:${path}`);
    registry.byFile.delete(path);
    registry.versions.delete(path);
  }

  const paths = Object.keys(symbolsByPath)
    .map(normalizePath)
    .sort();

  for (const path of paths) {
    const next = symbolsByPath[path] ?? [];
    const prev = registry.byFile.get(path) ?? [];
    const nextIds = new Set(next.map((s) => s.id));

    for (const s of prev) {
      if (!nextIds.has(s.id)) {
        deletes.push(s.id);
        registry.pathBySymbolId.delete(s.id);
      }
    }

    for (const s of next) {
      upserts.push(s);
      registry.pathBySymbolId.set(s.id, path);
    }

    registry.byFile.set(path, [...next].sort((a, b) => a.id.localeCompare(b.id)));
    const v = (registry.versions.get(path) ?? 0) + 1;
    registry.versions.set(path, v);
  }

  deletes.sort();
  upserts.sort((a, b) => a.id.localeCompare(b.id));
  return { upserts, deletes };
}

/**
 * Apply 105 relationship delta with explicit scopeFiles (never rely on implicit lastScope alone).
 */
export async function applyRelationshipBatch(
  graph: DependencyGraph,
  delta: RelationshipDelta,
  scopeFiles: string[],
): Promise<void> {
  const scope = [...new Set(scopeFiles.map(normalizePath))].sort();
  await graph.applyDelta(delta, scope);
}
