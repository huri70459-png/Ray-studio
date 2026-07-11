import { resolveSpecifier, dependsOnRelationships } from '../import-resolver.js';
import { collectCallRelationships } from '../call-analyzer.js';
import type {
  FileAnalysisContext,
  ImportBinding,
  LanguageResolver,
} from './base-resolver.js';
import type { Relationship } from '../relationship-model.js';

const FROM_IMPORT =
  /^\s*from\s+([.\w]+)\s+import\s+(.+)$/gm;
const IMPORT_STMT = /^\s*import\s+([.\w]+)(?:\s+as\s+(\w+))?/gm;

export class PythonResolver implements LanguageResolver {
  readonly family = 'python' as const;

  collectImports(ctx: FileAnalysisContext): ImportBinding[] {
    return collectPythonImports(ctx.source, ctx.filePath, ctx.sourceByPath);
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

function collectPythonImports(
  source: string,
  filePath: string,
  sourceByPath: Record<string, string>,
): ImportBinding[] {
  const out: ImportBinding[] = [];
  let m: RegExpExecArray | null;

  FROM_IMPORT.lastIndex = 0;
  while ((m = FROM_IMPORT.exec(source)) !== null) {
    const mod = m[1]!;
    const names = m[2]!;
    const specifier = mod;
    const resolvedPath = resolveSpecifier(filePath, specifier, sourceByPath);
    const startIndex = m.index;
    const endIndex = m.index + m[0].length;

    for (const part of names.split(',')) {
      const bit = part.trim();
      if (!bit || bit === '(') continue;
      const asM = bit.match(/^(\w+)\s+as\s+(\w+)/);
      if (asM) {
        out.push({
          localName: asM[2]!,
          specifier,
          ...(resolvedPath !== undefined ? { resolvedPath } : {}),
          importedName: asM[1]!,
          startIndex,
          endIndex,
        });
      } else {
        const name = bit.match(/^(\w+)/);
        if (name) {
          out.push({
            localName: name[1]!,
            specifier,
            ...(resolvedPath !== undefined ? { resolvedPath } : {}),
            importedName: name[1]!,
            startIndex,
            endIndex,
          });
        }
      }
    }
  }

  IMPORT_STMT.lastIndex = 0;
  while ((m = IMPORT_STMT.exec(source)) !== null) {
    const mod = m[1]!;
    const alias = m[2];
    const resolvedPath = resolveSpecifier(filePath, mod, sourceByPath);
    out.push({
      localName: alias ?? mod.split('.').pop()!,
      specifier: mod,
      ...(resolvedPath !== undefined ? { resolvedPath } : {}),
      importedName: '*',
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  return out;
}
