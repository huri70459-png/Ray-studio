import { createRequire } from 'node:module';
import * as path from 'node:path';
import type ParserType from 'web-tree-sitter';
import { ParserError } from './errors.js';

// CJS interop: vitest/ESM default import of export= modules is unreliable
const require = createRequire(import.meta.url);
const Parser = require('web-tree-sitter') as typeof ParserType;
import {
  defaultGrammarsDir,
  defaultWebTreeSitterWasmDir,
  GrammarRegistry,
} from './grammar-registry.js';
import { detectLanguageFromPath } from './language-detect.js';
import {
  asWrappedTree,
  collectErrorNodes,
  countNodes,
  wrapNode,
  WrappedTree,
} from './node-wrap.js';
import { indexToPosition, utf8ByteLength } from './positions.js';
import type {
  IncrementalParseInput,
  ParseEdit,
  ParseInput,
  ParseResult,
  ParserOptions,
  QueryMatch,
  SyntaxNode,
  SyntaxTree,
  TreeSitterParser,
} from './types.js';

type Language = ParserType.Language;
type Tree = ParserType.Tree;

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    const wasmDir = defaultWebTreeSitterWasmDir();
    initPromise = Parser.init({
      locateFile(scriptName: string): string {
        return path.join(wasmDir, scriptName);
      },
    });
  }
  return initPromise;
}

function resolveLanguageId(input: ParseInput): string {
  if (input.language !== undefined && input.language.length > 0) {
    return input.language;
  }
  if (input.filePath !== undefined && input.filePath.length > 0) {
    const detected = detectLanguageFromPath(input.filePath);
    if (detected) return detected;
  }
  throw new ParserError(
    'INVALID_INPUT',
    'language or filePath with known extension is required',
  );
}

function assertSource(source: unknown): asserts source is string {
  if (typeof source !== 'string') {
    throw new ParserError('INVALID_INPUT', 'source must be a string');
  }
}

/** Build Tree-sitter Edit with positions when missing. */
export function buildEdit(
  previousSource: string,
  newSource: string,
  edit: ParseEdit,
): ParserType.Edit {
  const startPosition =
    edit.startPosition ?? indexToPosition(previousSource, edit.startIndex);
  const oldEndPosition =
    edit.oldEndPosition ?? indexToPosition(previousSource, edit.oldEndIndex);
  const newEndPosition =
    edit.newEndPosition ?? indexToPosition(newSource, edit.newEndIndex);
  return {
    startIndex: edit.startIndex,
    oldEndIndex: edit.oldEndIndex,
    newEndIndex: edit.newEndIndex,
    startPosition,
    oldEndPosition,
    newEndPosition,
  };
}

