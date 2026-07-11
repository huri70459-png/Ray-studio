import { resolveSpecifier, dependsOnRelationships } from '../import-resolver.js';
import { collectCallRelationships } from '../call-analyzer.js';
import type {
  FileAnalysisContext,
  ImportBinding,
  LanguageResolver,
} from './base-resolver.js';
import type { Relationship } from '../relationship-model.js';

/**
 * TS/JS static import + call resolution (shared family).
 * Regex/static only — does not own Tree-sitter grammar registry.
 */
export class TypescriptResolver implements LanguageResolver {
  readonly family = 'typescript' as const;

  collectImports(ctx: FileAnalysisContext): ImportBinding[] {
    return collectJsTsImports(ctx.source, ctx.filePath, ctx.sourceByPath);
  }

  collectRelationships(
    ctx: FileAnalysisContext,
    imports: ImportBinding[],
  ): Relationship[] {
    const depends = dependsOnRelationships(ctx.filePath, imports);
    const calls = collectCallRelationships(
      ctx.filePath,
      ctx.source,
      ctx.symbols,
      imports,
      ctx.symbolsByPath,
    );
    return [...depends, ...calls];
  }
}

export class JavascriptResolver implements LanguageResolver {
  readonly family = 'javascript' as const;
  private readonly inner = new TypescriptResolver();

  collectImports(ctx: FileAnalysisContext): ImportBinding[] {
    return this.inner.collectImports(ctx);
  }

  collectRelationships(
    ctx: FileAnalysisContext,
    imports: ImportBinding[],
  ): Relationship[] {
    return this.inner.collectRelationships(ctx, imports);
  }
}

const IMPORT_FROM =
  /\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
const IMPORT_SIDE_EFFECT = /\bimport\s+['"]([^'"]+)['"]/g;
const REQUIRE_CALL = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_FROM =
  /\bexport\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

function collectJsTsImports(
  source: string,
  filePath: string,
  sourceByPath: Record<string, string>,
): ImportBinding[] {
  const out: ImportBinding[] = [];

  let m: RegExpExecArray | null;

  IMPORT_FROM.lastIndex = 0;
  while ((m = IMPORT_FROM.exec(source)) !== null) {
    const clause = m[1]!.trim();
    const specifier = m[2]!;
    const startIndex = m.index;
    const endIndex = m.index + m[0].length;
    const resolvedPath = resolveSpecifier(filePath, specifier, sourceByPath);
    out.push(...parseImportClause(clause, specifier, resolvedPath, startIndex, endIndex));
  }

  IMPORT_SIDE_EFFECT.lastIndex = 0;
  while ((m = IMPORT_SIDE_EFFECT.exec(source)) !== null) {
    // Skip if already matched as import-from (side-effect form has no from)
    const line = m[0];
    if (/\bfrom\b/.test(line)) continue;
    const specifier = m[1]!;
    const resolvedPath = resolveSpecifier(filePath, specifier, sourceByPath);
    out.push({
      localName: '',
      specifier,
      ...(resolvedPath !== undefined ? { resolvedPath } : {}),
      importedName: '*',
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  REQUIRE_CALL.lastIndex = 0;
  while ((m = REQUIRE_CALL.exec(source)) !== null) {
    const specifier = m[1]!;
    const resolvedPath = resolveSpecifier(filePath, specifier, sourceByPath);
    out.push({
      localName: '',
      specifier,
      ...(resolvedPath !== undefined ? { resolvedPath } : {}),
      importedName: 'default',
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  EXPORT_FROM.lastIndex = 0;
  while ((m = EXPORT_FROM.exec(source)) !== null) {
    const specifier = m[1]!;
    const resolvedPath = resolveSpecifier(filePath, specifier, sourceByPath);
    out.push({
      localName: '',
      specifier,
      ...(resolvedPath !== undefined ? { resolvedPath } : {}),
      importedName: '*',
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  return out;
}

function parseImportClause(
  clause: string,
  specifier: string,
  resolvedPath: string | undefined,
  startIndex: number,
  endIndex: number,
): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  const base = {
    specifier,
    ...(resolvedPath !== undefined ? { resolvedPath } : {}),
    startIndex,
    endIndex,
  };

  // default import: `Foo` or `Foo, { ... }`
  const defaultAndRest = clause.match(
    /^([A-Za-z_$][\w$]*)\s*(?:,\s*(.*))?$/s,
  );
  const onlyNamed = clause.match(/^\{([\s\S]*)\}$/);
  const namespace = clause.match(
    /^\*\s+as\s+([A-Za-z_$][\w$]*)$/,
  );
  const defaultAndNamespace = clause.match(
    /^([A-Za-z_$][\w$]*)\s*,\s*\*\s+as\s+([A-Za-z_$][\w$]*)$/,
  );

  if (namespace) {
    bindings.push({
      ...base,
      localName: namespace[1]!,
      importedName: '*',
    });
    return bindings;
  }

  if (defaultAndNamespace) {
    bindings.push({
      ...base,
      localName: defaultAndNamespace[1]!,
      importedName: 'default',
    });
    bindings.push({
      ...base,
      localName: defaultAndNamespace[2]!,
      importedName: '*',
    });
    return bindings;
  }

  if (onlyNamed) {
    bindings.push(...parseNamedImports(onlyNamed[1]!, base));
    return bindings;
  }

  if (defaultAndRest) {
    const defName = defaultAndRest[1]!;
    // If looks like `{ ... }` only handled above; bare identifier = default
    if (!defName.startsWith('{')) {
      bindings.push({
        ...base,
        localName: defName,
        importedName: 'default',
      });
    }
    const rest = defaultAndRest[2]?.trim();
    if (rest?.startsWith('{')) {
      const inner = rest.slice(1, rest.lastIndexOf('}'));
      bindings.push(...parseNamedImports(inner, base));
    } else if (rest?.startsWith('*')) {
      const ns = rest.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (ns) {
        bindings.push({
          ...base,
          localName: ns[1]!,
          importedName: '*',
        });
      }
    }
    return bindings;
  }

  // Fallback: named without braces oddities
  if (clause.includes('{')) {
    const inner = clause.slice(clause.indexOf('{') + 1, clause.lastIndexOf('}'));
    bindings.push(...parseNamedImports(inner, base));
  }

  return bindings;
}

function parseNamedImports(
  inner: string,
  base: {
    specifier: string;
    resolvedPath?: string;
    startIndex: number;
    endIndex: number;
  },
): ImportBinding[] {
  const out: ImportBinding[] = [];
  for (const part of inner.split(',')) {
    const bit = part.trim();
    if (!bit || bit.startsWith('type ')) {
      // type-only imports still create dependsOn via specifier; local not used for calls
      const typeNamed = bit.replace(/^type\s+/, '').trim();
      if (!typeNamed) continue;
      const asType = typeNamed.match(
        /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
      );
      if (asType) {
        out.push({
          ...base,
          localName: asType[2]!,
          importedName: asType[1]!,
        });
      } else {
        const name = typeNamed.match(/^([A-Za-z_$][\w$]*)/);
        if (name) {
          out.push({
            ...base,
            localName: name[1]!,
            importedName: name[1]!,
          });
        }
      }
      continue;
    }
    const asM = bit.match(
      /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
    );
    if (asM) {
      out.push({
        ...base,
        localName: asM[2]!,
        importedName: asM[1]!,
      });
      continue;
    }
    const name = bit.match(/^([A-Za-z_$][\w$]*)/);
    if (name) {
      out.push({
        ...base,
        localName: name[1]!,
        importedName: name[1]!,
      });
    }
  }
  return out;
}
