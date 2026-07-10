/**
 * 101 Context Engine — public types (Phase B.1)
 */

export type PortMode = 'null' | 'fake' | 'live';

export type ProvenanceSource =
  | 'constitution'
  | 'moduleSpec'
  | 'graph'
  | 'semantic'
  | 'summary'
  | 'fs';

export interface ContextRequest {
  intent: string;
  /** Module id or slug, e.g. "013" or "013-ipc-framework" */
  targetModule?: string;
  maxTokens: number;
  /** Informational for future model-specific estimators; not used to call providers */
  modelId?: string;
  excludePatterns?: string[];
  workspaceId?: string;
  projectId?: string;
  /** Optional absolute or repo-relative overrides for tests / hosts */
  constitutionPath?: string;
  moduleSpecPath?: string;
}

export interface SymbolContext {
  id: string;
  path?: string;
  name: string;
  kind?: string;
  snippet?: string;
  score: number;
}

export interface ArchitectureSummary {
  id: string;
  title: string;
  body: string;
  score: number;
}

export interface ProvenanceItem {
  itemId: string;
  source: ProvenanceSource;
  reason: string;
  score: number;
}

export interface AssembledContext {
  layers: {
    constitution?: string;
    moduleSpec?: string;
    symbols: SymbolContext[];
    summaries: ArchitectureSummary[];
  };
  tokenEstimate: number;
  provenance: ProvenanceItem[];
  portsUsed: {
    graph: PortMode;
    semantic: PortMode;
    summary: PortMode;
  };
  degraded: boolean;
}

export interface GraphQueryPort {
  readonly mode: PortMode;
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

export interface SemanticSearchPort {
  readonly mode: PortMode;
  search(query: { intent: string; limit: number }): Promise<SymbolContext[]>;
}

export interface SummaryPort {
  readonly mode: PortMode;
  getSummaries(query: {
    intent: string;
    targetModule?: string;
  }): Promise<ArchitectureSummary[]>;
}

export interface TokenEstimatorPort {
  estimate(text: string): number;
}

export interface ContextEngineDeps {
  graph: GraphQueryPort;
  semantic: SemanticSearchPort;
  summaries: SummaryPort;
  tokens: TokenEstimatorPort;
  /** Optional: validated read for constitution/module files (may wrap 011 in host) */
  readText?: (path: string) => Promise<string | null>;
}

export interface ContextEngine {
  buildContext(request: ContextRequest): Promise<AssembledContext>;
}
