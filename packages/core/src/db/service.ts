/**
 * 016 SQLite Layer — DatabaseService facade
 * Owns lifecycle, migrations, scoped repository access.
 * No Context Engine / Provider / graph logic.
 */

import { ConnectionManager, type SqlDatabase } from './connection.js';
import { DbError, isDbError, toDbError } from './errors.js';
import { MigrationRunner } from './migrations/runner.js';
import { WorkspaceRepository } from './repositories/workspace.repo.js';
import { ProjectRepository } from './repositories/project.repo.js';
import { ConfigRepository } from './repositories/config.repo.js';
import { IngestionRepository } from './repositories/ingestion.repo.js';
import { withTransaction } from './transaction.js';
import type {
  ConfigRecord,
  DbScope,
  DbServiceState,
  IngestionStatusRecord,
  OpenDatabaseOptions,
  ProjectRecord,
  WorkspaceRecord,
} from './types.js';

export interface DatabaseServiceDeps {
  connection?: ConnectionManager;
  migrations?: MigrationRunner;
}

export class DatabaseService {
  private connection: ConnectionManager;
  private migrations: MigrationRunner;
  private state: DbServiceState = 'closed';
  private scope: DbScope = {};
  private workspaces: WorkspaceRepository | null = null;
  private projects: ProjectRepository | null = null;
  private config: ConfigRepository | null = null;
  private ingestion: IngestionRepository | null = null;

  constructor(deps: DatabaseServiceDeps = {}) {
    this.connection = deps.connection ?? new ConnectionManager();
    this.migrations = deps.migrations ?? new MigrationRunner();
    console.warn('[module=sqlite-layer] phase=constructed');
  }

  getState(): DbServiceState {
    return this.state;
  }

  getScope(): DbScope {
    return { ...this.scope };
  }

  /** Set active workspace/project for scope enforcement on scoped ops. */
  setScope(scope: DbScope): void {
    this.scope = {
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
    };
    console.warn(
      `[module=sqlite-layer] phase=scope ws=${this.scope.workspaceId ?? '-'} proj=${this.scope.projectId ?? '-'}`,
    );
  }

  /**
   * Boot: open connection + run forward migrations → ready.
   * File path must already be 011-validated (or ':memory:' for tests).
   */
  open(opts: OpenDatabaseOptions): void {
    if (this.state === 'ready' || this.state === 'opening' || this.state === 'migrating') {
      throw new DbError('INVALID_ARGUMENT', 'Database already open or opening');
    }
    this.state = 'opening';
    try {
      this.connection.open(opts);
      this.state = 'migrating';
      const result = this.migrations.migrate(this.connection.getDb());
      console.warn(
        `[module=sqlite-layer] phase=migrated from=${result.fromVersion} to=${result.toVersion} applied=${result.applied.length}`,
      );
      this.bindRepos(this.connection.getDb());
      this.state = 'ready';
      console.warn('[module=sqlite-layer] phase=ready');
    } catch (err) {
      this.state = 'error';
      try {
        this.connection.close();
      } catch {
        /* ignore */
      }
      this.clearRepos();
      throw isDbError(err) ? err : toDbError(err);
    }
  }

  close(): void {
    this.state = 'closing';
    this.connection.close();
    this.clearRepos();
    this.scope = {};
    this.state = 'closed';
    console.warn('[module=sqlite-layer] phase=closed');
  }

  private bindRepos(db: SqlDatabase): void {
    this.workspaces = new WorkspaceRepository(db);
    this.projects = new ProjectRepository(db);
    this.config = new ConfigRepository(db);
    this.ingestion = new IngestionRepository(db);
  }

  private clearRepos(): void {
    this.workspaces = null;
    this.projects = null;
    this.config = null;
    this.ingestion = null;
  }

  private requireReady(): void {
    if (this.state !== 'ready' || !this.workspaces || !this.projects || !this.config || !this.ingestion) {
      throw new DbError('DB_UNAVAILABLE', 'Database is not ready', true);
    }
  }

