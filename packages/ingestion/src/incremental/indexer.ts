/**
 * Module 102 — Incremental Index Builder (Phase B.2 slice).
 *
 * Coordinator only: classify → plan affected → parse(103) → extract(104) →
 * computeDelta(105) → apply with explicit scopeFiles → IndexDelta.
 *
 * Continuous watcher/git/MCP/201 deferred.
 * R1: recompute edges for explicit source-map scope only; do not fix 105 ownership.
 */

import type { TreeSitterParser } from '../parser/types.js';
import { createTreeSitterParser } from '../parser/parser.js';
import { detectLanguageFromPath } from '../parser/language-detect.js';
import type { SymbolExtractor } from '../extractor/symbol-extractor.js';
import { createSymbolExtractor } from '../extractor/symbol-extractor.js';
import type { Symbol } from '../extractor/symbol-model.js';
import type { DependencyGraph } from '../dependency/dependency-graph.js';
import { createDependencyGraph } from '../dependency/dependency-graph.js';
import {
  fileId,
  normalizePath,
  type RelationshipDelta,
} from '../dependency/relationship-model.js';
import { calculateAffectedSet } from './affected-set-calculator.js';
import {
  applyRelationshipBatch,
  applySymbolBatch,
  createSymbolRegistry,
  type SymbolRegistry,
} from './batch-applier.js';
import { classifyChange } from './change-classifier.js';
import { PathCoalescer } from './debouncer.js';
import type {
  IndexDelta,
  IndexerLogger,
  IndexMetrics,
  ReindexOptions,
  RenameOptions,
  SymbolRecord,
} from './types.js';
import { compareSymbolRecords, emptyIndexDelta } from './types.js';

export interface IncrementalIndexerOptions {
  parser?: TreeSitterParser;
  extractor?: SymbolExtractor;
  graph?: DependencyGraph;
  logger?: IndexerLogger;
  /** Default project id when options omit it */
  defaultProjectId?: string;
  /**
   * Optional coalescer delay for scheduleReindex (FT-010).
   * Continuous FS watch remains deferred.
   */
  coalesceMs?: number;
}

export interface IncrementalIndexer {
  /**
   * ponytail: continuous FileSystemWatcher deferred for B.2.
   * start/stop are no-ops unless a future injectable watcher is wired.
   */
  start(): Promise<void>;
  stop(): Promise<void>;

  /**
   * Primary B.2 surface: reindex one path with source text.
   * Does not require 201. See ReindexOptions R1 scope policy.
   */
  reindexPath(path: string, options?: ReindexOptions): Promise<IndexDelta>;

  /** Batch reindex with shared related source map (all paths in one 105 scope). */
  reindexPaths(
    paths: Array<{ path: string; source: string; language?: string }>,
    options?: { projectId?: string },
  ): Promise<IndexDelta>;

  /** Delete path: symbol deletes + edge recompute for remaining related scope if any. */
  deletePath(
    path: string,
    options?: { projectId?: string; relatedSources?: Record<string, string> },
  ): Promise<IndexDelta>;

  /**
   * B.2 rename policy: delete old path + reindex new path (no full repo ref-rewrite).
   */
  renamePath(
    fromPath: string,
    toPath: string,
    options?: RenameOptions,
  ): Promise<IndexDelta>;

  getLastIndexedVersion(filePath: string): Promise<number | null>;

  /** Plan affected paths (changed + 105 direct dependents). */
  planAffected(changedPaths: string[]): Promise<string[]>;

  /**
   * Schedule path for coalesced flush (in-process only; no FS watch).
   * Uses source cache; continuous FileSystemWatcher remains deferred.
   */
  scheduleReindex(path: string, source: string): void;

  /** Flush coalescer immediately (tests / explicit batch). */
  flushCoalescer(): Promise<void>;

  /** Coalescer unique pending path count (bounded by unique paths). */
  coalescerPendingCount(): number;

  /** Access in-process graph (tests / consumers). */
  getGraph(): DependencyGraph;

  reset(): void;
}

