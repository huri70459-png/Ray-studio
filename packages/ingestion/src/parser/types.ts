/**
 * Language-agnostic public types for Module 103 Tree-sitter Parser.
 * No language-specific concepts in the exported contract.
 */

export interface ParserOptions {
  /** Override directory containing grammar .wasm files */
  grammarsDir?: string;
  /** Optional structured logger */
  logger?: ParserLogger;
}

export interface ParserLogger {
  info?(message: string, fields?: Record<string, unknown>): void;
  debug?(message: string, fields?: Record<string, unknown>): void;
}

/** Primary product API — language-agnostic */
export interface TreeSitterParser {
  parse(input: ParseInput): Promise<ParseResult>;
  parseIncremental(input: IncrementalParseInput): Promise<ParseResult>;
  query(tree: SyntaxTree, querySource: string): QueryMatch[];
  getNodeAtPosition(tree: SyntaxTree, byteOffset: number): SyntaxNode | null;
  supportedLanguages(): string[];
}

export interface ParseInput {
  source: string;
  /** Canonical language id when known (e.g. "typescript", "python") */
  language?: string;
  /** Used for language detection when language is omitted */
  filePath?: string;
}

export interface ParseEdit {
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  startPosition?: SourcePosition;
  oldEndPosition?: SourcePosition;
  newEndPosition?: SourcePosition;
}

export interface SourcePosition {
  row: number;
  column: number;
}

export interface IncrementalParseInput {
  language: string;
  previousSource: string;
  newSource: string;
  oldTree: SyntaxTree;
  edits: ParseEdit[];
}

export interface ParseMetrics {
  durationMs: number;
  nodeCount?: number;
  sourceBytes: number;
}

export interface ParseResult {
  tree: SyntaxTree;
  language: string;
  didEdit: boolean;
  errorNodes: SyntaxNode[];
  metrics: ParseMetrics;
}

export interface SyntaxTree {
  readonly rootNode: SyntaxNode;
  delete?(): void;
}

export interface SyntaxNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly startPosition: SourcePosition;
  readonly endPosition: SourcePosition;
  readonly childCount: number;
  readonly hasError?: boolean;
  readonly isError?: boolean;
  child(index: number): SyntaxNode | null;
  namedChild(index: number): SyntaxNode | null;
}

export interface QueryMatch {
  pattern: number;
  captures: Array<{ name: string; node: SyntaxNode }>;
}

export type ParserErrorCode =
  | 'UNSUPPORTED_LANGUAGE'
  | 'GRAMMAR_LOAD_FAILED'
  | 'INVALID_QUERY'
  | 'INVALID_INPUT'
  | 'PARSER_INTERNAL';
