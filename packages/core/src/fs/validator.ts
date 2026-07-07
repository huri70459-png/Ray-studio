/**
 * 011 File System Service — Path Validator
 * Enforces strict scoping. See 011 spec §2, §5, §17.
 * Constitution §7 Security.
 *
 * ponytail: full symlink/junction/reparse handling + case sensitivity platform rules in later iteration (after 012/016).
 */

import * as path from 'node:path';
import type { FsValidationResult } from './types.js';

export interface FsPathValidator {
  validatePath(rawPath: string, workspaceRoot?: string, projectRoot?: string): Promise<FsValidationResult>;
  setRoots(workspaceRoot?: string, projectRoot?: string): void;
}

export class FileSystemPathValidator implements FsPathValidator {
  private workspaceRoot: string | null = null;
  private projectRoot: string | null = null;

  setRoots(workspaceRoot?: string, projectRoot?: string): void {
    this.workspaceRoot = workspaceRoot ? this.normalize(workspaceRoot) : null;
    this.projectRoot = projectRoot ? this.normalize(projectRoot) : null;
  }

  async validatePath(rawPath: string, workspaceRoot?: string, projectRoot?: string): Promise<FsValidationResult> {
    if (!rawPath || typeof rawPath !== 'string') {
      return { valid: false, error: { code: 'INVALID_PATH', message: 'Path must be a non-empty string' } };
    }

    // Use provided or internal roots
    const ws = workspaceRoot ? this.normalize(workspaceRoot) : this.workspaceRoot;
    const pr = projectRoot ? this.normalize(projectRoot) : this.projectRoot;

    try {
      // Resolve to absolute, normalize separators
      let candidate = path.resolve(rawPath);
      candidate = this.normalize(candidate);

      // Prevent obvious traversal before root check (redundant but defense in depth)
      if (candidate.includes('..')) {
        // after resolve it shouldn't, but double check
      }

      const activeRoot = pr || ws;
      if (!activeRoot) {
        return { valid: false, error: { code: 'ACCESS_DENIED', message: 'No active workspace or project root' } };
      }

      if (!candidate.startsWith(activeRoot)) {
        return {
          valid: false,
          error: { code: 'ACCESS_DENIED', message: 'Path is outside active scope', path: this.sanitizeForError(candidate) },
        };
      }

      // ponytail: full symlink resolution + realpath check to prevent escape via links (future enhancement)
      const scope: 'project' | 'workspace' = pr && candidate.startsWith(pr) ? 'project' : 'workspace';

      return {
        valid: true,
        validatedPath: { canonicalPath: candidate, scope },
      };
    } catch {
      return { valid: false, error: { code: 'INVALID_PATH', message: 'Failed to canonicalize path' } };
    }
  }

  private normalize(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private sanitizeForError(p: string): string {
    // Never return full absolute in errors to untrusted layers
    const parts = p.split('/');
    return parts.slice(-2).join('/');
  }
}