  // --- Workspace ---

  upsertWorkspace(
    input: Omit<WorkspaceRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string },
  ): WorkspaceRecord {
    this.requireReady();
    return this.workspaces!.upsert(input);
  }

  getWorkspace(id: string): WorkspaceRecord | null {
    this.requireReady();
    return this.workspaces!.get(id);
  }

  listWorkspaces(): WorkspaceRecord[] {
    this.requireReady();
    return this.workspaces!.list();
  }

  // --- Project (scoped) ---

  upsertProject(
    input: Omit<ProjectRecord, 'createdAt' | 'updatedAt' | 'lastIndexedAt'> & {
      createdAt?: string;
      lastIndexedAt?: string | null;
    },
  ): ProjectRecord {
    this.requireReady();
    this.assertWorkspaceAccess(input.workspaceId);
    return this.projects!.upsert(input);
  }

  getProject(id: string): ProjectRecord | null {
    this.requireReady();
    const row = this.projects!.get(id);
    if (!row) return null;
    this.assertWorkspaceAccess(row.workspaceId);
    return row;
  }

  listProjects(workspaceId: string): ProjectRecord[] {
    this.requireReady();
    this.assertWorkspaceAccess(workspaceId);
    return this.projects!.listByWorkspace(workspaceId);
  }

  // --- Config (scoped) ---

  getConfig(key: string, scope?: DbScope): ConfigRecord | null {
    this.requireReady();
    const s = scope ?? this.scope;
    this.assertConfigScope(s);
    return this.config!.get(key, s);
  }

  setConfig(key: string, value: string, scope?: DbScope): ConfigRecord {
    this.requireReady();
    const s = scope ?? this.scope;
    this.assertConfigScope(s);
    return this.config!.set(key, value, s);
  }

  // --- Ingestion ---

  getIngestionStatus(projectId: string): IngestionStatusRecord | null {
    this.requireReady();
    const project = this.projects!.get(projectId);
    if (!project) return null;
    this.assertWorkspaceAccess(project.workspaceId);
    if (this.scope.projectId && this.scope.projectId !== projectId) {
      throw new DbError('SCOPE_VIOLATION', 'Project is outside active scope');
    }
    return this.ingestion!.get(projectId);
  }

  setIngestionStatus(
    projectId: string,
    stage: string,
    progress: number,
    lastError?: string | null,
  ): IngestionStatusRecord {
    this.requireReady();
    const project = this.projects!.get(projectId);
    if (!project) {
      throw new DbError('NOT_FOUND', 'Project not found for ingestion status');
    }
    this.assertWorkspaceAccess(project.workspaceId);
    if (this.scope.projectId && this.scope.projectId !== projectId) {
      throw new DbError('SCOPE_VIOLATION', 'Project is outside active scope');
    }
    return this.ingestion!.set(projectId, stage, progress, lastError ?? null);
  }

  /** Multi-statement atomic work. */
  transaction<T>(fn: () => T): T {
    this.requireReady();
    return withTransaction(this.connection.getDb(), fn);
  }

  /**
   * When an active workspace scope is set, only that workspace may be accessed.
   * No active workspace → allow (privileged main / bootstrap).
   */
  private assertWorkspaceAccess(workspaceId: string): void {
    if (this.scope.workspaceId && this.scope.workspaceId !== workspaceId) {
      throw new DbError('SCOPE_VIOLATION', 'Workspace is outside active scope');
    }
  }

  private assertConfigScope(s: DbScope): void {
    if (this.scope.workspaceId && s.workspaceId && s.workspaceId !== this.scope.workspaceId) {
      throw new DbError('SCOPE_VIOLATION', 'Config workspace outside active scope');
    }
    if (this.scope.projectId && s.projectId && s.projectId !== this.scope.projectId) {
      throw new DbError('SCOPE_VIOLATION', 'Config project outside active scope');
    }
  }
}
