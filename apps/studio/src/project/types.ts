/**
 * Project types re-export / shell surface (scoped to 010)
 * Shell owns presentation; this keeps boundary clean.
 */
export type {
  ProjectMetadata,
  Project,
  ProjectConfig,
  ProjectState,
  ProjectActivationResult,
  ProjectConfigUpdate,
  RecentProjectList,
} from '@ray-studio/core';
