/**
 * Deterministic keyword / token ranking over SymbolRecord fields.
 * No embeddings, no network, no re-parse.
 *
 * Score range: (0, 1] for matches; 0 means no match (excluded from results).
 * Comparator: score desc, then id asc.
 */

import type { SymbolRecord } from '../incremental/types.js';
import type { SymbolContext } from './types.js';

const TOKEN_SPLIT = /[^a-z0-9_./-]+/i;

/** Tokenize intent for keyword matching (case-insensitive). */
export function tokenizeIntent(intent: string): string[] {
  if (!intent) return [];
  return intent
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Score one record against intent tokens.
 * Fields: name, qualifiedName, path, signature, docstring.
 */
export function scoreSymbolRecord(
  record: SymbolRecord,
  tokens: readonly string[],
): number {
  if (tokens.length === 0) return 0;

  const name = record.name.toLowerCase();
  const qn = record.qualifiedName.toLowerCase();
  const path = record.filePath.toLowerCase();
  const sig = (record.signature ?? '').toLowerCase();
  const doc = (record.docstring ?? '').toLowerCase();

  let sum = 0;
  let hits = 0;

  for (const t of tokens) {
    let best = 0;
    if (name === t) best = 1.0;
    else if (name.startsWith(t)) best = Math.max(best, 0.9);
    else if (name.includes(t)) best = Math.max(best, 0.75);

    if (qn === t) best = Math.max(best, 0.95);
    else if (qn.includes(t)) best = Math.max(best, 0.7);

    if (path.includes(t)) best = Math.max(best, 0.55);
    if (sig.includes(t)) best = Math.max(best, 0.4);
    if (doc.includes(t)) best = Math.max(best, 0.35);

    if (best > 0) {
      hits += 1;
      sum += best;
    }
  }

  if (hits === 0) return 0;
  // Average over all tokens (unmatched tokens pull score down)
  return Math.min(1, sum / tokens.length);
}

export function compareScored(
  a: { score: number; id: string },
  b: { score: number; id: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function toSymbolContext(
  record: SymbolRecord,
  score: number,
  maxSnippetLength: number,
): SymbolContext {
  const ctx: SymbolContext = {
    id: record.id,
    name: record.name,
    score,
  };
  if (record.filePath) ctx.path = record.filePath;
  if (record.kind) ctx.kind = String(record.kind);
  const raw = record.signature ?? record.docstring;
  if (raw) {
    ctx.snippet =
      raw.length > maxSnippetLength
        ? raw.slice(0, maxSnippetLength)
        : raw;
  }
  return ctx;
}

/** Rank records; returns only score > 0, sorted, limited. */
export function rankSymbols(
  records: readonly SymbolRecord[],
  intent: string,
  limit: number,
  maxSnippetLength: number,
): SymbolContext[] {
  if (limit <= 0) return [];
  const tokens = tokenizeIntent(intent);
  if (tokens.length === 0) return [];

  const scored: SymbolContext[] = [];
  for (const r of records) {
    const score = scoreSymbolRecord(r, tokens);
    if (score <= 0) continue;
    scored.push(toSymbolContext(r, score, maxSnippetLength));
  }
  scored.sort(compareScored);
  return scored.slice(0, limit);
}
