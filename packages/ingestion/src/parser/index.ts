export { createTreeSitterParser } from './parser.js';
export { ParserError, isParserError } from './errors.js';
export { detectLanguageFromPath } from './language-detect.js';
export { REQUIRED_LANGUAGES } from './grammar-registry.js';
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
} from './types.js';
