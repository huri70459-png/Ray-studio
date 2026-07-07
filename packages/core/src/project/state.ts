/**
 * 010 Project Manager — State Machine
 * Per spec §14 State Management.
 * Single source of truth for current active project within the workspace.
 * Immutable metadata/config returned to consumers.
 * State transitions: none → validating → active → deactivating → none
 */

import type { ProjectMetadata, ProjectConfig, ProjectState } from './types.js';

export interface ProjectStateMachine {
  getState(): ProjectState;
  getCurrent(): ProjectMetadata | null;
  getCurrentConfig(): ProjectConfig | null;
  transitionToValidating(): void;
  transitionToActive(meta: ProjectMetadata, config?: ProjectConfig): void;
  transitionToDeactivating(): void;
  transitionToNone(): void;
}

export class InMemoryProjectState implements ProjectStateMachine {
  private state: ProjectState = 'none';
  private current: ProjectMetadata | null = null;
  private currentConfig: ProjectConfig | null = null;

  getState(): ProjectState {
    return this.state;
  }

  getCurrent(): ProjectMetadata | null {
    return this.current ? { ...this.current } : null; // immutable copy
  }

  getCurrentConfig(): ProjectConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }

  transitionToValidating(): void {
    this.state = 'validating';
  }

  transitionToActive(meta: ProjectMetadata, config?: ProjectConfig): void {
    this.current = { ...meta };
    this.currentConfig = config ? { ...config } : {};
    this.state = 'active';
  }

  transitionToDeactivating(): void {
    this.state = 'deactivating';
  }

  transitionToNone(): void {
    this.current = null;
    this.currentConfig = null;
    this.state = 'none';
  }
}
