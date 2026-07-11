import type { Symbol } from '../../extractor/symbol-model.js';
import type { Relationship } from '../relationship-model.js';

export type LanguageFamily = 'typescript' | 'javascript' | 'python' | 'unknown';

export function languageFamily(language: string): LanguageFamily {
  switch (language) {
    case 'typescript':
    case 'tsx':
      return 'typescript';
    case 'javascript':
    case 'jsx':
      return 'javascript';
    case 'python':
      return 'python';
    default:
      return 'unknown';
  }
}

export function detectLanguageFromPath(filePath: string): string {
  const lower = filePath.replace(/\\/g, '/').toLowerCase();
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx')) return 'jsx';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return 'javascript';
  }
  if (lower.endsWith('.py')) return 'python';
  return 'unknown';
}

export interface ImportBinding {
  /** Local name used in this file (default import, named, or namespace) */
  localName: string;
  /** Specifier as written (e.g. './util', 'fs') */
  specifier: string;
  /** Resolved file path when known */
  resolvedPath?: string;
  /** Imported export name (`default`, `*`, or named) */
  importedName?: string;
  startIndex: number;
  endIndex: number;
}

export interface FileAnalysisContext {
  filePath: string;
  source: string;
  language: string;
  symbols: Symbol[];
  /** All known project sources (for resolution) */
  sourceByPath: Record<string, string>;
  /** All symbols by path (for cross-file call targets) */
  symbolsByPath: Record<string, Symbol[]>;
}

export interface LanguageResolver {
  readonly family: LanguageFamily;
  collectImports(ctx: FileAnalysisContext): ImportBinding[];
  collectRelationships(
    ctx: FileAnalysisContext,
    imports: ImportBinding[],
  ): Relationship[];
}
