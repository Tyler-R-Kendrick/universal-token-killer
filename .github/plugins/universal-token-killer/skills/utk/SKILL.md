---
name: utk
description: Use when installing, operating, recovering, or extending Universal Token Killer for GitHub Copilot tool-hook mediation, .utk artifacts, serializer configuration, schema routing, compact tool-output recovery, or RTK-parity token optimization
---

# UTK Tool-Hook Compression

Use this skill when installing, operating, or recovering Universal Token Killer (UTK) for GitHub Copilot tool-hook mediation.

UTK is hook-first. Do not expose mediation as a public CLI or VS Code extension. It observes shell and non-shell tool calls when the Copilot hook event includes enough input/output to mediate safely, persists raw artifacts under `.utk/`, infers schemas, routes by schema history, and returns compact references. The local `detok` MCP helper is only for LLMLingua-2 text rewriting.

## References

- `references/copilot-hooks.md`: hook event handling and pass-through rules.
- `references/configuration.md`: `.utk/config.toml` serializer and routing settings.
- `references/artifact-recovery.md`: raw output, compact serialization, schema, and route artifact locations.
- `references/schema-route-summaries.md`: schema routing and constrained fallback summary.
