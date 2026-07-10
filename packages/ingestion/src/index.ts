/**
 * @ray-studio/ingestion — public package entry.
 * Module 103: Tree-sitter Parser (Phase B.2 foundation).
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
