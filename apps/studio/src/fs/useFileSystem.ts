/**
 * Minimal FileSystemService consumer for Studio Shell (011 scope)
 * Real privileged ops + IPC will live behind 013 contracts.
 * For now: thin wrapper + direct service (ponytail until 013).
 *
 * Depends on active workspace/project roots (009/010).
 */

import {
  FileSystemService,
  FileSystemPathValidator,
} from '@ray-studio/core';

let _fsService: FileSystemService | null = null;

export function getFileSystemService(): FileSystemService {
  if (!_fsService) {
    _fsService = new FileSystemService({
      validator: new FileSystemPathValidator(),
    });
    console.warn('[module=file-system-service] phase=shell-consumer-ready');
  }
  return _fsService;
}

export async function initFileSystem(workspaceRoot?: string, projectRoot?: string) {
  const svc = getFileSystemService();
  await svc.initialize(workspaceRoot, projectRoot);
  return svc;
}

export async function fsValidatePath(rawPath: string) {
  return getFileSystemService().validatePath(rawPath);
}

export async function fsReadFile(rawPath: string) {
  return getFileSystemService().readFile(rawPath);
}

export async function fsWriteFile(rawPath: string, content: string) {
  return getFileSystemService().writeFile(rawPath, content);
}

export async function fsListDirectory(rawPath: string) {
  return getFileSystemService().listDirectory(rawPath);
}

export async function fsGetMetadata(rawPath: string) {
  return getFileSystemService().getMetadata(rawPath);
}

export function updateFsRoots(workspaceRoot?: string, projectRoot?: string) {
  getFileSystemService().updateRoots(workspaceRoot, projectRoot);
}
