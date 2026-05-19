# Schema And Route Summaries

UTK infers output schemas from observed tool results, extracts generic structural rules, and records schema history per tool. Schema ids use the normalized tool id, version, and a short content hash.

Routing is deterministic first. If confidence is below `.utk/config.toml` thresholds and constrained routing is enabled, UTK can use `guidance-ts` grammar-constrained selection. Missing Guidance session configuration must be reported as unavailable rather than treated as a successful route.

All schema and route summaries are generalized. Do not add command-specific, provider-specific, or use-case-specific rules when a structural rule can describe the behavior.
