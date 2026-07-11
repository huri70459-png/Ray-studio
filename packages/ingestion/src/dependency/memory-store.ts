import {
  compareSymbolRefs,
  type Relationship,
  type SymbolRef,
} from './relationship-model.js';

/**
 * In-process edge store for Module 105 B.2 (not Memory Engine 201).
 * Disposes nothing global; no parse trees retained.
 */
export class InMemoryEdgeStore {
  private readonly byKey = new Map<string, Relationship>();
  /** file path → edge keys produced while analyzing that file */
  private readonly keysByFile = new Map<string, Set<string>>();
  private readonly refById = new Map<string, SymbolRef>();

  clear(): void {
    this.byKey.clear();
    this.keysByFile.clear();
    this.refById.clear();
  }

  apply(
    upserts: Relationship[],
    deletes: string[],
    /** Files whose edge ownership is replaced by this apply */
    scopeFiles: string[],
    refs: SymbolRef[],
  ): void {
    for (const d of deletes) {
      this.byKey.delete(d);
    }

    for (const file of scopeFiles) {
      const prev = this.keysByFile.get(file);
      if (prev) {
        for (const k of prev) {
          // Only drop if not re-upserted
          if (!upserts.some((u) => u.key === k)) {
            this.byKey.delete(k);
          }
        }
        prev.clear();
      } else {
        this.keysByFile.set(file, new Set());
      }
    }

    for (const rel of upserts) {
      this.byKey.set(rel.key, rel);
    }

    // Recompute keysByFile for scope from upserts that touch file: ids
    for (const file of scopeFiles) {
      const set = this.keysByFile.get(file) ?? new Set<string>();
      set.clear();
      const fid = file.startsWith('file:') ? file : `file:${file.replace(/\\/g, '/')}`;
      const norm = file.replace(/\\/g, '/');
      for (const rel of upserts) {
        if (
          rel.from === fid ||
          rel.to === fid ||
          rel.from.includes(norm) ||
          // symbol edges owned by file via registry: track all upserts for scope files
          true
        ) {
          // Ownership: all upserts from this compute batch for these files
          set.add(rel.key);
        }
      }
      // Simpler ownership: all keys in this upsert batch assigned to each scope file union
      for (const rel of upserts) {
        set.add(rel.key);
      }
      this.keysByFile.set(norm, set);
    }

    for (const r of refs) {
      this.refById.set(r.id, r);
    }
  }

  getKeysForFiles(files: string[]): Set<string> {
    const out = new Set<string>();
    for (const f of files) {
      const set = this.keysByFile.get(f.replace(/\\/g, '/'));
      if (set) for (const k of set) out.add(k);
    }
    return out;
  }

  getAll(): Relationship[] {
    return [...this.byKey.values()];
  }

  get(key: string): Relationship | undefined {
    return this.byKey.get(key);
  }

  registerRef(ref: SymbolRef): void {
    this.refById.set(ref.id, ref);
  }

  getDirectDependencies(id: string): SymbolRef[] {
    const out: SymbolRef[] = [];
    const seen = new Set<string>();
    for (const rel of this.byKey.values()) {
      if (rel.from !== id) continue;
      if (seen.has(rel.to)) continue;
      seen.add(rel.to);
      out.push(this.toRef(rel.to));
    }
    return out.sort(compareSymbolRefs);
  }

  getDirectDependents(id: string): SymbolRef[] {
    const out: SymbolRef[] = [];
    const seen = new Set<string>();
    for (const rel of this.byKey.values()) {
      if (rel.to !== id) continue;
      if (seen.has(rel.from)) continue;
      seen.add(rel.from);
      out.push(this.toRef(rel.from));
    }
    return out.sort(compareSymbolRefs);
  }

  getTransitiveDependents(id: string, maxDepth = 8): SymbolRef[] {
    const out: SymbolRef[] = [];
    const seen = new Set<string>([id]);
    let frontier = [id];
    let depth = 0;
    while (frontier.length > 0 && depth < maxDepth) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const rel of this.byKey.values()) {
          if (rel.to !== cur) continue;
          if (seen.has(rel.from)) continue;
          seen.add(rel.from);
          next.push(rel.from);
          out.push(this.toRef(rel.from));
        }
      }
      frontier = next;
      depth += 1;
    }
    return out.sort(compareSymbolRefs);
  }

  private toRef(id: string): SymbolRef {
    const known = this.refById.get(id);
    if (known) return known;
    if (id.startsWith('file:')) {
      const file = id.slice('file:'.length);
      return { id, name: file.split('/').pop() ?? file, kind: 'file', file };
    }
    const name = id.includes(':') ? id.split(':')[1] ?? id : id;
    return { id, name, kind: 'unknown' };
  }
}
