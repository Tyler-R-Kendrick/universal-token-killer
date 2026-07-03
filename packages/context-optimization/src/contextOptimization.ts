export type JsonObject = Record<string, unknown>;

export {
  createToolCatalog,
  filterToolDefinitionsForIntent,
  findToolDefinition
} from './toolDiscovery.js';
export type {
  ToolCatalog,
  ToolDiscoveryMode,
  ToolDiscoveryResult
} from './toolDiscovery.js';
export {
  ArtifactRecoveryIndex,
  createArtifactSearchIndex,
  createContextProof,
  expandArtifactReference,
  verifyContextProof
} from './artifactRecovery.js';
export type {
  ArtifactHandle,
  ArtifactReferenceRecord,
  ContextProof
} from './artifactRecovery.js';
export {
  compactHistoryForRequest,
  compressSessionBlocks,
  createSessionContextLedger
} from './sessionContext.js';
export type {
  DedupePolicy,
  RetentionPolicy,
  SessionBlock,
  SessionContextLedger,
  SessionContextLedgerEvent,
  StaleErrorPolicy
} from './sessionContext.js';
export {
  resolveModelProxyPolicy
} from './contextPolicy.js';
export type {
  ModelProxyPolicy
} from './contextPolicy.js';
export {
  ContextBudgetManager
} from './contextBudget.js';
export type {
  ContextBudgetDecision
} from './contextBudget.js';
export {
  detectCacheVolatility
} from './cacheVolatility.js';
export type {
  CacheVolatilityFinding
} from './cacheVolatility.js';
export {
  optimizePromptAsset
} from './promptAssetOptimization.js';
export {
  classifyProviderError
} from './providerErrors.js';
export type {
  ProviderErrorKind
} from './providerErrors.js';
export {
  createCompressionProviderRegistry
} from './compressionProviders.js';
export type {
  CompressionProvider
} from './compressionProviders.js';
export {
  createContextOptimizationPipeline
} from './contextPipeline.js';
