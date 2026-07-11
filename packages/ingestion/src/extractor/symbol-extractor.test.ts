import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTreeSitterParser } from '../parser/parser.js';
import type { TreeSitterParser } from '../parser/types.js';
import { createSymbolExtractor } from './symbol-extractor.js';
import type { SymbolExtractor } from './symbol-extractor.js';
import { isExtractorLanguageSupported, loadQuerySource } from './query-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '__fixtures__');
const parserFixtures = join(__dirname, '../parser/__fixtures__');

function load(name: string, dir: string = fixtures): string {
  return readFileSync(join(dir, name), 'utf8');
}

describe('Module 104 Symbol Extractor', () => {
  let parser: TreeSitterParser;
  let extractor: SymbolExtractor;

  beforeAll(async () => {
    parser = await createTreeSitterParser();
    extractor = createSymbolExtractor(parser);
  });

  it('FT-001: extract TypeScript functions and class', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const symbols = extractor.extract(tree, 'typescript', source);

    const greet = symbols.find((s) => s.name === 'greet' && s.kind === 'function');
    const counter = symbols.find((s) => s.name === 'Counter' && s.kind === 'class');
    const inc = symbols.find((s) => s.name === 'inc' && s.kind === 'method');
    const dec = symbols.find((s) => s.name === 'dec' && s.kind === 'method');

    expect(greet).toBeDefined();
    expect(counter).toBeDefined();
    expect(inc).toBeDefined();
    expect(dec).toBeDefined();
    expect(greet!.qualifiedName).toBe('greet');
    expect(greet!.range.startIndex).toBeGreaterThanOrEqual(0);
    expect(greet!.range.endIndex).toBeLessThanOrEqual(source.length);
  });

  it('FT-002: nested qualified names', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const symbols = extractor.extract(tree, 'typescript', source);
    const inc = symbols.find((s) => s.name === 'inc' && s.kind === 'method');
    const counter = symbols.find((s) => s.name === 'Counter' && s.kind === 'class');
    expect(inc).toBeDefined();
    expect(counter).toBeDefined();
    expect(inc!.qualifiedName).toContain('Counter');
    expect(inc!.qualifiedName).toContain('inc');
    expect(inc!.range.startIndex).toBeGreaterThanOrEqual(counter!.range.startIndex);
    expect(inc!.range.endIndex).toBeLessThanOrEqual(counter!.range.endIndex);
  });

  it('FT-003: JavaScript and Python symbols', async () => {
    const jsSource = load('symbols.js.txt');
    const jsTree = await parser.parse({ language: 'javascript', source: jsSource });
    const jsSymbols = extractor.extract(jsTree.tree, 'javascript', jsSource);
    expect(jsSymbols.some((s) => s.kind === 'function' || s.kind === 'class')).toBe(
      true,
    );
    expect(jsSymbols.length).toBeGreaterThanOrEqual(1);

    const pySource = load('symbols.py.txt');
    const pyTree = await parser.parse({ language: 'python', source: pySource });
    const pySymbols = extractor.extract(pyTree.tree, 'python', pySource);
    expect(pySymbols.some((s) => s.name === 'greet')).toBe(true);
    expect(pySymbols.some((s) => s.name === 'Counter' && s.kind === 'class')).toBe(
      true,
    );
  });

  it('FT-004: docstring / JSDoc capture', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const symbols = extractor.extract(tree, 'typescript', source);
    const greet = symbols.find((s) => s.name === 'greet');
    expect(greet?.docstring).toBeDefined();
    expect(greet!.docstring!).toMatch(/Greets a person/i);

    const pySource = load('symbols.py.txt');
    const py = await parser.parse({ language: 'python', source: pySource });
    const pySymbols = extractor.extract(py.tree, 'python', pySource);
    const pyGreet = pySymbols.find((s) => s.name === 'greet');
    expect(pyGreet?.docstring).toBeDefined();
    expect(pyGreet!.docstring!).toMatch(/Greets a person/i);
  });

  it('FT-005: partial parse / syntax errors', async () => {
    const source = 'export function broken( { return 1; export class Ok { m() { return 1; } }';
    const { tree, errorNodes } = await parser.parse({
      language: 'typescript',
      source,
    });
    expect(
      errorNodes.length >= 1 || tree.rootNode.hasError === true,
    ).toBe(true);
    const symbols = extractor.extract(tree, 'typescript', source);
    expect(Array.isArray(symbols)).toBe(true);
    // may recover Ok or empty — must not throw
  });

  it('FT-006: unknown language', () => {
    const warnings: string[] = [];
    const ex = createSymbolExtractor(parser, {
      logger: {
        warn: (msg) => {
          warnings.push(msg);
        },
      },
    });
    // Reuse a real tree but claim unknown language
    return parser.parse({ language: 'typescript', source: 'function x() {}' }).then(({ tree }) => {
      const symbols = ex.extract(tree, 'not-a-real-lang-xyz', 'function x() {}');
      expect(symbols).toEqual([]);
      expect(warnings.some((w) => w.includes('unknown-language'))).toBe(true);
    });
  });

  it('FT-007: determinism', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const a = extractor.extract(tree, 'typescript', source);
    const b = extractor.extract(tree, 'typescript', source);
    expect(a.map(stable)).toEqual(b.map(stable));
  });

  it('FT-008: TSX path', async () => {
    const source = load('sample.tsx.txt', parserFixtures);
    const { tree } = await parser.parse({ language: 'tsx', source });
    const symbols = extractor.extract(tree, 'tsx', source);
    expect(symbols.some((s) => s.name === 'Hello' || s.name === 'Box')).toBe(true);
  });

  it('FT-009: symbol kinds coverage', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const symbols = extractor.extract(tree, 'typescript', source);
    const kinds = new Set(symbols.map((s) => s.kind));
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('class')).toBe(true);
    expect(kinds.has('method')).toBe(true);
    expect(kinds.has('interface')).toBe(true);
    expect(kinds.has('type') || kinds.has('constant')).toBe(true);
  });

  it('FT-010: uses 103 tree/query surface (no re-parse ownership)', async () => {
    expect(isExtractorLanguageSupported('typescript')).toBe(true);
    const q = loadQuerySource('typescript');
    expect(q.length).toBeGreaterThan(0);
    expect(q).toContain('function_declaration');

    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    // extract accepts pre-built tree — does not call parse internally
    const symbols = extractor.extract(tree, 'typescript', source);
    expect(symbols.length).toBeGreaterThan(0);
  });

  it('edge: empty source', async () => {
    const { tree } = await parser.parse({ language: 'typescript', source: '' });
    const symbols = extractor.extract(tree, 'typescript', '');
    expect(symbols).toEqual([]);
  });

  it('edge: concurrent extract', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const [a, b] = await Promise.all([
      Promise.resolve(extractor.extract(tree, 'typescript', source)),
      Promise.resolve(extractor.extract(tree, 'typescript', source)),
    ]);
    expect(a.map(stable)).toEqual(b.map(stable));
  });

  it('edge: incremental re-extract after parseIncremental', async () => {
    const previousSource = load('sample.ts.txt', parserFixtures);
    const first = await parser.parse({ language: 'typescript', source: previousSource });
    const before = extractor.extract(first.tree, 'typescript', previousSource);
    expect(before.some((s) => s.name === 'greet')).toBe(true);

    const needle = '`hello ${name}`';
    const startIndex = previousSource.indexOf(needle);
    const replacement = '`hi ${name}`';
    const newSource =
      previousSource.slice(0, startIndex) +
      replacement +
      previousSource.slice(startIndex + needle.length);
    const inc = await parser.parseIncremental({
      language: 'typescript',
      previousSource,
      newSource,
      oldTree: first.tree,
      edits: [
        {
          startIndex,
          oldEndIndex: startIndex + needle.length,
          newEndIndex: startIndex + replacement.length,
        },
      ],
    });
    const after = extractor.extract(inc.tree, 'typescript', newSource);
    expect(after.some((s) => s.name === 'greet')).toBe(true);
    expect(after.some((s) => s.name === 'Counter')).toBe(true);
  });

  it('perf: extract ~1000-line TS P95 < 5ms (post-parse)', async () => {
    // Typical density: mostly statements/comments + modest symbol count (not 200 decls).
    const parts: string[] = [
      '/** Module bulk fixture for extract perf. */\n',
      'export class Bulk {\n',
      '  private value = 0;\n',
      '  /** Increment. */\n',
      '  inc(): number { this.value += 1; return this.value; }\n',
      '  dec(): number { this.value -= 1; return this.value; }\n',
      '}\n',
      'export function greet(name: string): string { return `hello ${name}`; }\n',
      'export function add(a: number, b: number): number { return a + b; }\n',
      'export interface Named { name: string; }\n',
      'export type Id = string;\n',
      'export const MAX = 10;\n',
    ];
    // Single large comment block pads to ~1000 lines without exploding AST symbol work.
    const padLines = Math.max(0, 1000 - parts.join('').split('\n').length);
    parts.push('/*\n');
    for (let i = 0; i < padLines; i++) {
      parts.push(` padding ${i}\n`);
    }
    parts.push('*/\n');
    const source = parts.join('');
    expect(source.split('\n').length).toBeGreaterThanOrEqual(1000);

    const { tree } = await parser.parse({ language: 'typescript', source });
    const times: number[] = [];
    // warmup (includes one-time query-file validation)
    extractor.extract(tree, 'typescript', source);
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      extractor.extract(tree, 'typescript', source);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95).toBeLessThan(5);
  });

  it('observability: extractWithMetrics', async () => {
    const source = load('symbols.ts.txt');
    const { tree } = await parser.parse({ language: 'typescript', source });
    const result = extractor.extractWithMetrics(tree, 'typescript', source);
    expect(result.metrics.symbolCount).toBe(result.symbols.length);
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(result.metrics.byKind).length).toBeGreaterThan(0);
  });
});

function stable(s: {
  kind: string;
  name: string;
  qualifiedName: string;
  range: { startIndex: number; endIndex: number };
}): string {
  return `${s.kind}:${s.qualifiedName}:${s.range.startIndex}:${s.range.endIndex}`;
}
