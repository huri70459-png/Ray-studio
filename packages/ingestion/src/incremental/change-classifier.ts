/**
 * Change classifier — B.2 pure path/event classification (no FS/git I/O required).
 */

import type { ChangeKind, ClassifiedChange } from './types.js';
import { normalizePath } from '../dependency/relationship-model.js';
import { detectLanguageFromPath } from '../parser/language-detect.js';

export interface ClassifyInput {
  path: string;
  /** Empty/missing with delete flag → delete */
  source?: string;
  delete?: boolean;
  /** Prior indexed path exists in registry */
  previouslyIndexed?: boolean;
  /** Optional rename target */
  renameTo?: string;
}

/**
 * Classify a reindex request into a change kind.
 * Unsupported extensions → skip (batch continues).
 */
export function classifyChange(input: ClassifyInput): ClassifiedChange {
  const path = normalizePath(input.path);

  if (input.renameTo) {
    return {
      kind: 'rename',
      path,
      fromPath: path,
      toPath: normalizePath(input.renameTo),
    };
  }

  if (input.delete === true) {
    return { kind: 'delete', path };
  }

  const lang = detectLanguageFromPath(path);
  if (lang === null && input.source !== undefined) {
    // unknown extension — still allow if language forced later; mark unsupported for path-only
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '';
    if (ext && !isKnownSourceExt(ext)) {
      return {
        kind: 'unsupported',
        path,
        reason: `unsupported extension: ${ext}`,
      };
    }
  }

  if (input.source === undefined || input.source === null) {
    return {
      kind: 'skip',
      path,
      reason: 'missing source',
    };
  }

  // Empty source is valid (empty file) — still update, not skip
  if (input.previouslyIndexed) {
    return { kind: 'update', path };
  }
  return { kind: 'create', path };
}

function isKnownSourceExt(ext: string): boolean {
  const e = ext.toLowerCase();
  return (
    e === '.ts' ||
    e === '.tsx' ||
    e === '.js' ||
    e === '.jsx' ||
    e === '.mjs' ||
    e === '.cjs' ||
    e === '.py'
  );
}

/** Pure classify latency helper for tests / perf FT */
export function classifyOnly(kind: ChangeKind, path: string): ClassifiedChange {
  return { kind, path: normalizePath(path) };
}
