/**
 * 016 SQLite Layer — public entry
 * Domain package. IPC contracts live under ipc/contracts (namespace db owned by 016).
 */

export * from './types.js';
export * from './errors.js';
export * from './connection.js';
export * from './transaction.js';
export * from './migrations/index.js';
export * from './migrations/runner.js';
export * from './repositories/workspace.repo.js';
export * from './repositories/project.repo.js';
export * from './repositories/config.repo.js';
export * from './repositories/ingestion.repo.js';
export * from './service.js';
