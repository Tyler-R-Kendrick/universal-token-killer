# Techniques

The map over UTK’s token-optimization technique tree: prompt compression, model routing, output compression, and tool-schema reduction are complementary sinks, not substitutes.

## Subcategories

* [Assistant-Prose Compression](/techniques/assistant-prose-compression/overview.md) - Output-side compression of the agent’s own prose, tool output, and skill text — the compounding agent-native sink UTK owns (Caveman, SkillReducer).
* [Code-Authoring Minification](/techniques/code-authoring-minification/) - Deterministic minification of code UTK itself emits — declare-before-use min-maps, derived min-grammars, a YAGNI decision ladder, and code-graph reuse.
* [Context-Gateway Proxy](/techniques/context-gateway-proxy/) - The @utk/model-proxy layer — compact repeated history, tool schemas, and context before they reach the upstream provider, and route models cost-aware.
* [Tool-Output Mediation](/techniques/tool-output-mediation/overview.md) - UTK's core axis — evict raw tool payloads to recoverable .utk/ references and return compact, schema-routed, serialized responses to the model.

## Documents

* [Token-Optimization Taxonomy (Sinks, Not Substitutes)](/techniques/overview.md) - The map over UTK’s token-optimization technique tree: prompt compression, model routing, output compression, and tool-schema reduction are complementary sinks, not substitutes.
* [Token-Optimization Landscape Watchlist](/techniques/landscape-watchlist.md) - Breadth-first survey of 40+ token-optimization techniques with an adopt/borrow/reference-only ranking for UTK.
