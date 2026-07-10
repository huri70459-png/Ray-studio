/**
 * 101 Context Engine — public exports (Phase B.1)
 */

export type {
  ArchitectureSummary,
  AssembledContext,
  ContextEngine as IContextEngine,
  ContextEngineDeps,
  ContextRequest,
  GraphQueryPort,
  PortMode,
  ProvenanceItem,
  ProvenanceSource,
  SemanticSearchPort,
  SummaryPort,
  SymbolContext,
  TokenEstimatorPort,
} from './types.js';

export {
  ContextBudgetError,
  ContextConfigError,
  ContextError,
  isContextError,
} from './errors.js';
export type { ContextErrorCode } from './errors.js';

export {
  FakeGraphQueryPort,
  FakeSemanticSearchPort,
  FakeSummaryPort,
  HeuristicTokenEstimator,
  NullGraphQueryPort,
  NullSemanticSearchPort,
  NullSummaryPort,
  ThrowingGraphQueryPort,
} from './ports.js';
export type { FakePortFixtures } from './ports.js';

export {
  DEFAULT_CONSTITUTION_PATH,
  defaultReadText,
  loadGovernanceLayers,
  resolveModuleSpecPath,
} from './builders/layered-context-builder.js';

export { ContextEngine, createContextEngine } from './engine.js';
