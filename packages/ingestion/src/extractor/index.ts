export { createSymbolExtractor } from './symbol-extractor.js';
export type { SymbolExtractor, SymbolExtractorOptions } from './symbol-extractor.js';
export type {
  Symbol,
  SymbolKind,
  SourceRange,
  ExtractMetrics,
  ExtractResult,
  ExtractorLogger,
} from './symbol-model.js';
export {
  isExtractorLanguageSupported,
  supportedExtractorLanguages,
  loadQuerySource,
} from './query-loader.js';
