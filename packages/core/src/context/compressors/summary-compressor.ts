/**
 * 101 — Bounded summary bodies before budgeting
 */

import type { ArchitectureSummary } from '../types.js';

/** Cap summary body length to keep optional layer cost bounded. */
export function compressSummaries(
  summaries: ArchitectureSummary[],
  maxBodyChars = 2000,
): ArchitectureSummary[] {
  return summaries.map((s) => ({
    ...s,
    body: s.body.length > maxBodyChars ? s.body.slice(0, maxBodyChars) : s.body,
  }));
}
