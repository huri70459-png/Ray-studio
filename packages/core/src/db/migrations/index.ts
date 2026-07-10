/**
 * 016 SQLite Layer — ordered, forward-only migrations
 * Each migration runs in its own transaction (runner).
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '0001_initial',
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  root_path_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  root_path_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  last_indexed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS ingestion_status (
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'idle',
  progress REAL NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (key, workspace_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_config_workspace ON app_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_config_project ON app_config(project_id);
`,
  },
];
