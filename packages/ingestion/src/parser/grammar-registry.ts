import { createRequire } from 'node:module';
import * as path from 'node:path';
import type ParserType from 'web-tree-sitter';
import { ParserError } from './errors.js';
import type { ParserLogger } from './types.js';

const require = createRequire(import.meta.url);
const Parser = require('web-tree-sitter') as typeof ParserType;

type Language = ParserType.Language;

/**
 * Canonical language id → wasm basename under tree-sitter-wasms/out.
 * Multiple ids may share one grammar (e.g. jsx → javascript).
 */
const LANGUAGE_WASM: Readonly<Record<string, string>> = {
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  jsx: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
};

/** Languages required for B.2 merge gate */
export const REQUIRED_LANGUAGES: readonly string[] = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
];

export function defaultGrammarsDir(): string {
  const pkgJson = require.resolve('tree-sitter-wasms/package.json');
  return path.join(path.dirname(pkgJson), 'out');
}

export function defaultWebTreeSitterWasmDir(): string {
  const entry = require.resolve('web-tree-sitter');
  return path.dirname(entry);
}

export class GrammarRegistry {
  private readonly cache = new Map<string, Language>();
  private readonly grammarsDir: string;
  private readonly logger?: ParserLogger;

  constructor(grammarsDir: string, logger?: ParserLogger) {
    this.grammarsDir = grammarsDir;
    if (logger !== undefined) {
      this.logger = logger;
    }
  }

  supportedLanguageIds(): string[] {
    return Object.keys(LANGUAGE_WASM);
  }

  isSupported(language: string): boolean {
    return language in LANGUAGE_WASM;
  }

  async load(language: string): Promise<Language> {
    const cached = this.cache.get(language);
    if (cached) return cached;

    const wasmName = LANGUAGE_WASM[language];
    if (!wasmName) {
      throw new ParserError(
        'UNSUPPORTED_LANGUAGE',
        `Unsupported language: ${language}`,
        { language },
      );
    }

    for (const [id, name] of Object.entries(LANGUAGE_WASM)) {
      if (name === wasmName && this.cache.has(id)) {
        const shared = this.cache.get(id)!;
        this.cache.set(language, shared);
        return shared;
      }
    }

    const wasmPath = path.join(this.grammarsDir, wasmName);
    const started = performance.now();
    try {
      const lang = await Parser.Language.load(wasmPath);
      this.cache.set(language, lang);
      this.logger?.info?.('grammar-loaded', {
        module: 'tree-sitter-parser',
        language,
        loadMs: Math.round(performance.now() - started),
        wasm: wasmName,
      });
      return lang;
    } catch (err) {
      throw new ParserError(
        'GRAMMAR_LOAD_FAILED',
        `Failed to load grammar for language: ${language}`,
        {
          language,
          wasmPath,
          cause: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }
}
