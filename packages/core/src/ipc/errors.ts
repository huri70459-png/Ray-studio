/**
 * 013 IPC Framework — Standard Error Envelope
 * See prompts/modules/013-ipc-framework.md §15, §5.
 * Constitution §7 (IPC), §3 (explicit), §9 (DoD).
 *
 * Single shape for ALL cross-boundary failures. Never ad-hoc.
 * Renderer receives only sanitized, actionable info. No stacks, no secrets.
 */

export type IpcErrorCategory =
  | 'validation'
  | 'authz'
  | 'timeout'
  | 'unavailable'
  | 'internal'
  | 'contract';

export interface IpcError {
  status: 'error';
  code: string; // e.g. 'FS_ACCESS_DENIED', 'IPC_TIMEOUT', 'CONTRACT_VERSION_MISMATCH'
  category: IpcErrorCategory;
  message: string; // sanitized
  correlationId?: string | undefined;
  retryable: boolean;
  contractVersion?: string | undefined;
  // safe context only
  details?: Record<string, unknown> | undefined;
}

export function createIpcError(params: {
  code: string;
  category: IpcErrorCategory;
  message: string;
  correlationId?: string | undefined;
  retryable?: boolean;
  contractVersion?: string | undefined;
  details?: Record<string, unknown> | undefined;
}): IpcError {
  const e: IpcError = {
    status: 'error',
    code: params.code,
    category: params.category,
    message: sanitizeMessage(params.message),
    retryable: params.retryable ?? false,
  };
  if (params.correlationId !== undefined) e.correlationId = params.correlationId;
  if (params.contractVersion !== undefined) e.contractVersion = params.contractVersion;
  if (params.details !== undefined) e.details = params.details;
  return e;
}

function sanitizeMessage(msg: string): string {
  // Never leak paths, secrets, or internals. Constitution + 013 spec requirement.
  if (!msg) return 'Unknown error';
  // Strip anything that looks like absolute or long paths
  let cleaned = msg.replace(/([A-Za-z]:)?[\\/][^\s'"]{3,}/g, '[path]');
  if (cleaned.includes('/') || cleaned.includes('\\')) {
    const parts = cleaned.split(/[/\\]/).filter(Boolean);
    cleaned = parts.slice(-2).join('/');
  }
  return cleaned.length > 180 ? cleaned.slice(0, 177) + '...' : cleaned;
}

/** Type guard */
export function isIpcError(x: unknown): x is IpcError {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.status === 'error' && typeof o.code === 'string';
}
