import type { ParserErrorCode } from './types.js';

export class ParserError extends Error {
  readonly code: ParserErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ParserErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ParserError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function isParserError(err: unknown): err is ParserError {
  return err instanceof ParserError;
}
