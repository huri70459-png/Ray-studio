import type { Symbol } from '../extractor/symbol-model.js';
import { calculateDelta } from './delta-calculator.js';
import { InMemoryEdgeStore } from './memory-store.js';
import {
  compareRelationships,
  fileId,
  normalizePath,
  type Relationship,
  type RelationshipDelta,
  type SymbolRef,
} from './relationship-model.js';
import {
  detectLanguageFromPath,
  languageFamily,
  type FileAnalysisContext,
  type LanguageResolver,
} from './resolvers/base-resolver.js';
import { JavascriptResolver, TypescriptResolver } from './resolvers/typescript.js';
import { PythonResolver } from './resolvers/python.js';

export type DependencyLogger = {
  info?(message: string, fields?: Record<string, unknown>): void;
  warn?(message: string, fields?: Record<string, unknown>): void;
  debug?(message: string, fields?: Record<string, unknown>): void;
};

export interface DependencyGraphOptions {
  logger?: DependencyLogger;
}

/**
 * Input for computeDelta (Layer 2 + Layer 4 B.2).
 * 104 Symbol has no file path — use fileBySymbolId and/or symbolsByPath.
 */
export interface ComputeDeltaInput {
  projectId: string;
  sourceByPath: Record<string, string>;
  /** Flat symbol list (Layer 2 shape); pair with fileBySymbolId for multi-file */
  changedSymbols: Symbol[];
  /**
   * Map symbol.id → file path. Required for multi-file call resolution when
   * symbolsByPath is not provided.
   */
  fileBySymbolId?: Record<string, string>;
  /**
   * Preferred multi-file grouping. When set, overrides grouping derived from
   * changedSymbols + fileBySymbolId for those paths.
   */
  symbolsByPath?: Record<string, Symbol[]>;
}

export interface DependencyGraph {
  computeDelta(params: ComputeDeltaInput): Promise<RelationshipDelta>;
  /** B.2: apply to in-process store (not Memory Engine 201) */
  applyDelta(delta: RelationshipDelta, scopeFiles?: string[]): Promise<void>;
  getDirectDependencies(id: string): Promise<SymbolRef[]>;
  getDirectDependents(id: string): Promise<SymbolRef[]>;
  getTransitiveDependents(id: string, maxDepth?: number): Promise<SymbolRef[]>;
  /** Test/debug: snapshot all edges */
  listRelationships(): Relationship[];
  /** Clear in-process store (does not retain sources/trees) */
  reset(): void;
}

class DependencyGraphImpl implements DependencyGraph {
  private readonly logger?: DependencyLogger;
  private readonly store = new InMemoryEdgeStore();
  private readonly resolvers: LanguageResolver[];
  /** Last analyzed source paths (for apply scope default) */
  private lastScopeFiles: string[] = [];
  /** Symbol refs accumulated for queries */
  private readonly pendingRefs: SymbolRef[] = [];

  constructor(options: DependencyGraphOptions = {}) {
    if (options.logger !== undefined) {
      this.logger = options.logger;
    }
    this.resolvers = [
      new TypescriptResolver(),
      new JavascriptResolver(),
      new PythonResolver(),
    ];
  }

  reset(): void {
    this.store.clear();
    this.lastScopeFiles = [];
    this.pendingRefs.length = 0;
  }

  listRelationships(): Relationship[] {
    return this.store.getAll().sort(compareRelationships);
  }

