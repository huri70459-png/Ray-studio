/**
 * Extension → language id. Language-agnostic detection by file path only.
 * Content heuristics are intentionally minimal for B.2.
 */

const EXTENSION_MAP: Readonly<Record<string, string>> = {
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.pyw': 'python',
};

export function detectLanguageFromPath(filePath: string): string | null {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');
  const base = lower.includes('/') ? lower.slice(lower.lastIndexOf('/') + 1) : lower;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = base.slice(dot);
  return EXTENSION_MAP[ext] ?? null;
}