class IncrementalIndexerImpl implements IncrementalIndexer {
  private readonly parser: TreeSitterParser;
  private readonly extractor: SymbolExtractor;
  private readonly graph: DependencyGraph;
  private readonly logger: IndexerLogger | undefined;
  private readonly defaultProjectId: string;
  private readonly registry: SymbolRegistry = createSymbolRegistry();
  /** Last known sources for coalesced reindex / multi-file helpers */
  private readonly sourceCache = new Map<string, string>();
  private readonly coalescer: PathCoalescer;
  /** Per-path single-flight locks for concurrent safety */
  private readonly pathLocks = new Map<string, Promise<void>>();
  private started = false;

  constructor(
    parser: TreeSitterParser,
    extractor: SymbolExtractor,
    graph: DependencyGraph,
    options: IncrementalIndexerOptions,
  ) {
    this.parser = parser;
    this.extractor = extractor;
    this.graph = graph;
    this.logger = options.logger;
    this.defaultProjectId = options.defaultProjectId ?? 'default';
    const delay = options.coalesceMs ?? 20;
    this.coalescer = new PathCoalescer(delay, async (paths) => {
      for (const p of paths) {
        const src = this.sourceCache.get(p);
        if (src !== undefined) {
          await this.reindexPath(p, { source: src });
        }
      }
    });
  }

  async start(): Promise<void> {
    // ponytail: continuous watch deferred; start is a lifecycle no-op for B.2
    this.started = true;
    this.logger?.info?.('index:started', { mode: 'reindexPath-primary' });
  }

  async stop(): Promise<void> {
    this.coalescer.dispose();
    this.started = false;
    this.logger?.info?.('index:stopped', {});
  }

  getGraph(): DependencyGraph {
    return this.graph;
  }

  reset(): void {
    this.registry.byFile.clear();
    this.registry.pathBySymbolId.clear();
    this.registry.versions.clear();
    this.sourceCache.clear();
    this.graph.reset();
    this.coalescer.dispose();
  }

  async getLastIndexedVersion(filePath: string): Promise<number | null> {
    const v = this.registry.versions.get(normalizePath(filePath));
    return v === undefined ? null : v;
  }

  async planAffected(changedPaths: string[]): Promise<string[]> {
    return calculateAffectedSet({
      changedPaths,
      graph: this.graph,
      includeDependents: true,
    });
  }

  scheduleReindex(path: string, source: string): void {
    const p = normalizePath(path);
    this.sourceCache.set(p, source);
    this.coalescer.schedule(p);
  }

  coalescerPendingCount(): number {
    return this.coalescer.pendingCount();
  }

  async flushCoalescer(): Promise<void> {
    await this.coalescer.flushNow();
  }

  async reindexPath(path: string, options: ReindexOptions = {}): Promise<IndexDelta> {
    const norm = normalizePath(path);
    return this.withPathLock(norm, () => this.reindexPathUnlocked(norm, options));
  }

  async deletePath(
    path: string,
    options: { projectId?: string; relatedSources?: Record<string, string> } = {},
  ): Promise<IndexDelta> {
    const opts: ReindexOptions = { delete: true, source: '' };
    if (options.projectId !== undefined) opts.projectId = options.projectId;
    if (options.relatedSources !== undefined) {
      opts.relatedSources = options.relatedSources;
    }
    return this.reindexPath(path, opts);
  }

  async renamePath(
    fromPath: string,
    toPath: string,
    options: RenameOptions = {},
  ): Promise<IndexDelta> {
    const from = normalizePath(fromPath);
    const to = normalizePath(toPath);
    const t0 = performance.now();
    const projectId = options.projectId ?? this.defaultProjectId;

    const newSource =
      options.newSource ??
      this.sourceCache.get(from) ??
      this.sourceCache.get(to);

    // B.2 policy: delete old + reindex new (no cross-repo reference rewrite)
    const delOpts: {
      projectId: string;
      relatedSources?: Record<string, string>;
    } = { projectId };
    if (options.relatedSources !== undefined) {
      delOpts.relatedSources = options.relatedSources;
    }
    const del = await this.deletePath(from, delOpts);

    if (newSource === undefined) {
      return {
        ...del,
        metrics: {
          ...del.metrics,
          durationMs: performance.now() - t0,
        },
      };
    }

    const addOpts: ReindexOptions = {
      source: newSource,
      projectId,
    };
    if (options.language !== undefined) addOpts.language = options.language;
    if (options.relatedSources !== undefined) {
      addOpts.relatedSources = options.relatedSources;
    }
    const add = await this.reindexPath(to, addOpts);

    return mergeDeltas(del, add, performance.now() - t0);
  }