  async computeDelta(params: ComputeDeltaInput): Promise<RelationshipDelta> {
    const t0 = performance.now();
    const sourceByPath = normalizeSourceMap(params.sourceByPath);
    const symbolsByPath = buildSymbolsByPath(params, sourceByPath);
    const scopeFiles = Object.keys(sourceByPath).sort();
    this.lastScopeFiles = scopeFiles;
    this.pendingRefs.length = 0;

    for (const path of scopeFiles) {
      this.pendingRefs.push({
        id: fileId(path),
        name: path.split('/').pop() ?? path,
        kind: 'file',
        file: path,
      });
      for (const s of symbolsByPath[path] ?? []) {
        this.pendingRefs.push({
          id: s.id,
          name: s.name,
          kind: s.kind,
          file: path,
        });
      }
    }

    if (scopeFiles.length === 0 && params.changedSymbols.length === 0) {
      return calculateDelta([], [], undefined, {
        durationMs: performance.now() - t0,
        unresolvableImports: 0,
        filesAnalyzed: 0,
      });
    }

    let unresolvableImports = 0;
    const byKey = new Map<string, Relationship>();

    for (const filePath of scopeFiles) {
      const source = sourceByPath[filePath] ?? '';
      const language = detectLanguageFromPath(filePath);
      const family = languageFamily(language);
      const symbols = symbolsByPath[filePath] ?? [];
      const resolver = this.pickResolver(family);
      if (!resolver) {
        this.logger?.debug?.('dependency:skip-unknown-language', {
          projectId: params.projectId,
          filePath,
          language,
        });
        continue;
      }

      const ctx: FileAnalysisContext = {
        filePath,
        source,
        language,
        symbols,
        sourceByPath,
        symbolsByPath,
      };

      const imports = resolver.collectImports(ctx);
      for (const imp of imports) {
        const relative = imp.specifier.startsWith('.');
        const pyBare = family === 'python' && !imp.resolvedPath;
        if ((relative || pyBare) && !imp.resolvedPath) {
          // External packages (non-relative JS/TS) are intentionally skipped without WARN flood
          if (relative || family === 'python') {
            unresolvableImports += 1;
            this.logger?.warn?.('dependency:unresolvable-import', {
              projectId: params.projectId,
              filePath,
              specifier: imp.specifier,
            });
          }
        }
      }

      for (const rel of resolver.collectRelationships(ctx, imports)) {
        byKey.set(rel.key, rel);
      }
    }

    const next = [...byKey.values()];
    const prevKeys = this.store.getKeysForFiles(scopeFiles);
    const delta = calculateDelta(this.store.getAll(), next, prevKeys, {
      durationMs: performance.now() - t0,
      unresolvableImports,
      filesAnalyzed: scopeFiles.length,
    });

    this.logger?.info?.('dependency:delta-computed', {
      projectId: params.projectId,
      upserts: delta.metrics.upsertCount,
      deletes: delta.metrics.deleteCount,
      ms: delta.metrics.durationMs,
      files: delta.metrics.filesAnalyzed,
    });

    return delta;
  }

  async applyDelta(
    delta: RelationshipDelta,
    scopeFiles?: string[],
  ): Promise<void> {
    const files = (scopeFiles ?? this.lastScopeFiles).map(normalizePath);
    this.store.apply(delta.upserts, delta.deletes, files, this.pendingRefs);
    this.logger?.info?.('dependency:edges-upserted', {
      upserts: delta.upserts.length,
      deletes: delta.deletes.length,
    });
  }

  async getDirectDependencies(id: string): Promise<SymbolRef[]> {
    return this.store.getDirectDependencies(id);
  }

  async getDirectDependents(id: string): Promise<SymbolRef[]> {
    return this.store.getDirectDependents(id);
  }

  async getTransitiveDependents(
    id: string,
    maxDepth = 8,
  ): Promise<SymbolRef[]> {
    return this.store.getTransitiveDependents(id, maxDepth);
  }

  private pickResolver(
    family: ReturnType<typeof languageFamily>,
  ): LanguageResolver | undefined {
    if (family === 'unknown') return undefined;
    return this.resolvers.find((r) => r.family === family);
  }
}

function normalizeSourceMap(
  sourceByPath: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sourceByPath)) {
    out[normalizePath(k)] = v;
  }
  return out;
}

function buildSymbolsByPath(
  params: ComputeDeltaInput,
  sourceByPath: Record<string, string>,
): Record<string, Symbol[]> {
  const out: Record<string, Symbol[]> = {};

  if (params.symbolsByPath) {
    for (const [k, syms] of Object.entries(params.symbolsByPath)) {
      out[normalizePath(k)] = syms;
    }
  }

  if (params.fileBySymbolId && params.changedSymbols.length > 0) {
    for (const s of params.changedSymbols) {
      const file = params.fileBySymbolId[s.id];
      if (!file) continue;
      const p = normalizePath(file);
      if (!out[p]) out[p] = [];
      if (!out[p]!.some((x) => x.id === s.id)) out[p]!.push(s);
    }
  } else if (params.changedSymbols.length > 0 && !params.symbolsByPath) {
    const paths = Object.keys(sourceByPath);
    if (paths.length === 1) {
      out[paths[0]!] = [...params.changedSymbols];
    }
  }

  for (const p of Object.keys(sourceByPath)) {
    if (!out[p]) out[p] = [];
  }

  return out;
}

/**
 * Create a Dependency Graph service (B.2 slice — in-process store only).
 * Does not own 103 parser or 104 extractor implementations.
 */
export function createDependencyGraph(
  options?: DependencyGraphOptions,
): DependencyGraph {
  return new DependencyGraphImpl(options ?? {});
}
