/**
 * 011 File System Service — Domain Errors
 * Follows 011 spec §15 Error Handling.
 * All errors are safe (no internal paths leaked to untrusted callers; sanitized at log).
 */

import type { FsOperationError } from './types.js';

export class FsError extends Error implements FsOperationError {
  code: FsOperationError['code'];
  path?: string | undefined;

  constructor(code: FsOperationError['code'], message: string, path?: string) {
    super(message);
    this.code = code;
    this.path = path ?? undefined;
    this.name = 'FsError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      path: this.path,
    };
  }
}

export function toFsError(err: unknown, path?: string): FsOperationError {
  if (err instanceof FsError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  // Map common node errors; keep messages high level
  if (msg.includes('ENOENT') || msg.includes('not found')) {
    return new FsError('NOT_FOUND', 'File or directory not found', path);
  }
  if (msg.includes('EACCES') || msg.includes('permission')) {
    return new FsError('ACCESS_DENIED', 'Access denied', path);
  }
  if (msg.includes('EISDIR')) {
    return new FsError('INVALID_PATH', 'Path is a directory where file expected', path);
  }
  return new FsError('IO_ERROR', 'File system operation failed', path);
}
