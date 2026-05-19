# Constrained Decoding

UTK uses `guidance-ts` for constrained route selection helpers. This replaces fake `llguidance` stubs with the real `guidance-ai/guidance-ts` package pinned in `package-lock.json`.

`guidance-ts` is also used to serialize grammar sidecars for bash-like tool
invocation templates and dynamic session-agent lexicons. Those helpers store
grammar artifacts locally and report unavailable when no live guidance session
is configured.

## Route Grammar

The constrained decoder builds a deterministic route grammar over candidate schema ids and route reasons:

```ts
const grammar = buildRouteGrammar([
  { schema: 'shell-git-diff.v1.abc123', confidence: 0.95, reason: 'tool_match' }
]);
```

The grammar can be serialized for tests and route diagnostics.

## Availability

Constrained generation requires an explicit Guidance session configuration. If no session is configured, UTK reports the route generator as unavailable. It does not fake success.

```ts
const result = await generateConstrainedRoute({
  grammar,
  prompt: 'select route'
});

// result.available === false
```

## Fallback

Deterministic routing remains the first path. Constrained routing is only used when enabled and needed by the routing threshold.

For non-routing helpers, the same principle applies: store the grammar, use
known deterministic completions when necessary, and never claim constrained
generation succeeded when the runtime was unavailable.
