/**
 * Minimal project consumer for Studio Shell surfaces (010 scope)
 * Real IPC calls will live behind 013 contracts.
 * For now: thin wrapper + demo in-memory manager for early surfaces.
 * Projects live inside an active workspace (009).
 */

import type { ProjectMetadata, ProjectConfig } from '@ray-studio/core';
import {
  ProjectManager,
  InMemoryProjectPathValidator,
  InMemoryProjectConfigStore,
} from '@ray-studio/core';

let _manager: ProjectManager | null = null;

export function getProjectManager(): ProjectManager {
  if (!_manager) {
    _manager = new ProjectManager({
      validator: new InMemoryProjectPathValidator(),
      configStore: new InMemoryProjectConfigStore(),
    });
    // ponytail: sync init for demo; real will be async + IPC + workspace context
    _manager.initialize();
    console.warn('[module=project-manager] phase=shell-consumer-ready');
  }
  return _manager;
}

export async function activateProject(workspaceRoot: string | undefined, projectRoot: string) {
  return getProjectManager().activate(workspaceRoot, projectRoot);
}

export async function deactivateProject() {
  return getProjectManager().deactivate();
}

export function getCurrentProject(): ProjectMetadata | null {
  return getProjectManager().getCurrentProject();
}

export async function getCurrentProjectConfig(): Promise<ProjectConfig | null> {
  return getProjectManager().getCurrentConfig();
}

export async function updateProjectConfig(key: string, value: unknown) {
  return getProjectManager().updateConfig(key, value);
}

export async function listRecentProjects(workspaceRoot?: string) {
  return getProjectManager().listRecent(workspaceRoot);
}
