import { describe, expect, it } from 'vitest';
import { modelProxyCompetitiveFixtures } from '../fixtures/modelProxyCompetitiveFixtures.js';

describe('model proxy competitive fixtures', () => {
  it('covers competitor-inspired compression and recovery scenarios', () => {
    expect(modelProxyCompetitiveFixtures.map((fixture) => fixture.id)).toEqual([
      'compresr-large-tool-output',
      'headroom-structured-json-array',
      'kompress-natural-language-field',
      'cavegemma-protected-spans',
      'leanctx-context-pressure',
      'openslimedit-file-read-edit-loop',
      'prompt-system-surface',
      'prompt-ghcp-agent-definition',
      'prompt-agent-skill-pack',
      'prompt-verbose-tool-schema',
      'prompt-recovery-tool-injection',
      'compresr-history-compaction',
      'compresr-tool-discovery',
      'headroom-cache-aligner',
      'headroom-ccr-range-search',
      'leanctx-shell-patterns',
      'leanctx-artifact-proof-hash',
      'prompt-compression-agent-context-index',
      'gateway-session-block-compaction',
      'gateway-deferred-tool-discovery',
      'gateway-dedupe-repeated-tools',
      'gateway-purge-stale-errors',
      'gateway-context-proof',
      'gateway-provider-fail-open',
      'gateway-v3-replace-history',
      'gateway-v3-find-tool-loop',
      'gateway-v3-route-specific-compactors',
      'gateway-v3-stored-proof',
      'gateway-v3-durable-ledger'
    ]);

    for (const fixture of modelProxyCompetitiveFixtures) {
      expect(fixture.rawTokens).toBeGreaterThan(fixture.expectedCompactTokens);
      expect(fixture.requiredFacts.length).toBeGreaterThan(0);
      expect(fixture.mustRecover).toBe(true);
      expect(fixture.routeReason).toMatch(/tool-output|structured-json|natural-language|protected-spans|context-pressure|edit-loop|prompt-surface|tool-definition|recovery-tool|history-summary|tool-discovery|cache-volatility|artifact-recovery|build-log|context-proof|session-block|dedupe|stale-error|provider-error/);
    }
  });
});