  async reindexPaths(
    paths: Array<{ path: string; source: string; language?: string }>,
    options: { projectId?: string } = {},
  ): Promise<IndexDelta> {
    const t0 = performance.now();
    const projectId = options.projectId ?? this.defaultProjectId;
    if (paths.length === 0) {
      return emptyIndexDelta({ durationMs: 0, filesChanged: 0 });
    }

    const sourceByPath: Record<string, string> = {};
    for (const p of paths) {
      sourceByPath[normalizePath(p.path)] = p.source;
    }

    // Process each file's symbols; one shared 105 scope for all
    return this.coordinateBatch(sourceByPath, projectId, t0, {
      languageByPath: Object.fromEntries(
        paths.map((p) => [normalizePath(p.path), p.language]),
      ),
    });
  }

  private async reindexPathUnlocked(
    path: string,
    options: ReindexOptions,
  ): Promise<IndexDelta> {
    const t0 = performance.now();
    const projectId = options.projectId ?? this.defaultProjectId;
    const previouslyIndexed = this.registry.byFile.has(path);

    const classifyInput: Parameters<typeof classifyChange>[0] = {
      path,
      previouslyIndexed,
    };
    if (options.source !== undefined) classifyInput.source = options.source;
    if (options.delete !== undefined) classifyInput.delete = options.delete;
    const classified = classifyChange(classifyInput);

    if (classified.kind === 'unsupported') {
      this.logger?.warn?.('index:skip-unsupported', {
        path,
        reason: classified.reason,
      });
      return emptyIndexDelta({
        durationMs: performance.now() - t0,
        skippedFiles: 1,
        affectedModules: [path],
      });
    }

    if (classified.kind === 'skip') {
      this.logger?.warn?.('index:skip-missing-source', { path });
      return emptyIndexDelta({
        durationMs: performance.now() - t0,
        skippedFiles: 1,
        affectedModules: [path],
      });
    }

    if (classified.kind === 'delete' || options.delete === true) {
      return this.deleteUnlocked(path, projectId, options.relatedSources, t0);
    }

    const source = options.source ?? '';
    // Build source map: changed + related (R1 explicit scope)
    const sourceByPath: Record<string, string> = {
      [path]: source,
    };
    if (options.relatedSources) {
      for (const [k, v] of Object.entries(options.relatedSources)) {
        const nk = normalizePath(k);
        if (nk !== path) sourceByPath[nk] = v;
      }
    }

    const planT0 = performance.now();
    const planned = await calculateAffectedSet({
      changedPaths: [path],
      graph: this.graph,
      includeDependents: true,
    });
    const planMs = performance.now() - planT0;

    // Only re-parse paths we have sources for (scope policy)
    const coordinatePaths = Object.keys(sourceByPath).sort();

    const batchExtra: {
      languageByPath?: Record<string, string | undefined>;
      planMs: number;
      plannedAffected: string[];
    } = { planMs, plannedAffected: planned };
    if (options.language !== undefined) {
      batchExtra.languageByPath = { [path]: options.language };
    }
    const result = await this.coordinateBatch(
      sourceByPath,
      projectId,
      t0,
      batchExtra,
    );

    // Ensure primary path is listed even if plan empty
    if (!result.affectedModules.includes(path)) {
      result.affectedModules = [...result.affectedModules, path].sort();
    }
    void coordinatePaths;
    return result;
  }

