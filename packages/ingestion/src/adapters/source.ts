/**
 * Resolve SymbolRecord lists from injected registry / static symbols.
 * Adapter never mutates the source.
 */

import type { SymbolRegistry } from '../incremental/batch-applier.js';
import type { SymbolRecord } from '../incremental/types.js';
import type { LiveAdapterSymbolOptions } from './types.js';

/** Flatten registry + optional static symbols into a deterministic list. */
export function resolveSymbolRecords(
  options: LiveAdapterSymbolOptions,
): SymbolRecord[] {
  const out: SymbolRecord[] = [];
  const seen = new Set<string>();

  if (options.registry !== undefined) {
    const paths = [...options.registry.byFile.keys()].sort();
    for (const path of paths) {
      const rows = options.registry.byFile.get(path) ?? [];
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
  }

  if (options.symbols !== undefined) {
    for (const r of options.symbols) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }

  return out;
}

/** Build id → record map for expansion lookups. */
export function indexById(
  records: readonly SymbolRecord[],
): Map<string, SymbolRecord> {
  const map = new Map<string, SymbolRecord>();
  for (const r of records) {
    if (!map.has(r.id)) map.set(r.id, r);
  }
  return map;
}

/** Empty registry helper for tests / empty live mode. */
export function emptyRecordsFromRegistry(
  registry: SymbolRegistry | undefined,
): boolean {
  if (registry === undefined) return true;
  return registry.byFile.size === 0;
}
