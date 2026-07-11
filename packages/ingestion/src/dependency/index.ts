export { createDependencyGraph } from './dependency-graph.js';
export type {
  ComputeDeltaInput,
  DependencyGraph,
  DependencyGraphOptions,
  DependencyLogger,
} from './dependency-graph.js';
export type {
  Relationship,
  RelationshipDelta,
  RelationshipType,
  DeltaMetrics,
  SymbolRef,
  SourceLocation,
} from './relationship-model.js';
export {
  edgeKey,
  fileId,
  normalizePath,
  compareRelationships,
} from './relationship-model.js';
