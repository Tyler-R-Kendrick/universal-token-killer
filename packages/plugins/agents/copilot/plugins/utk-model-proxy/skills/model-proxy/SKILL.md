---
name: model-proxy
description: Use when configuring, testing, or documenting UTK model-proxy behavior for GitHub Copilot context optimization.
---

# UTK Model Proxy

Use this skill for Copilot-specific model-proxy setup, policy, and verification.

## Focus

- `.utk/config.toml` `[model_proxy]`
- `packages/model-proxy`
- context proofs
- deferred tool search
- history compaction
- protected fields, protected tools, and deny tools
- benchmark evidence for relevance, correctness, groundedness, and savings

## Commands

```bash
npm run typecheck
npm test --workspace @utk/model-proxy
```

Keep detok MCP and hook instructions in the `utk-detoks` plugin.
