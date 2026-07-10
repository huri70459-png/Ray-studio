/**
 * @ray-studio/core
 * Entry for shared core (workspace 009 + project 010 + fs 011 + future domain packages).
 */
export * from './project/index.js';
export * from './fs/index.js';
export * from './watcher/index.js';
export * from './ipc/index.js';
// NOTE: workspace/ sources were not present in src at 011 start (only dist artifacts). Re-add via recovery if needed for consumers.

