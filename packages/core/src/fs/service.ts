/**
 * 011 File System Service — Core Implementation
 * See prompts/modules/011-file-system-service.md
 * Constitution priorities: Security > Correctness > Reliability > ...
 * Dependency inversion: validator injected. Operations via node:fs (privileged for core).
 *
 * ponytail: until 013 (IPC contracts + capability ordering); until 012 (watcher integration); until 016 (persistence of grants).
 * Real IPC surface + main-process isolation later.
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type {
  FileMetadata,
  ReadFileResult,
  WriteFileResult,
  ListDirectoryResult,
  FsValidationResult,
  FsServiceState,
} from './types.js';
import { FsError, toFsError } from './errors.js';
import { FileSystemPathValidator, type FsPathValidator } from './validator.js';

export interface FileSystemServiceDeps {
  validator?: FsPathValidator;
}

export class FileSystemService {
  private validator: FsPathValidator;
  private state: FsServiceState = 'uninitialized';
  private activeWorkspace: string | undefined = undefined;
  private activeProject: string | undefined = undefined;

  constructor(deps: FileSystemServiceDeps = {}) {
    this.validator = deps.validator ?? new FileSystemPathValidator();
    console.warn('[module=file-system-service] phase=constructed');
  }

  async initialize(workspaceRoot?: string, projectRoot?: string): Promise<void> {
    console.warn(`[module=file-system-service] phase=initialize ws=${this.sanitize(workspaceRoot)} proj=${this.sanitize(projectRoot)}`);
    this.updateRoots(workspaceRoot, projectRoot);
    this.state = 'ready';
    console.warn('[module=file-system-service] phase=ready');
  }

  getState(): FsServiceState {
    return this.state;
  }

  updateRoots(workspaceRoot?: string, projectRoot?: string): void {
    this.activeWorkspace = workspaceRoot ? this.normalize(workspaceRoot) : undefined;
    this.activeProject = projectRoot ? this.normalize(projectRoot) : undefined;
    this.validator.setRoots(this.activeWorkspace, this.activeProject);
    console.warn(`[module=file-system-service] phase=roots-updated ws=${this.sanitize(this.activeWorkspace)} proj=${this.sanitize(this.activeProject)}`);
  }

  async validatePath(rawPath: string): Promise<FsValidationResult> {
    const t0 = Date.now();
    const res = await this.validator.validatePath(rawPath, this.activeWorkspace, this.activeProject);
    const dur = Date.now() - t0;
    console.warn(`[module=file-system-service] phase=validate duration=${dur}ms valid=${res.valid}`);
    return res;
  }

  async readFile(rawPath: string): Promise<ReadFileResult | FsError> {
    const val = await this.validatePath(rawPath);
    if (!val.valid || !val.validatedPath) {
      return val.error ? new FsError(val.error.code, val.error.message, val.error.path) : new FsError('INVALID_PATH', 'Invalid path');
    }

    const canonical = val.validatedPath.canonicalPath;
    try {
      const stat = await fs.stat(canonical);
      if (stat.isDirectory()) {
        throw new FsError('INVALID_PATH', 'Path is a directory');
      }
      const content = await fs.readFile(canonical, 'utf8');
      const meta: FileMetadata = {
        path: canonical,
        size: stat.size,
        mtime: stat.mtimeMs,
        isDirectory: false,
        isFile: true,
      };
      console.warn(`[module=file-system-service] phase=read ok path=${this.sanitize(canonical)} size=${meta.size}`);
      return { path: canonical, content, metadata: meta };
    } catch (e) {
      const err = toFsError(e, this.sanitize(canonical));
      console.warn(`[module=file-system-service] phase=read error code=${err.code}`);
      return err as FsError;
    }
  }

  async writeFile(rawPath: string, content: string): Promise<WriteFileResult | FsError> {
    const val = await this.validatePath(rawPath);
    if (!val.valid || !val.validatedPath) {
      return val.error ? new FsError(val.error.code, val.error.message, val.error.path) : new FsError('INVALID_PATH', 'Invalid path');
    }

    const canonical = val.validatedPath.canonicalPath;
    try {
      // Ensure parent dir (atomicity limited in node without extra libs; fail safe)
      const dir = this.normalize(nodePath.dirname(canonical));
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(canonical, content, 'utf8');
      const stat = await fs.stat(canonical);
      const meta: FileMetadata = {
        path: canonical,
        size: stat.size,
        mtime: stat.mtimeMs,
        isDirectory: false,
        isFile: true,
      };
      console.warn(`[module=file-system-service] phase=write ok path=${this.sanitize(canonical)}`);
      return { path: canonical, success: true, metadata: meta };
    } catch (e) {
      const err = toFsError(e, this.sanitize(canonical));
      return err as FsError;
    }
  }

  async listDirectory(rawPath: string): Promise<ListDirectoryResult | FsError> {
    const val = await this.validatePath(rawPath);
    if (!val.valid || !val.validatedPath) {
      return val.error ? new FsError(val.error.code, val.error.message, val.error.path) : new FsError('INVALID_PATH', 'Invalid path');
    }

    const canonical = val.validatedPath.canonicalPath;
    try {
      const dirents = await fs.readdir(canonical, { withFileTypes: true });
      const entries = dirents.map((d) => ({
        name: d.name,
        path: this.normalize(nodePath.join(canonical, d.name)),
        isDirectory: d.isDirectory(),
      }));
      console.warn(`[module=file-system-service] phase=list ok path=${this.sanitize(canonical)} count=${entries.length}`);
      return { path: canonical, entries };
    } catch (e) {
      const err = toFsError(e, this.sanitize(canonical));
      return err as FsError;
    }
  }

  async getMetadata(rawPath: string): Promise<FileMetadata | FsError> {
    const val = await this.validatePath(rawPath);
    if (!val.valid || !val.validatedPath) {
      return val.error ? new FsError(val.error.code, val.error.message, val.error.path) : new FsError('INVALID_PATH', 'Invalid path');
    }

    const canonical = val.validatedPath.canonicalPath;
    try {
      const stat = await fs.stat(canonical);
      return {
        path: canonical,
        size: stat.size,
        mtime: stat.mtimeMs,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
      };
    } catch (e) {
      return toFsError(e, this.sanitize(canonical)) as FsError;
    }
  }

  private normalize(p?: string): string {
    if (!p) return '';
    return p.replace(/\\/g, '/');
  }

  private sanitize(p?: string): string {
    if (!p) return '<none>';
    const parts = p.split('/');
    return parts.slice(-2).join('/');
  }
}
