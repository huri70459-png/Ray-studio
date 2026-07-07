/**
 * 010 Project Manager — Config Store
 * Per spec §9 Configuration Contract, §11 Database Schema (config is non-graph local state).
 * Interface for persistence (real via 016 SQLite); in-memory fallback here.
 */

import type { ProjectConfig } from './types.js';

export interface ProjectConfigStore {
  load(projectRoot: string): Promise<ProjectConfig>;
  save(projectRoot: string, config: ProjectConfig): Promise<void>;
  update(projectRoot: string, key: string, value: unknown): Promise<ProjectConfig>;
}

// ponytail: In-memory fallback until 016 SQLite Layer. Real impl will roundtrip via SQLite scoped to project.
export class InMemoryProjectConfigStore implements ProjectConfigStore {
  private store = new Map<string, ProjectConfig>();

  async load(projectRoot: string): Promise<ProjectConfig> {
    return { ...(this.store.get(projectRoot) || {}) };
  }

  async save(projectRoot: string, config: ProjectConfig): Promise<void> {
    this.store.set(projectRoot, { ...config });
  }

  async update(projectRoot: string, key: string, value: unknown): Promise<ProjectConfig> {
    const existing = await this.load(projectRoot);
    const updated = { ...existing, [key]: value };
    await this.save(projectRoot, updated);
    return updated;
  }
}
