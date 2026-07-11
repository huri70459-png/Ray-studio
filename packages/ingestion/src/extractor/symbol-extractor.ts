import type { SyntaxNode, SyntaxTree, TreeSitterParser } from '../parser/types.js';
import { extractLeadingJsDoc, extractPythonDocstring } from './doc-comments.js';
import {
  isExtractorLanguageSupported,
  loadQuerySource,
  supportedExtractorLanguages,
} from './query-loader.js';
import type {
  ExtractMetrics,
  ExtractorLogger,
  ExtractResult,
  SourceRange,
  Symbol,
  SymbolKind,
} from './symbol-model.js';

export interface SymbolExtractorOptions {
  logger?: ExtractorLogger;
}

export interface SymbolExtractor {
  /**
   * Extract symbols from a 103 SyntaxTree.
   * Unknown languages → empty list + warn (Layer 2 §15).
   */
  extract(tree: SyntaxTree, language: string, source: string): Symbol[];
  /** Same as extract with metrics (observability / tests). */
  extractWithMetrics(
    tree: SyntaxTree,
    language: string,
    source: string,
  ): ExtractResult;
  supportedLanguages(): string[];
}

interface RawSymbol {
  kind: SymbolKind;
  name: string;
  range: SourceRange;
  defStart: number;
  defEnd: number;
  nameEnd: number;
}

const TS_FAMILY = new Set(['typescript', 'tsx']);
const JS_FAMILY = new Set(['javascript', 'jsx']);

class SymbolExtractorImpl implements SymbolExtractor {
  private readonly parser: TreeSitterParser;
  private readonly logger?: ExtractorLogger;
  private queriesReady = false;

  constructor(parser: TreeSitterParser, options: SymbolExtractorOptions = {}) {
    this.parser = parser;
    if (options.logger !== undefined) {
      this.logger = options.logger;
    }
  }

  supportedLanguages(): string[] {
    return supportedExtractorLanguages();
  }

  /** Load .scm query files once (Layer 2 assets; fail fast if missing). */
  private ensureQueriesPresent(): void {
    if (this.queriesReady) return;
    for (const lang of ['typescript', 'javascript', 'python'] as const) {
      loadQuerySource(lang);
    }
    this.queriesReady = true;
    // parser retained for optional query smoke / future query-mode
    void this.parser;
  }

  extract(tree: SyntaxTree, language: string, source: string): Symbol[] {
    return this.extractWithMetrics(tree, language, source).symbols;
  }

  extractWithMetrics(
    tree: SyntaxTree,
    language: string,
    source: string,
  ): ExtractResult {
    const started = performance.now();

    if (typeof source !== 'string') {
      return emptyResult(performance.now() - started);
    }

    if (!isExtractorLanguageSupported(language)) {
      this.logger?.warn?.('extractor-unknown-language', {
        module: 'symbol-extractor',
        language,
      });
      return emptyResult(performance.now() - started);
    }

    try {
      this.ensureQueriesPresent();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('QUERY_LOAD_FAILED')) {
        throw Object.assign(new Error(message), { code: 'QUERY_LOAD_FAILED' });
      }
      throw err;
    }

    const raw = collectRawSymbols(tree.rootNode, language, source);
    const symbols = buildSymbols(raw, source, language);
    const durationMs = performance.now() - started;
    const byKind: ExtractMetrics['byKind'] = {};
    for (const s of symbols) {
      byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    }

    this.logger?.info?.('extractor:symbols-extracted', {
      module: 'symbol-extractor',
      language,
      count: symbols.length,
      durationMs: Math.round(durationMs * 1000) / 1000,
      byKind,
    });

    return {
      symbols,
      metrics: {
        durationMs,
        symbolCount: symbols.length,
        byKind,
      },
    };
  }
}

function emptyResult(durationMs: number): ExtractResult {
  return {
    symbols: [],
    metrics: { durationMs, symbolCount: 0, byKind: {} },
  };
}

function toRange(node: SyntaxNode): SourceRange {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: {
      row: node.startPosition.row,
      column: node.startPosition.column,
    },
    endPosition: {
      row: node.endPosition.row,
      column: node.endPosition.column,
    },
  };
}

function nodeText(source: string, node: SyntaxNode): string {
  if (node.startIndex < 0 || node.endIndex > source.length) return '';
  if (node.endIndex < node.startIndex) return '';
  return source.slice(node.startIndex, node.endIndex);
}

function firstNamedOfType(node: SyntaxNode, types: string[]): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.namedChild(i) ?? node.child(i);
    if (!c) continue;
    if (types.includes(c.type)) return c;
  }
  // shallow scan all children (namedChild may skip some)
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c && types.includes(c.type)) return c;
  }
  return null;
}

