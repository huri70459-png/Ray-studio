/**
 * Ingestion-local symbol model (Module 104).
 * Optional alignment with 101 SymbolContext is consumer-side only — no core import.
 */

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'variable'
  | 'constant'
  | 'type'
  | 'module'
  | 'method';

export interface SourceRange {
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}

export interface Symbol {
  id: string;
  kind: SymbolKind;
  name: string;
  qualifiedName: string;
  range: SourceRange;
  signature?: string;
  docstring?: string;
  modifiers?: string[];
}

export interface ExtractMetrics {
  durationMs: number;
  symbolCount: number;
  byKind: Partial<Record<SymbolKind, number>>;
}

export interface ExtractResult {
  symbols: Symbol[];
  metrics: ExtractMetrics;
}

export type ExtractorLogger = {
  info?(message: string, fields?: Record<string, unknown>): void;
  warn?(message: string, fields?: Record<string, unknown>): void;
  debug?(message: string, fields?: Record<string, unknown>): void;
};
