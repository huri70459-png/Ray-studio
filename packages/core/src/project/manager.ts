/**
 * 010 Project Manager — Core Implementation
 * See prompts/modules/010-project-manager.md for full spec.
 * Constitution §9 DoD, §5 Monorepo (core), ponytail for deps (011/016), dependency inversion.
 *
 * All privileged FS/persist/comm delegated (PathValidator, ConfigStore).
 * Structured logging + sanitize.
 * State machine explicit.
 */

import type {
  ProjectMetadata,
  ProjectConfig,
  Project,
  ProjectState,
  ProjectActivationResult,
} from './types.js';
import type { ProjectEventEmitter } from './events.js';
import { InMemoryProjectState } from './state.js';
import type { ProjectConfigStore } from './config.js';
import { InMemoryProjectConfigStore } from './config.js';

export interface ProjectPathValidator {
  isValidProjectRoot(path: string, workspaceRoot?: string): Promise<{ valid: boolean; error?: string }>;
}

export interface ProjectManagerDeps {
  validator: ProjectPathValidator;
  configStore?: ProjectConfigStore; // optional; falls back to in-mem
  emitter?: ProjectEventEmitter;
}

export class ProjectManager {
  private state = new InMemoryProjectState();
  private configStore: ProjectConfigStore;

  constructor(private deps: ProjectManagerDeps) {
    this.configStore = deps.configStore ?? new InMemoryProjectConfigStore();
    console.warn('[module=project-manager] phase=constructed');
  }

  async initialize(): Promise<void> {
    console.warn('[module=project-manager] phase=initialize');
    // ponytail: load last active project metadata from 016 later; no auto-activate
  }

  getState(): ProjectState {
    return this.state.getState();
  }

  getCurrentProject(): ProjectMetadata | null {
    return this.state.getCurrent();
  }

  getCurrentConfig(): ProjectConfig | null {
    return this.state.getCurrentConfig();
  }

  async getCurrentProjectFull(): Promise<Project | null> {
    const meta = this.state.getCurrent();
    if (!meta) return null;
    const config = this.state.getCurrentConfig() || (await this.configStore.load(meta.rootPath));
    return { metadata: meta, config };
  }

  async listRecent(_workspaceRoot?: string): Promise<{ projects: ProjectMetadata[] }> {
    // ponytail: full recent-within-workspace store in future (via 016); current in-mem only
    const t0 = Date.now();
    console.warn(`[module=project-manager] phase=list-recent duration=${Date.now() - t0}ms`);
    return { projects: [] };
  }

  async activate(workspaceRoot: string | undefined, projectRoot: string): Promise<ProjectActivationResult> {
    console.warn(`[module=project-manager] phase=activate-request ws=${this.sanitize(workspaceRoot)} proj=${this.sanitize(projectRoot)}`);
    this.state.transitionToValidating();

    const prep = await this.deps.validator.isValidProjectRoot(projectRoot, workspaceRoot);
    if (!prep.valid) {
      this.state.transitionToNone();
      return { success: false, error: prep.error || 'invalid project root' };
    }

    const meta: ProjectMetadata = {
      rootPath: projectRoot,
      lastAccessed: Date.now(),
      ...(workspaceRoot !== undefined ? { workspaceRoot } : {}),
    };

    // Load or init config (scoped to this project root)
    const config = await this.configStore.load(projectRoot);

    this.state.transitionToActive(meta, config);

    const result: ProjectActivationResult = {
      success: true,
      project: { metadata: meta, config },
    };

    console.warn(`[module=project-manager] phase=activated proj=${this.sanitize(meta.rootPath)}`);
    return result;
  }

  async deactivate(): Promise<void> {
    console.warn('[module=project-manager] phase=deactivate-request');
    if (this.state.getCurrent()) {
      this.state.transitionToDeactivating();
      const cur = this.state.getCurrent();
      const cfg = this.state.getCurrentConfig();
      if (cur && cfg) {
        await this.configStore.save(cur.rootPath, cfg);
      }
    }
    this.state.transitionToNone();
    console.warn('[module=project-manager] phase=deactivated');
  }

  async updateConfig(key: string, value: unknown): Promise<{ success: boolean; config?: ProjectConfig; error?: string }> {
    const meta = this.state.getCurrent();
    if (!meta || this.state.getState() !== 'active') {
      return { success: false, error: 'no active project' };
    }

    try {
      const updated = await this.configStore.update(meta.rootPath, key, value);
      this.state.transitionToActive(meta, updated);

      console.warn(`[module=project-manager] phase=config-updated key=${key}`);
      return { success: true, config: updated };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'config update failed';
      return { success: false, error: msg };
    }
  }

  async getConfig(): Promise<ProjectConfig | null> {
    const meta = this.state.getCurrent();
    if (!meta) return null;
    return this.state.getCurrentConfig() || (await this.configStore.load(meta.rootPath));
  }

  private sanitize(p?: string): string {
    if (!p) return '<none>';
    return p.replace(/\\/g, '/').split('/').slice(-2).join('/');
  }
}

// In-memory fallbacks (ponytail: until 011/016 implemented)
// Real PathValidator lives in 011 File System Service.
// Real ConfigStore + metadata persistence lives in 016 SQLite Layer.
export class InMemoryProjectPathValidator implements ProjectPathValidator {
  async isValidProjectRoot(path: string, workspaceRoot?: string): Promise<{ valid: boolean; error?: string }> {
    if (!path || path.trim() === '') return { valid: false, error: 'empty path' };
    if (workspaceRoot) {
      const normPath = path.replace(/\\/g, '/');
      const normWs = workspaceRoot.replace(/\\/g, '/');
      if (!normPath.startsWith(normWs)) {
        return { valid: false, error: 'project outside workspace' };
      }
    }
    return { valid: true };
  }
}

// Re-export the config store impl so consumers (tests, shell) can import from manager.ts like 009 pattern
export { InMemoryProjectConfigStore } from './config.js';
