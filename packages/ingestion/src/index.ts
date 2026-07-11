/**
 * @ray-studio/ingestion — public package entry.
 * Module 103: Tree-sitter Parser (Phase B.2 foundation).
 * Module 104: Symbol Extractor (Phase B.2).
 * Module 105: Dependency Graph (Phase B.2 slice — in-process edges).
 * Module 102: Incremental Index Builder (Phase B.2 coordinator).
 * Module 101 Live Adapters (B.2): live Graph/Semantic/Summary ports over 102/105.
 */
export {
  createTreeSitterParser,
  ParserError,
  isParserError,
  detectLanguageFromPath,
  REQUIRED_LANGUAGES,
} from './parser/index.js';
export type {
  TreeSitterParser,
  ParserOptions,
  ParserLogger,
  ParseInput,
  ParseEdit,
  IncrementalParseInput,
  ParseResult,
  ParseMetrics,
  SyntaxTree,
  SyntaxNode,
  QueryMatch,
  SourcePosition,
  ParserErrorCode,
} from './parser/index.js';

export {
  createSymbolExtractor,
  isExtractorLanguageSupported,
  supportedExtractorLanguages,
  loadQuerySource,
} from './extractor/index.js';
export type {
  SymbolExtractor,
  SymbolExtractorOptions,
  Symbol,
  SymbolKind,
  SourceRange,
  ExtractMetrics,
  ExtractResult,
  ExtractorLogger,
} from './extractor/index.js';

export {
  createDependencyGraph,
  edgeKey,
  fileId,
  normalizePath,
  compareRelationships,
} from './dependency/index.js';
export type {
  DependencyGraph,
  DependencyGraphOptions,
  DependencyLogger,
  ComputeDeltaInput,
  Relationship,
  RelationshipDelta,
  RelationshipType,
  DeltaMetrics,
  SymbolRef,
  SourceLocation,
} from './dependency/index.js';

export {
  createIncrementalIndexer,
  createIncrementalIndexerSync,
  classifyChange,
  calculateAffectedSet,
  compareSymbolRecords,
  emptyIndexDelta,
} from './incremental/index.js';
export type {
  IncrementalIndexer,
  IncrementalIndexerOptions,
  SymbolRecord,
  IndexDelta,
  IndexMetrics,
  ChangeKind,
  ClassifiedChange,
  IndexerLogger,
  ReindexOptions,
  RenameOptions,
} from './incremental/index.js';

export {
  createLiveGraphQueryPort,
  createLiveSemanticSearchPort,
  createLiveSummaryPort,
} from './adapters/index.js';
export type {
  PortMode,
  SymbolContext,
  ArchitectureSummary,
  GraphQueryPort,
  SemanticSearchPort,
  SummaryPort,
  AdapterLogger,
  GraphExpandPolicy,
  LiveAdapterSymbolOptions,
  LiveGraphQueryPortOptions,
  LiveSemanticSearchPortOptions,
  LiveSummaryPortOptions,
} from './adapters/index.js';
