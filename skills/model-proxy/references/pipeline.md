# Pipeline And Local-First Behavior

`@utk/model-proxy` forwards Chat Completions, Responses, and Models requests while reducing repeated context before it reaches the upstream provider.

Request flow:

```text
normalize -> resolve policy -> budget -> prompt optimize -> content route -> retention -> tool discovery -> artifact persist -> forward -> recover/retry
```

Default behavior is local-first:

- prompt and tool-output originals are stored under `.utk/model-proxy`;
- compact model-visible text carries `utk-ref` or `utk-prompt-ref` handles;
- high-pressure sessions replace eligible old history/tool spans with recoverable `[utk-block:<id>]` summary messages;
- deferred tool discovery can send only `utk_find_tool` plus recovery/protected tools, then retry once when the upstream requests a schema;
- model-backed prompt compression can intercept system, developer, and user prompts before the final upstream request;
- repeated and stale read-only tool outputs compact to handles while raw artifacts remain authoritative;
- cache-volatility detection is observe-only;
- remote compressors and model downloads are disabled by default.

Raw artifacts stay authoritative: compaction and dedupe only replace model-visible spans, never the stored originals.