  private async deleteUnlocked(
    path: string,
    projectId: string,
    relatedSources: Record<string, string> | undefined,
    t0: number,
  ): Promise<IndexDelta> {
    const planT0 = performance.now();
    const planned = await calculateAffectedSet({
      changedPaths: [path],
      graph: this.graph,
      includeDependents: true,
    });
    const planMs = performance.now() - planT0;

    const { upserts, deletes: symDeletes } = applySymbolBatch(
      this.registry,
      {},
      [path],
    );
    this.sourceCache.delete(path);

    // Remaining sources for edge recompute: related + cached neighbors (not deleted path)
    const sourceByPath: Record<string, string> = {};
    if (relatedSources) {
      for (const [k, v] of Object.entries(relatedSources)) {
        const nk = normalizePath(k);
        if (nk !== path) sourceByPath[nk] = v;
      }
    }
    for (const p of planned) {
      if (p === path) continue;
      if (sourceByPath[p] === undefined && this.sourceCache.has(p)) {
        sourceByPath[p] = this.sourceCache.get(p)!;
      }
    }

    let relationshipDelta: RelationshipDelta | undefined;
    let graphMs = 0;
    let parseMs = 0;
    let extractMs = 0;

    if (Object.keys(sourceByPath).length > 0) {
      const batch = await this.parseExtractGraph(sourceByPath, projectId, {});
      parseMs = batch.parseMs;
      extractMs = batch.extractMs;
      graphMs = batch.graphMs;
      relationshipDelta = batch.relationshipDelta;
      // Apply edges only for remaining scope (explicit scopeFiles — not including deleted)
      await applyRelationshipBatch(
        this.graph,
        relationshipDelta,
        Object.keys(sourceByPath),
      );
      // Also clear edges owned under deleted path by applying empty delta with scope [path]
      // R1: may clear coarser than ideal; matches documented policy
      await applyRelationshipBatch(
        this.graph,
        {
          upserts: [],
          deletes: [],
          metrics: {
            durationMs: 0,
            upsertCount: 0,
            deleteCount: 0,
            unresolvableImports: 0,
            filesAnalyzed: 0,
          },
        },
        [path],
      );
    } else {
      // No neighbors: clear scope for deleted file only
      await applyRelationshipBatch(
        this.graph,
        {
          upserts: [],
          deletes: [],
          metrics: {
            durationMs: 0,
            upsertCount: 0,
            deleteCount: 0,
            unresolvableImports: 0,
            filesAnalyzed: 0,
          },
        },
        [path],
      );
    }

    const metrics = buildMetrics({
      durationMs: performance.now() - t0,
      filesChanged: 1,
      symbolUpsertCount: upserts.length,
      symbolDeleteCount: symDeletes.length,
      edgeUpsertCount: relationshipDelta?.metrics.upsertCount ?? 0,
      edgeDeleteCount: relationshipDelta?.metrics.deleteCount ?? 0,
      affectedPathCount: planned.length,
      skippedFiles: 0,
      parseMs,
      extractMs,
      graphMs,
      planMs,
    });

    this.logger?.info?.('index:delta-ready', {
      path,
      kind: 'delete',
      symbolDeletes: symDeletes.length,
      ms: metrics.durationMs,
    });

    const out: IndexDelta = {
      upserts,
      deletes: symDeletes,
      affectedModules: planned,
      metrics,
    };
    if (relationshipDelta !== undefined) {
      out.relationshipDelta = relationshipDelta;
    }
    return out;
  }

