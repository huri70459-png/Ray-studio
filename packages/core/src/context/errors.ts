/**
 * 101 Context Engine — domain errors (Phase B.1)
 */

export type ContextErrorCode =
  | 'INVALID_ARGUMENT'
  | 'BUDGET_EXCEEDED'
  | 'CONFIG_ERROR'
  | 'INTERNAL';

export class ContextError extends Error {
  code: ContextErrorCode;

  constructor(code: ContextErrorCode, message: string) {
    super(message);
    this.name = 'ContextError';
    this.code = code;
  }
}

export class ContextBudgetError extends ContextError {
  constructor(message = 'Constitution layer alone exceeds token budget') {
    super('BUDGET_EXCEEDED', message);
    this.name = 'ContextBudgetError';
  }
}

export class ContextConfigError extends ContextError {
  constructor(message: string) {
    super('CONFIG_ERROR', message);
    this.name = 'ContextConfigError';
  }
}

export function isContextError(x: unknown): x is ContextError {
  return x instanceof ContextError;
}
