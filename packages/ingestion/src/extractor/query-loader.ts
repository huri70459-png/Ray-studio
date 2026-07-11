import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = join(__dirname, 'queries');

/** Map canonical language id → query file basename (without .scm). */
const LANGUAGE_QUERY_FILE: Record<string, string> = {
  typescript: 'typescript',
  tsx: 'typescript',
  javascript: 'javascript',
  jsx: 'javascript',
  python: 'python',
};

const cache = new Map<string, string>();

export function isExtractorLanguageSupported(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_QUERY_FILE, language);
}

export function supportedExtractorLanguages(): string[] {
  return Object.keys(LANGUAGE_QUERY_FILE);
}

/**
 * Load Tree-sitter query source for a language.
 * @throws Error with code-like message if required file missing / unreadable
 */
export function loadQuerySource(language: string): string {
  const base = LANGUAGE_QUERY_FILE[language];
  if (!base) {
    throw new Error(`QUERY_UNSUPPORTED_LANGUAGE:${language}`);
  }
  const cached = cache.get(base);
  if (cached !== undefined) return cached;

  const path = join(QUERIES_DIR, `${base}.scm`);
  try {
    const text = readFileSync(path, 'utf8');
    cache.set(base, text);
    return text;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`QUERY_LOAD_FAILED:${base}: ${cause}`);
  }
}

/** Clear query cache (tests). */
export function clearQueryCache(): void {
  cache.clear();
}
