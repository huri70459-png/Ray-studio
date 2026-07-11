/**
 * Module 102 — Index Builder / Incremental Indexer (Phase B.2).
 * Own surface: packages/ingestion/src/incremental/**
 */

export {
  createIncrementalIndexer,
  createIncrementalIndexerSync,
  fileId,
} from './indexer.js';
export type {
  IncrementalIndexer,
  IncrementalIndexerOptions,
} from './indexer.js';

export { classifyChange, classifyOnly } from './change-classifier.js';
export { calculateAffectedSet } from './affected-set-calculator.js';
export {
  applySymbolBatch,
  applyRelationshipBatch,
  createSymbolRegistry,
} from './batch-applier.js';
export type { SymbolRegistry } from './batch-applier.js';
export { PathCoalescer } from './debouncer.js';

export {
  compareSymbolRecords,
  emptyIndexDelta,
} from './types.js';
export type {
  SymbolRecord,
  IndexDelta,
  IndexMetrics,
  ChangeKind,
  ClassifiedChange,
  IndexerLogger,
  ReindexOptions,
  RenameOptions,
} from './types.js';
