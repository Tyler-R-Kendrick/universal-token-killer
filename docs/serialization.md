# Serialization Providers

UTK separates raw persistence from compact serialization. Raw artifacts preserve the full tool output; compact artifacts are optimized for model context and routing summaries.

## Built-In Serializer Plugins

UTK's built-in serializers use the same `registerUtkSerializerPlugin(registry)` contract as third-party packages. The registry core validates providers and loads plugins; serializer implementation code lives in plugin modules.

## `toon`

`toon` is the default provider and uses the official `@toon-format/toon` package.

```ts
import { encode, decode } from '@toon-format/toon';
```

The provider validates compact output by decoding the TOON text and comparing it against the expected canonical value.

## `compressed-json`

`compressed-json` emits deterministic minified JSON with stable key ordering. It is useful for tools or downstream consumers that prefer JSON over TOON.

## `tron`

`tron` uses the official `@tron-format/tron` package.

```ts
import { TRON } from '@tron-format/tron';
```

The provider validates compact output by parsing the TRON text and comparing it against the expected canonical value. It also exposes a TRON-focused Lark grammar through `getSerializerGrammar('tron')` so llguidance-aware callers can attach grammar sidecars without replacing the official parser.

The grammar source lives at `packages/core/grammars/tron.lark`.

## Third-Party Serializer Plugins

UTK auto-loads installed serializer plugins from the workspace package manifest when their package name matches `utk-serializer-*` or `@utk/serializer-*`. A plugin must export `registerUtkSerializerPlugin(registry)` and call `registry.register(provider)`.

```ts
export function registerUtkSerializerPlugin(registry) {
  registry.register({
    id: 'example',
    extension: 'example',
    serialize(value) {
      return JSON.stringify(value);
    },
    deserialize(text) {
      return JSON.parse(text);
    },
    validate() {
      return { valid: true, errors: [] };
    },
    estimateTokens(text) {
      return Math.ceil(text.length / 4);
    }
  });
}
```

Plugin loading executes installed package code. Treat package installation as the trust boundary.

## Compact Summary Shape

Tool outputs are compacted before serialization:

- text: `{ k: "text", l: <lineCount>, c: <charCount> }`
- arrays: `{ k: "array", n: <length> }`
- objects: `{ k: "object", keys: [...] }`
- primitives: `{ k: <type> }`

The exact raw output remains recoverable from the raw artifact path in the response.

This current compact shape is intentionally structural. It keeps model-visible
responses very small and pushes full-fidelity recovery to `.utk/` artifacts.
Fact-retention tests therefore check both compact metadata and recoverability
from raw artifacts instead of requiring every fact to appear inline.

## Example Compact Artifacts

Text output:

```toon
k: text
l: 4
c: 104
```

Object output:

```toon
k: object
keys[2]: diagnostics,result
```

Compressed JSON for the same object summary:

```json
{"k":"object","keys":["diagnostics","result"]}
```

TRON for the same object summary:

```text
{"k":"object","keys":["diagnostics","result"]}
```

These compact artifacts are intentionally structural. Required facts remain recoverable from `output.raw.*`.
