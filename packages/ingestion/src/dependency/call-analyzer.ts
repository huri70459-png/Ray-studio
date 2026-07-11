import type { Symbol } from '../extractor/symbol-model.js';
import {
  edgeKey,
  type Relationship,
} from './relationship-model.js';
import type { ImportBinding } from './resolvers/base-resolver.js';

/**
 * Static call-site analysis (B.2): find `name(` patterns in function/method
 * bodies and resolve against same-file symbols and import bindings.
 * No code execution; no type inference.
 */
export function collectCallRelationships(
  filePath: string,
  source: string,
  symbols: Symbol[],
  imports: ImportBinding[],
  symbolsByPath: Record<string, Symbol[]>,
): Relationship[] {
  const callables = symbols.filter(
    (s) =>
      s.kind === 'function' ||
      s.kind === 'method' ||
      s.kind === 'class',
  );

  // Name → preferred target id (same-file first)
  const localByName = new Map<string, Symbol>();
  for (const s of symbols) {
    if (
      s.kind === 'function' ||
      s.kind === 'method' ||
      s.kind === 'class' ||
      s.kind === 'variable' ||
      s.kind === 'constant'
    ) {
      if (!localByName.has(s.name)) localByName.set(s.name, s);
    }
  }

  // Import local name → remote symbol id when resolvable
  const importTarget = new Map<string, string>();
  for (const imp of imports) {
    if (!imp.resolvedPath) continue;
    const remote = symbolsByPath[imp.resolvedPath] ?? [];
    const imported = imp.importedName ?? imp.localName;
    if (imported === '*' || imported === 'default') {
      // Namespace / default: bind localName to file-level fallback only when a same-named export exists
      const hit =
        remote.find((s) => s.name === imp.localName) ??
        remote.find((s) => s.kind === 'function' || s.kind === 'class');
      if (hit) importTarget.set(imp.localName, hit.id);
      continue;
    }
    const hit = remote.find(
      (s) => s.name === imported || s.qualifiedName === imported,
    );
    if (hit) {
      importTarget.set(imp.localName, hit.id);
    }
  }

  const out: Relationship[] = [];
  const seen = new Set<string>();

  // Call patterns: identifier(  — skip keywords
  const callRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  const keywords = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'function',
    'class',
    'return',
    'typeof',
    'new',
    'await',
    'void',
    'super',
    'import',
    'export',
    'from',
    'async',
    'def',
    'elif',
    'lambda',
    'print', // common builtin — still allow resolution if local exists
  ]);

  for (const caller of callables) {
    if (caller.kind === 'class') continue; // only walk callable bodies
    const bodyStart = caller.range.startIndex;
    const bodyEnd = caller.range.endIndex;
    if (bodyEnd <= bodyStart || bodyStart >= source.length) continue;
    const body = source.slice(bodyStart, Math.min(bodyEnd, source.length));

    callRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(body)) !== null) {
      const name = m[1]!;
      if (keywords.has(name) && name !== 'print') continue;
      if (name === caller.name) continue; // recursive self — still valid edge; allow

      let toId: string | undefined;
      const local = localByName.get(name);
      if (local && local.id !== caller.id) {
        toId = local.id;
      } else if (importTarget.has(name)) {
        toId = importTarget.get(name);
      }

      if (!toId) continue;

      const absStart = bodyStart + m.index;
      const absEnd = absStart + m[0].length;
      const key = edgeKey('calls', caller.id, toId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        type: 'calls',
        from: caller.id,
        to: toId,
        metadata: {
          location: { startIndex: absStart, endIndex: absEnd },
          confidence: 0.8,
        },
      });
    }
  }

  // Silence unused filePath (kept for future location metadata enrichment)
  void filePath;
  return out;
}
