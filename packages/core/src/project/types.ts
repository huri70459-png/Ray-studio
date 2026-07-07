/**
 * 010 Project Manager — Core Types
 * Follows prompts/modules/010-project-manager.md §9 Public Interfaces + §14 State.
 * Constitution §5 (monorepo, packages/core), §6 (strict TS), §3 (boundaries).
 *
 * Project is scoped within an active workspace (009).
 * Owns only metadata + local config (non-graph, non-FS content).
 */

export interface ProjectMetadata {
  rootPath: string;                 // validated absolute path (inside current workspace)
  name?: string;                    // optional display name (derived or custom)
  workspaceRoot?: string;           // parent workspace root (for scoping)
  lastAccessed: number;             // epoch ms
  // Lightweight custom attributes (never secrets, never graph entities)
  custom?: Record<string, unknown>;
}

export interface ProjectConfig {
  // Project-local overrides / settings (feature flags, UI prefs, tool config)
  // Persisted separately from graph. No secrets.
  [key: string]: unknown;
}

export interface Project {
  metadata: ProjectMetadata;
  config?: ProjectConfig;
}

export type ProjectState = 'none' | 'validating' | 'active' | 'deactivating';

export interface ProjectActivationResult {
  success: boolean;
  project?: Project;
  error?: string;
}

export interface ProjectConfigUpdate {
  key: string;
  value: unknown;
}

export interface RecentProjectList {
  projects: ProjectMetadata[];
  currentId?: string | undefined; // rootPath of active project
}
