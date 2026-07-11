import {
  fileId,
  edgeKey,
  normalizePath,
  type Relationship,
} from './relationship-model.js';
import type { ImportBinding } from './resolvers/base-resolver.js';

const EXT_CANDIDATES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.py',
  '/__init__.py',
];

/** Posix-style dirname (fixture paths are `/`-normalized). */
function posixDirname(filePath: string): string {
  const p = normalizePath(filePath);
  const i = p.lastIndexOf('/');
  if (i <= 0) return '.';
  return p.slice(0, i);
}

/** Resolve `fromDir` + relative specifier without node:path (deterministic). */
function joinRelative(fromDir: string, specifier: string): string {
  const parts = (fromDir === '.' ? [] : fromDir.split('/')).filter(
    (x) => x.length > 0 && x !== '.',
  );
  for (const seg of specifier.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

/**
 * Resolve a module specifier against known sourceByPath keys.
 * Relative project files only for B.2; bare npm packages return undefined.
 */
export function resolveSpecifier(
  fromFile: string,
  specifier: string,
  sourceByPath: Record<string, string>,
): string | undefined {
  const paths = Object.keys(sourceByPath).map(normalizePath);
  const pathSet = new Set(paths);

  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const fromDir = posixDirname(fromFile);
    const joined = joinRelative(fromDir, specifier);
    for (const ext of EXT_CANDIDATES) {
      const candidate = normalizePath(joined + ext);
      if (pathSet.has(candidate)) return candidate;
      const hit = paths.find(
        (p) =>
          p === candidate ||
          p.endsWith('/' + candidate) ||
          p.endsWith(candidate),
      );
      if (hit) return hit;
    }
    return undefined;
  }

  // Python-style bare module: util → util.py among known paths
  if (!specifier.includes('/') && !specifier.includes('\\')) {
    const base = specifier.replace(/\./g, '/');
    const hit = paths.find((p) => {
      const leaf = p.split('/').pop() ?? p;
      return (
        p === base ||
        p === base + '.py' ||
        leaf === base + '.py' ||
        leaf === base + '.ts' ||
        leaf === base + '.js' ||
        p.endsWith('/' + base + '.py') ||
        p.endsWith('/' + base + '/__init__.py')
      );
    });
    if (hit) return hit;
  }

  return undefined;
}

export function dependsOnRelationships(
  fromFile: string,
  imports: ImportBinding[],
): Relationship[] {
  const from = fileId(fromFile);
  const out: Relationship[] = [];
  const seen = new Set<string>();

  for (const imp of imports) {
    if (!imp.resolvedPath) continue;
    const to = fileId(imp.resolvedPath);
    if (to === from) continue;
    const key = edgeKey('dependsOn', from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      type: 'dependsOn',
      from,
      to,
      metadata: {
        location: { startIndex: imp.startIndex, endIndex: imp.endIndex },
        via: imp.specifier,
        confidence: 1,
      },
    });
  }

  return out;
}
