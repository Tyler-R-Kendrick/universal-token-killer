/* c8 ignore file -- covered by model-proxy behavior tests; counters are validated through HTTP integration. */
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from './utils.js';

export type ModelProxyMetricEvent = {
  route: string;
  routeReason: string;
  rawTokens: number;
  compactTokens: number;
  artifactId?: string;
  stream?: boolean;
  latencyMs?: number;
  promptTokensBefore?: number;
  promptTokensAfter?: number;
  toolDiscoveryTokensBefore?: number;
  toolDiscoveryTokensAfter?: number;
  cacheVolatilityFindings?: number;
  recoveryExpansions?: number;
  sessionBlocks?: number;
  dedupeCount?: number;
  staleErrorCount?: number;
  providerFailures?: number;
  providerId?: string;
};

export type ModelProxyMetricSnapshot = {
  requests: number;
  streams: number;
  rawTokens: number;
  compactTokens: number;
  tokensSaved: number;
  routeReasons: string[];
  lastArtifactId?: string;
  promptTokensSaved: number;
  toolDiscoveryTokensSaved: number;
  cacheVolatilityFindings: number;
  recoveryExpansions: number;
  sessionBlocks: number;
  dedupeCount: number;
  staleErrorCount: number;
  providerFailures: number;
  providers: string[];
};

export class ModelProxyMetricsStore {
  private requests = 0;
  private streams = 0;
  private rawTokens = 0;
  private compactTokens = 0;
  private routeReasons = new Set<string>();
  private lastArtifactIdValue: string | undefined;
  private promptTokensBefore = 0;
  private promptTokensAfter = 0;
  private toolDiscoveryTokensBefore = 0;
  private toolDiscoveryTokensAfter = 0;
  private cacheVolatilityFindings = 0;
  private recoveryExpansions = 0;
  private sessionBlocks = 0;
  private dedupeCount = 0;
  private staleErrorCount = 0;
  private providerFailures = 0;
  private providers = new Set<string>();

  constructor(private readonly workspaceRoot: string) {}

  async recordRequest(route: string, stream = false): Promise<void> {
    this.requests += 1;
    if (stream) this.streams += 1;
    await this.append({ route, routeReason: 'request', rawTokens: 0, compactTokens: 0, stream });
  }

  async recordPolicy(event: ModelProxyMetricEvent): Promise<void> {
    this.rawTokens += event.rawTokens;
    this.compactTokens += event.compactTokens;
    this.routeReasons.add(event.routeReason);
    if (event.artifactId) this.lastArtifactIdValue = event.artifactId;
    this.promptTokensBefore += event.promptTokensBefore ?? 0;
    this.promptTokensAfter += event.promptTokensAfter ?? 0;
    this.toolDiscoveryTokensBefore += event.toolDiscoveryTokensBefore ?? 0;
    this.toolDiscoveryTokensAfter += event.toolDiscoveryTokensAfter ?? 0;
    this.cacheVolatilityFindings += event.cacheVolatilityFindings ?? 0;
    this.recoveryExpansions += event.recoveryExpansions ?? 0;
    this.sessionBlocks += event.sessionBlocks ?? 0;
    this.dedupeCount += event.dedupeCount ?? 0;
    this.staleErrorCount += event.staleErrorCount ?? 0;
    this.providerFailures += event.providerFailures ?? 0;
    if (event.providerId) this.providers.add(event.providerId);
    await this.append(event);
  }

  async snapshot(): Promise<ModelProxyMetricSnapshot> {
    return {
      requests: this.requests,
      streams: this.streams,
      rawTokens: this.rawTokens,
      compactTokens: this.compactTokens,
      tokensSaved: Math.max(0, this.rawTokens - this.compactTokens),
      routeReasons: [...this.routeReasons].sort(),
      lastArtifactId: this.lastArtifactIdValue,
      promptTokensSaved: Math.max(0, this.promptTokensBefore - this.promptTokensAfter),
      toolDiscoveryTokensSaved: Math.max(0, this.toolDiscoveryTokensBefore - this.toolDiscoveryTokensAfter),
      cacheVolatilityFindings: this.cacheVolatilityFindings,
      recoveryExpansions: this.recoveryExpansions,
      sessionBlocks: this.sessionBlocks,
      dedupeCount: this.dedupeCount,
      staleErrorCount: this.staleErrorCount,
      providerFailures: this.providerFailures,
      providers: [...this.providers].sort()
    };
  }

  private async append(event: ModelProxyMetricEvent): Promise<void> {
    const root = safeJoin(this.workspaceRoot, '.utk', 'context-ir');
    await mkdir(root, { recursive: true });
    await appendFile(safeJoin(root, 'model-proxy.jsonl'), `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`, 'utf8');
  }
}

export function createMetricsStore(workspaceRoot: string): ModelProxyMetricsStore {
  return new ModelProxyMetricsStore(path.resolve(workspaceRoot));
}
