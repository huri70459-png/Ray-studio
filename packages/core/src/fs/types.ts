/**
 * 011 File System Service — Core Types
 * Follows prompts/modules/011-file-system-service.md §9 Public Interfaces.
 * Constitution §5, §7 (security, boundaries), §3.
 *
 * Provides validated, scoped FS access. Owns no knowledge/graph content.
 */

export interface ValidatedPath {
  canonicalPath: string; // normalized, absolute, within active scope
  scope: 'workspace' | 'project' | 'unknown';
}

export interface FileMetadata {
  path: string;
  size: number;
  mtime: number;
  isDirectory: boolean;
  isFile: boolean;
}

export interface ReadFileResult {
  path: string;
  content: string; // text for MVP; Buffer support later
  metadata: FileMetadata;
}

export interface WriteFileResult {
  path: string;
  success: boolean;
  metadata?: FileMetadata;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface ListDirectoryResult {
  path: string;
  entries: DirectoryEntry[];
}

export interface FsOperationError {
  code: 'ACCESS_DENIED' | 'NOT_FOUND' | 'INVALID_PATH' | 'IO_ERROR' | 'READ_ONLY' | 'UNKNOWN';
  message: string;
  path?: string | undefined;
}

export interface FsValidationResult {
  valid: boolean;
  validatedPath?: ValidatedPath;
  error?: FsOperationError;
}

export type FsServiceState = 'uninitialized' | 'ready' | 'error';