function pushRaw(
  out: RawSymbol[],
  kind: SymbolKind,
  nameNode: SyntaxNode,
  defNode: SyntaxNode,
  source: string,
): void {
  if (defNode.isError === true) return;
  if (
    defNode.startIndex < 0 ||
    defNode.endIndex > source.length ||
    defNode.endIndex < defNode.startIndex
  ) {
    return;
  }
  const name = nodeText(source, nameNode);
  if (!name) return;
  out.push({
    kind,
    name,
    range: toRange(defNode),
    defStart: defNode.startIndex,
    defEnd: defNode.endIndex,
    nameEnd: nameNode.endIndex,
  });
}

/**
 * Primary extraction: walk 103 SyntaxNode tree (no per-call query recompile).
 * Language query .scm files remain the documented pattern source and are validated once.
 */
function collectRawSymbols(
  root: SyntaxNode,
  language: string,
  source: string,
): RawSymbol[] {
  const out: RawSymbol[] = [];
  const stack: SyntaxNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    let descend = true;

    if (node.isError !== true) {
      if (TS_FAMILY.has(language) || JS_FAMILY.has(language)) {
        descend = visitJsTs(node, language, source, out);
      } else if (language === 'python') {
        descend = visitPython(node, source, out);
      }
    }

    if (!descend) continue;

    for (let i = node.childCount - 1; i >= 0; i--) {
      const c = node.child(i);
      if (c) stack.push(c);
    }
  }

  return out;
}

/** @returns whether to descend into children */
function visitJsTs(
  node: SyntaxNode,
  language: string,
  source: string,
  out: RawSymbol[],
): boolean {
  switch (node.type) {
    case 'function_declaration':
    case 'generator_function_declaration': {
      const name = firstNamedOfType(node, ['identifier']);
      if (name) pushRaw(out, 'function', name, node, source);
      // Descend for nested functions/classes
      return true;
    }
    case 'function_expression':
    case 'generator_function': {
      const name = firstNamedOfType(node, ['identifier']);
      if (name) pushRaw(out, 'function', name, node, source);
      return true;
    }
    case 'class_declaration':
    case 'abstract_class_declaration': {
      const name = firstNamedOfType(node, ['type_identifier', 'identifier']);
      if (name) pushRaw(out, 'class', name, node, source);
      return true;
    }
    case 'method_definition': {
      const name = firstNamedOfType(node, [
        'property_identifier',
        'private_property_identifier',
        'identifier',
      ]);
      if (name) pushRaw(out, 'method', name, node, source);
      // Method body rarely holds nested class/function symbols we need for B.2 — skip deep walk
      return false;
    }
    case 'interface_declaration': {
      if (TS_FAMILY.has(language)) {
        const name = firstNamedOfType(node, ['type_identifier']);
        if (name) pushRaw(out, 'interface', name, node, source);
      }
      return false;
    }
    case 'type_alias_declaration': {
      if (TS_FAMILY.has(language)) {
        const name = firstNamedOfType(node, ['type_identifier']);
        if (name) pushRaw(out, 'type', name, node, source);
      }
      return false;
    }
    case 'enum_declaration': {
      if (TS_FAMILY.has(language)) {
        const name = firstNamedOfType(node, ['identifier']);
        if (name) pushRaw(out, 'type', name, node, source);
      }
      return false;
    }
    case 'lexical_declaration':
    case 'variable_declaration': {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (!c || c.type !== 'variable_declarator') continue;
        const name = firstNamedOfType(c, ['identifier']);
        if (!name) continue;
        let kind: SymbolKind = 'variable';
        const declHead = source.slice(
          Math.max(0, node.startIndex - 6),
          node.startIndex + 8,
        );
        if (/\bconst\b/.test(declHead)) {
          kind = 'constant';
        }
        pushRaw(out, kind, name, c, source);
      }
      return false;
    }
    // High-churn leaves: no symbol structure
    case 'string':
    case 'template_string':
    case 'number':
    case 'comment':
    case 'identifier':
    case 'type_identifier':
    case 'property_identifier':
      return false;
    default:
      return true;
  }
}

/** @returns whether to descend into children */
function visitPython(node: SyntaxNode, source: string, out: RawSymbol[]): boolean {
  if (node.type === 'function_definition') {
    const name = firstNamedOfType(node, ['identifier']);
    if (name) pushRaw(out, 'function', name, node, source);
    return true; // nested functions
  }
  if (node.type === 'class_definition') {
    const name = firstNamedOfType(node, ['identifier']);
    if (name) pushRaw(out, 'class', name, node, source);
    return true;
  }
  if (
    node.type === 'string' ||
    node.type === 'comment' ||
    node.type === 'identifier' ||
    node.type === 'integer'
  ) {
    return false;
  }
  return true;
}

