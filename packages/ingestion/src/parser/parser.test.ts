import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTreeSitterParser } from './parser.js';
import { ParserError } from './errors.js';
import { detectLanguageFromPath } from './language-detect.js';
import type { TreeSitterParser } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

describe('Module 103 Tree-sitter Parser', () => {
  let parser: TreeSitterParser;

  beforeAll(async () => {
    parser = await createTreeSitterParser();
  });

  it('FT-001: full parse TypeScript', async () => {
    const source = loadFixture('sample.ts.txt');
    const result = await parser.parse({ language: 'typescript', source });
    expect(result.language).toBe('typescript');
    expect(result.tree.rootNode).toBeDefined();
    expect(result.tree.rootNode.type).toBeTruthy();
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.sourceBytes).toBe(Buffer.byteLength(source, 'utf8'));
    expect(result.didEdit).toBe(false);
  });

  it('FT-002: full parse JavaScript and Python', async () => {
    const js = await parser.parse({
      language: 'javascript',
      source: loadFixture('sample.js.txt'),
    });
    expect(js.tree.rootNode).toBeDefined();
    expect(js.language).toBe('javascript');

    const py = await parser.parse({
      language: 'python',
      source: loadFixture('sample.py.txt'),
    });
    expect(py.tree.rootNode).toBeDefined();
    expect(py.language).toBe('python');
  });

  it('FT-003: language detection from filePath', async () => {
    const source = loadFixture('sample.ts.txt');
    const result = await parser.parse({ source, filePath: 'src/foo.ts' });
    expect(result.language).toBe('typescript');
    expect(result.tree.rootNode).toBeDefined();
  });

  it('FT-004: incremental re-parse', async () => {
    const previousSource = loadFixture('sample.ts.txt');
    const first = await parser.parse({ language: 'typescript', source: previousSource });
    // Edit body of greet: change "hello" string
    const needle = '`hello ${name}`';
    const startIndex = previousSource.indexOf(needle);
    expect(startIndex).toBeGreaterThanOrEqual(0);
    const replacement = '`hi ${name}`';
    const newSource =
      previousSource.slice(0, startIndex) +
      replacement +
      previousSource.slice(startIndex + needle.length);
    const result = await parser.parseIncremental({
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
    expect(result.tree.rootNode).toBeDefined();
    expect(result.didEdit).toBe(true);
    // Tree remains queryable
    const matches = parser.query(
      result.tree,
      '(function_declaration name: (identifier) @name)',
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('FT-005: syntax error partial tree', async () => {
    const source = 'export function broken( { return 1;';
    const result = await parser.parse({ language: 'typescript', source });
    expect(result.tree.rootNode).toBeDefined();
    const hasErrors =
      result.errorNodes.length >= 1 || result.tree.rootNode.hasError === true;
    expect(hasErrors).toBe(true);
  });

  it('FT-006: unsupported language', async () => {
    await expect(
      parser.parse({ language: 'not-a-real-lang-xyz', source: 'x' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_LANGUAGE' });
    try {
      await parser.parse({ language: 'not-a-real-lang-xyz', source: 'x' });
    } catch (e) {
      expect(e).toBeInstanceOf(ParserError);
      expect((e as ParserError).code).toBe('UNSUPPORTED_LANGUAGE');
    }
  });

  it('FT-007: query captures', async () => {
    const source = loadFixture('sample.ts.txt');
    const result = await parser.parse({ language: 'typescript', source });
    const matches = parser.query(
      result.tree,
      '(function_declaration name: (identifier) @name)',
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const cap = matches[0]?.captures[0];
    expect(cap).toBeDefined();
    expect(cap!.node.startIndex).toBeGreaterThanOrEqual(0);
    expect(cap!.node.endIndex).toBeLessThanOrEqual(source.length);
    expect(cap!.node.endIndex).toBeGreaterThan(cap!.node.startIndex);
  });

  it('FT-008: getNodeAtPosition', async () => {
    const source = loadFixture('sample.ts.txt');
    const result = await parser.parse({ language: 'typescript', source });
    const offset = source.indexOf('greet');
    expect(offset).toBeGreaterThanOrEqual(0);
    const node = parser.getNodeAtPosition(result.tree, offset);
    expect(node).not.toBeNull();
    expect(node!.startIndex).toBeLessThanOrEqual(offset);
    expect(node!.endIndex).toBeGreaterThan(offset);
  });

  it('FT-009: determinism', async () => {
    const source = loadFixture('sample.ts.txt');
    const a = await parser.parse({ language: 'typescript', source });
    const b = await parser.parse({ language: 'typescript', source });
    expect(a.tree.rootNode.type).toBe(b.tree.rootNode.type);
    expect(a.tree.rootNode.startIndex).toBe(b.tree.rootNode.startIndex);
    expect(a.tree.rootNode.endIndex).toBe(b.tree.rootNode.endIndex);
    expect(a.metrics.nodeCount).toBe(b.metrics.nodeCount);
  });

  it('FT-010: TSX / JSX path', async () => {
    const tsx = await parser.parse({
      language: 'tsx',
      source: loadFixture('sample.tsx.txt'),
    });
    expect(tsx.tree.rootNode).toBeDefined();

    const jsx = await parser.parse({
      language: 'jsx',
      source: 'export const A = () => <span>x</span>;',
    });
    expect(jsx.tree.rootNode).toBeDefined();
    expect(jsx.language).toBe('jsx');
  });

  it('edge: empty source succeeds with tree', async () => {
    const result = await parser.parse({ language: 'typescript', source: '' });
    expect(result.tree.rootNode).toBeDefined();
  });

  it('edge: invalid query', async () => {
    const result = await parser.parse({
      language: 'typescript',
      source: 'const x = 1;',
    });
    expect(() => parser.query(result.tree, '(not_a_valid_node_type_zzz)')).toThrow(
      ParserError,
    );
  });

  it('edge: concurrent parses', async () => {
    const source = loadFixture('sample.ts.txt');
    const [a, b] = await Promise.all([
      parser.parse({ language: 'typescript', source }),
      parser.parse({ language: 'python', source: loadFixture('sample.py.txt') }),
    ]);
    expect(a.language).toBe('typescript');
    expect(b.language).toBe('python');
  });

  it('edge: detectLanguageFromPath', () => {
    expect(detectLanguageFromPath('a/b.ts')).toBe('typescript');
    expect(detectLanguageFromPath('a/b.tsx')).toBe('tsx');
    expect(detectLanguageFromPath('a/b.jsx')).toBe('jsx');
    expect(detectLanguageFromPath('a/b.py')).toBe('python');
    expect(detectLanguageFromPath('a/b.unknown')).toBeNull();
  });

  it('supportedLanguages includes required set', () => {
    const langs = parser.supportedLanguages();
    for (const id of ['typescript', 'tsx', 'javascript', 'jsx', 'python']) {
      expect(langs).toContain(id);
    }
  });

  it('perf: full parse <500 line TS P95 < 10ms (n≥30)', async () => {
    const source = loadFixture('sample.ts.txt');
    // Warm grammar
    await parser.parse({ language: 'typescript', source });
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await parser.parse({ language: 'typescript', source });
      times.push(r.metrics.durationMs);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    // Soft environment awareness: CI/dev machines vary; still assert sane bound
    expect(p95).toBeLessThan(10);
  });
});