  private async coordinateBatch(
    sourceByPath: Record<string, string>,
    projectId: string,
    t0: number,
    extra: {
      languageByPath?: Record<string, string | undefined>;
      planMs?: number;
      plannedAffected?: string[];
    },
  ): Promise<IndexDelta> {
    const paths = Object.keys(sourceByPath).sort();
    for (const p of paths) {
      this.sourceCache.set(p, sourceByPath[p]!);
    }

    const batch = await this.parseExtractGraph(
      sourceByPath,
      projectId,
      extra.languageByPath ?? {},
    );

    // Explicit scopeFiles = all keys in source map (R1 policy)
    const scopeFiles = paths;
    await applyRelationshipBatch(
      this.graph,
      batch.relationshipDelta,
      scopeFiles,
    );

    const symbolsByPath: Record<string, SymbolRecord[]> = {};
    for (const p of paths) {
      symbolsByPath[p] = batch.recordsByPath[p] ?? [];
    }

    const { upserts, deletes } = applySymbolBatch(
      this.registry,
      symbolsByPath,
      [],
    );

    const planned =
      extra.plannedAffected ??
      (await calculateAffectedSet({
        changedPaths: paths,
        graph: this.graph,
        includeDependents: true,
      }));

    const metricsBase: IndexMetrics = {
      durationMs: performance.now() - t0,
      filesChanged: paths.length,
      symbolUpsertCount: upserts.length,
      symbolDeleteCount: deletes.length,
      edgeUpsertCount: batch.relationshipDelta.metrics.upsertCount,
      edgeDeleteCount: batch.relationshipDelta.metrics.deleteCount,
      affectedPathCount: planned.length,
      skippedFiles: batch.skipped,
      parseMs: batch.parseMs,
      extractMs: batch.extractMs,
      graphMs: batch.graphMs,
    };
    if (extra.planMs !== undefined) metricsBase.planMs = extra.planMs;
    const metrics = buildMetrics(metricsBase);

    this.logger?.info?.('index:delta-ready', {
      files: paths.length,
      symbolUpserts: upserts.length,
      edgeUpserts: metrics.edgeUpsertCount,
      ms: metrics.durationMs,
    });

    return {
      upserts: [...upserts].sort(compareSymbolRecords),
      deletes,
      affectedModules: planned,
      relationshipDelta: batch.relationshipDelta,
      metrics,
    };
  }