function detectModifiers(source: string, defStart: number): string[] | undefined {
  const windowStart = Math.max(0, defStart - 100);
  const prefix = source.slice(windowStart, defStart);
  const mods: string[] = [];
  if (/\bexport\b/.test(prefix)) mods.push('export');
  if (/\bdefault\b/.test(prefix)) mods.push('default');
  if (/\basync\b/.test(prefix)) mods.push('async');
  if (/\bstatic\b/.test(prefix)) mods.push('static');
  if (/\babstract\b/.test(prefix)) mods.push('abstract');
  if (/\bprivate\b/.test(prefix)) mods.push('private');
  if (/\bprotected\b/.test(prefix)) mods.push('protected');
  if (/\bpublic\b/.test(prefix)) mods.push('public');
  if (/\breadonly\b/.test(prefix)) mods.push('readonly');
  return mods.length > 0 ? mods : undefined;
}

function extractSignature(source: string, raw: RawSymbol): string | undefined {
  const start = raw.defStart;
  const brace = source.indexOf('{', raw.nameEnd);
  const arrow = source.indexOf('=>', raw.nameEnd);
  let end = raw.defEnd;
  const candidates = [brace, arrow].filter((i) => i >= raw.nameEnd);
  if (candidates.length > 0) {
    end = Math.min(...candidates);
  } else {
    const nl = source.indexOf('\n', raw.nameEnd);
    if (nl >= 0 && nl < raw.defEnd) end = nl;
    else end = Math.min(raw.defEnd, raw.nameEnd + 120);
  }
  if (end <= start) return undefined;
  const sig = source.slice(start, end).replace(/\s+/g, ' ').trim();
  return sig.length > 0 ? sig : undefined;
}

function extractDoc(
  language: string,
  source: string,
  raw: RawSymbol,
): string | undefined {
  if (language === 'python') {
    return extractPythonDocstring(source, raw.defStart, raw.defEnd);
  }
  // JSDoc may sit above export/async/default keywords — scan from defStart
  return extractLeadingJsDoc(source, raw.defStart);
}

function buildSymbols(
  raw: RawSymbol[],
  source: string,
  language: string,
): Symbol[] {
  type Interim = RawSymbol & {
    signature?: string;
    docstring?: string;
    modifiers?: string[];
  };

  const interim: Interim[] = raw.map((r) => {
    const item: Interim = { ...r };
    const sig = extractSignature(source, r);
    if (sig !== undefined) item.signature = sig;
    const doc = extractDoc(language, source, r);
    if (doc !== undefined && doc.length > 0) item.docstring = doc;
    const mods = detectModifiers(source, r.defStart);
    if (mods !== undefined) item.modifiers = mods;
    return item;
  });

  interim.sort((a, b) => {
    if (a.range.startIndex !== b.range.startIndex) {
      return a.range.startIndex - b.range.startIndex;
    }
    return a.range.endIndex - b.range.endIndex;
  });

  // Nested functions inside class → method
  for (const item of interim) {
    if (item.kind !== 'function') continue;
    if (findEnclosing(interim, item, 'class')) item.kind = 'method';
  }

  const symbols: Symbol[] = [];
  for (const item of interim) {
    const parentClass =
      item.kind === 'method' ? findEnclosing(interim, item, 'class') : undefined;

    let qualifiedName = item.name;
    if (item.kind === 'method' && parentClass) {
      const outer = findEnclosing(interim, parentClass, 'class');
      qualifiedName = outer
        ? `${outer.name}.${parentClass.name}.${item.name}`
        : `${parentClass.name}.${item.name}`;
    }

    const id = `${language}:${qualifiedName}:${item.range.startIndex}`;
    const sym: Symbol = {
      id,
      kind: item.kind,
      name: item.name,
      qualifiedName,
      range: item.range,
    };
    if (item.signature !== undefined) sym.signature = item.signature;
    if (item.docstring !== undefined) sym.docstring = item.docstring;
    if (item.modifiers !== undefined) sym.modifiers = item.modifiers;
    symbols.push(sym);
  }

  return symbols;
}

function findEnclosing(
  all: Array<{ kind: SymbolKind; name: string; range: SourceRange }>,
  item: { range: SourceRange },
  kind: SymbolKind,
): { kind: SymbolKind; name: string; range: SourceRange } | undefined {
  let best: { kind: SymbolKind; name: string; range: SourceRange } | undefined;
  for (const cand of all) {
    if (cand.kind !== kind) continue;
    if (cand.range.startIndex > item.range.startIndex) continue;
    if (cand.range.endIndex < item.range.endIndex) continue;
    if (
      cand.range.startIndex === item.range.startIndex &&
      cand.range.endIndex === item.range.endIndex
    ) {
      continue;
    }
    if (!best || cand.range.startIndex >= best.range.startIndex) {
      best = cand;
    }
  }
  return best;
}

/**
 * Create a Symbol Extractor bound to a 103 TreeSitterParser (query validation).
 * Does not own grammar registry or parse lifecycle.
 */
export function createSymbolExtractor(
  parser: TreeSitterParser,
  options?: SymbolExtractorOptions,
): SymbolExtractor {
  return new SymbolExtractorImpl(parser, options ?? {});
}