class TreeSitterParserImpl implements TreeSitterParser {
  private readonly registry: GrammarRegistry;
  private readonly logger: ParserOptions['logger'];
  private readonly runtime: ParserType;
  /** Serialize setLanguage + parse on the shared runtime */
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(
    registry: GrammarRegistry,
    runtime: ParserType,
    options: ParserOptions,
  ) {
    this.registry = registry;
    this.runtime = runtime;
    if (options.logger !== undefined) {
      this.logger = options.logger;
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  static async create(options: ParserOptions = {}): Promise<TreeSitterParserImpl> {
    await ensureInit();
    const grammarsDir = options.grammarsDir ?? defaultGrammarsDir();
    const registry = new GrammarRegistry(grammarsDir, options.logger);
    const runtime = new Parser();
    return new TreeSitterParserImpl(registry, runtime, options);
  }

  supportedLanguages(): string[] {
    return this.registry.supportedLanguageIds();
  }

  async parse(input: ParseInput): Promise<ParseResult> {
    assertSource(input.source);
    const language = resolveLanguageId(input);
    return this.enqueue(() =>
      this.parseWithLanguage(language, input.source, null, false),
    );
  }

  async parseIncremental(input: IncrementalParseInput): Promise<ParseResult> {
    assertSource(input.newSource);
    assertSource(input.previousSource);
    if (!input.language) {
      throw new ParserError(
        'INVALID_INPUT',
        'language is required for incremental parse',
      );
    }

    if (!input.edits || input.edits.length === 0) {
      return this.enqueue(() =>
        this.parseWithLanguage(input.language, input.newSource, null, false),
      );
    }

    const wrapped = asWrappedTree(input.oldTree);
    if (wrapped.languageId !== input.language) {
      return this.enqueue(() =>
        this.parseWithLanguage(input.language, input.newSource, null, false),
      );
    }

    return this.enqueue(async () => {
      const lang = await this.registry.load(input.language);
      const working: Tree = wrapped.raw.copy();
      try {
        for (const e of input.edits) {
          working.edit(buildEdit(input.previousSource, input.newSource, e));
        }
        return await this.parseWithLanguage(
          input.language,
          input.newSource,
          working,
          true,
          lang,
        );
      } catch (err) {
        try {
          working.delete();
        } catch {
          /* ignore */
        }
        if (err instanceof ParserError) throw err;
        this.logger?.debug?.('incremental-fallback', {
          module: 'tree-sitter-parser',
          cause: err instanceof Error ? err.message : String(err),
        });
        return this.parseWithLanguage(
          input.language,
          input.newSource,
          null,
          false,
          lang,
        );
      }
    });
  }

  query(tree: SyntaxTree, querySource: string): QueryMatch[] {
    if (typeof querySource !== 'string' || querySource.length === 0) {
      throw new ParserError(
        'INVALID_QUERY',
        'querySource must be a non-empty string',
      );
    }
    const wrapped = asWrappedTree(tree);
    try {
      const q = wrapped.language.query(querySource);
      try {
        const matches = q.matches(wrapped.raw.rootNode);
        return matches.map((m) => ({
          pattern: m.pattern,
          captures: m.captures.map((c) => ({
            name: c.name,
            node: wrapNode(c.node),
          })),
        }));
      } finally {
        q.delete();
      }
    } catch (err) {
      if (err instanceof ParserError) throw err;
      throw new ParserError(
        'INVALID_QUERY',
        err instanceof Error ? err.message : 'Invalid tree-sitter query',
        { cause: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  getNodeAtPosition(tree: SyntaxTree, byteOffset: number): SyntaxNode | null {
    const wrapped = asWrappedTree(tree);
    const node = wrapped.raw.rootNode.descendantForIndex(byteOffset, byteOffset);
    return node ? wrapNode(node) : null;
  }

  private async parseWithLanguage(
    language: string,
    source: string,
    oldTree: Tree | null,
    didEdit: boolean,
    preloaded?: Language,
  ): Promise<ParseResult> {
    if (!this.registry.isSupported(language)) {
      throw new ParserError(
        'UNSUPPORTED_LANGUAGE',
        `Unsupported language: ${language}`,
        { language },
      );
    }

    const lang = preloaded ?? (await this.registry.load(language));
    const started = performance.now();
    try {
      this.runtime.setLanguage(lang);
      const tree = this.runtime.parse(source, oldTree ?? undefined);
      if (oldTree && oldTree !== tree) {
        oldTree.delete();
      }
      const durationMs = performance.now() - started;
      const errorNodes = collectErrorNodes(tree.rootNode);
      const nodeCount = countNodes(tree.rootNode);
      const result: ParseResult = {
        tree: new WrappedTree(tree, language, lang),
        language,
        didEdit,
        errorNodes,
        metrics: {
          durationMs,
          nodeCount,
          sourceBytes: utf8ByteLength(source),
        },
      };
      this.logger?.info?.('parse-completed', {
        module: 'tree-sitter-parser',
        language,
        durationMs: Math.round(durationMs * 1000) / 1000,
        sourceBytes: result.metrics.sourceBytes,
        errorCount: errorNodes.length,
        didEdit,
      });
      return result;
    } catch (err) {
      if (oldTree) {
        try {
          oldTree.delete();
        } catch {
          /* ignore */
        }
      }
      if (err instanceof ParserError) throw err;
      throw new ParserError(
        'PARSER_INTERNAL',
        err instanceof Error ? err.message : 'Parse failed',
        { cause: err instanceof Error ? err.message : String(err) },
      );
    }
  }
}

/** Create a Tree-sitter parser instance (async: loads WASM runtime). */
export async function createTreeSitterParser(
  options?: ParserOptions,
): Promise<TreeSitterParser> {
  return TreeSitterParserImpl.create(options ?? {});
}