  private async parseExtractGraph(
    sourceByPath: Record<string, string>,
    projectId: string,
    languageByPath: Record<string, string | undefined>,
  ): Promise<{
    recordsByPath: Record<string, SymbolRecord[]>;
    symbols: Symbol[];
    fileBySymbolId: Record<string, string>;
    symbolsByPath: Record<string, Symbol[]>;
    relationshipDelta: RelationshipDelta;
    parseMs: number;
    extractMs: number;
    graphMs: number;
    skipped: number;
  }> {
    let parseMs = 0;
    let extractMs = 0;
    let skipped = 0;
    const recordsByPath: Record<string, SymbolRecord[]> = {};
    const symbolsByPath: Record<string, Symbol[]> = {};
    const fileBySymbolId: Record<string, string> = {};
    const allSymbols: Symbol[] = [];
    const paths = Object.keys(sourceByPath).sort();

    for (const path of paths) {
      const source = sourceByPath[path]!;
      let language =
        languageByPath[path] ?? detectLanguageFromPath(path) ?? undefined;

      if (!language) {
        this.logger?.warn?.('index:skip-unknown-language', { path });
        skipped += 1;
        recordsByPath[path] = [];
        symbolsByPath[path] = [];
        continue;
      }

      try {
        const p0 = performance.now();
        const parseResult = await this.parser.parse({
          source,
          language,
          filePath: path,
        });
        parseMs += performance.now() - p0;
        language = parseResult.language;

        const e0 = performance.now();
        const symbols = this.extractor.extract(
          parseResult.tree,
          language,
          source,
        );
        extractMs += performance.now() - e0;

        // Dispose tree when available — no unbounded retention
        parseResult.tree.delete?.();

        symbolsByPath[path] = symbols;
        for (const s of symbols) {
          fileBySymbolId[s.id] = path;
          allSymbols.push(s);
        }
        recordsByPath[path] = symbols.map((s) => toRecord(s, path));
      } catch (err) {
        this.logger?.warn?.('index:file-failed', {
          path,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped += 1;
        recordsByPath[path] = [];
        symbolsByPath[path] = [];
        // batch continues
      }
    }

    const g0 = performance.now();
    const relationshipDelta = await this.graph.computeDelta({
      projectId,
      sourceByPath,
      changedSymbols: allSymbols,
      fileBySymbolId,
      symbolsByPath,
    });
    const graphMs = performance.now() - g0;

    return {
      recordsByPath,
      symbols: allSymbols,
      fileBySymbolId,
      symbolsByPath,
      relationshipDelta,
      parseMs,
      extractMs,
      graphMs,
      skipped,
    };
  }

  private async withPathLock<T>(
    path: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prev = this.pathLocks.get(path) ?? Promise.resolve();
    let resolveNext!: () => void;
    const next = new Promise<void>((r) => {
      resolveNext = r;
    });
    this.pathLocks.set(
      path,
      prev.then(() => next),
    );
    await prev;
    try {
      return await fn();
    } finally {
      resolveNext();
    }
  }
}

function toRecord(s: Symbol, filePath: string): SymbolRecord {
  const rec: SymbolRecord = {
    id: s.id,
    kind: s.kind,
    name: s.name,
    qualifiedName: s.qualifiedName,
    filePath: normalizePath(filePath),
    range: s.range,
  };
  if (s.signature !== undefined) rec.signature = s.signature;
  if (s.docstring !== undefined) rec.docstring = s.docstring;
  if (s.modifiers !== undefined) rec.modifiers = s.modifiers;
  return rec;
}

function buildMetrics(m: IndexMetrics): IndexMetrics {
  return m;
}

function mergeDeltas(a: IndexDelta, b: IndexDelta, durationMs: number): IndexDelta {
  const upserts = [...a.upserts, ...b.upserts].sort(compareSymbolRecords);
  const deletes = [...new Set([...a.deletes, ...b.deletes])].sort();
  const affectedModules = [
    ...new Set([...a.affectedModules, ...b.affectedModules]),
  ].sort();
  const out: IndexDelta = {
    upserts,
    deletes,
    affectedModules,
    metrics: {
      durationMs,
      filesChanged: a.metrics.filesChanged + b.metrics.filesChanged,
      symbolUpsertCount: upserts.length,
      symbolDeleteCount: deletes.length,
      edgeUpsertCount:
        (a.metrics.edgeUpsertCount ?? 0) + (b.metrics.edgeUpsertCount ?? 0),
      edgeDeleteCount:
        (a.metrics.edgeDeleteCount ?? 0) + (b.metrics.edgeDeleteCount ?? 0),
      affectedPathCount: affectedModules.length,
      skippedFiles: a.metrics.skippedFiles + b.metrics.skippedFiles,
      parseMs: (a.metrics.parseMs ?? 0) + (b.metrics.parseMs ?? 0),
      extractMs: (a.metrics.extractMs ?? 0) + (b.metrics.extractMs ?? 0),
      graphMs: (a.metrics.graphMs ?? 0) + (b.metrics.graphMs ?? 0),
    },
  };
  const rel = b.relationshipDelta ?? a.relationshipDelta;
  if (rel !== undefined) out.relationshipDelta = rel;
  return out;
}

/**
 * Create Incremental Indexer. Builds 103/104/105 via public factories when not injected.
 */
export async function createIncrementalIndexer(
  options: IncrementalIndexerOptions = {},
): Promise<IncrementalIndexer> {
  const parser =
    options.parser ??
    (await createTreeSitterParser(
      options.logger !== undefined ? { logger: options.logger } : {},
    ));
  const extractor =
    options.extractor ??
    createSymbolExtractor(
      parser,
      options.logger !== undefined ? { logger: options.logger } : {},
    );
  const graph =
    options.graph ??
    createDependencyGraph(
      options.logger !== undefined ? { logger: options.logger } : {},
    );
  return new IncrementalIndexerImpl(parser, extractor, graph, options);
}

/** Sync factory when parser/extractor/graph already available (tests). */
export function createIncrementalIndexerSync(
  options: Required<
    Pick<IncrementalIndexerOptions, 'parser' | 'extractor' | 'graph'>
  > &
    IncrementalIndexerOptions,
): IncrementalIndexer {
  return new IncrementalIndexerImpl(
    options.parser,
    options.extractor,
    options.graph,
    options,
  );
}

// Re-export fileId for tests that assert graph queries
export { fileId };
