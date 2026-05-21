# Serialization Providers

UTK separates raw persistence from compact serialization. Raw artifacts preserve the full tool output; compact artifacts are optimized for model context and routing summaries.

## Built-In Serialization Plugins

UTK's built-in serializers are packs. Core loads serialization plugins by scanning pack roots, reading `utk.pack.toml`, loading the plugin's `.lark` grammar, generating a grammar-backed parser wrapper, and passing that parser to the plugin registrar.

Maintained plugins live under:

- `packages/plugins/serialization/json-compact`
- `packages/plugins/serialization/toon`
- `packages/plugins/serialization/tron`

User plugins live under `.utk/plugins/serialization/<plugin-name>` by default, or can be installed as normal packs under `.utk/packs/<pack-name>`.

## `toon`

`toon` is the default provider and uses the official `@toon-format/toon` package.

```ts
import { encode, decode } from '@toon-format/toon';
```

The provider validates compact output by decoding the TOON text and comparing it against the expected canonical value.

## `json-compact`

`json-compact` emits deterministic minified JSON with stable key ordering. `compressed-json` remains a backward-compatible alias.

## `tron`

`tron` uses the official `@tron-format/tron` package.

```ts
import { TRON } from '@tron-format/tron';
```

The provider validates compact output by parsing the TRON text and comparing it against the expected canonical value. It exposes a TRON-focused Lark grammar through `getSerializerGrammar('tron')` so llguidance-aware callers can attach grammar sidecars without replacing the official parser.

The grammar source lives at `packages/plugins/serialization/tron/grammar/tron.lark`.

## Third-Party Serializer Plugins

UTK auto-loads serializer plugin folders from `.utk/plugins/serialization/<plugin-name>`. Add more roots with:

```toml
[plugins]
serialization_paths = [".utk/plugins/serialization", "vendor/utk-serializers"]
```

Each plugin pack needs `utk.pack.toml`, a Lark grammar, and a module exporting `registerUtkSerializerPlugin(registry, context)`.

```toml
[pack]
name = "example"
version = "1.0.0"

[[plugins]]
type = "serialization"
id = "example"
module = "index.js"
grammar = "grammar/example.lark"
extension = "example"

[plugins.config_fields.prefix]
type = "string"
default = ""
```

The grammar file must be valid `.lark` with a `start:` rule.

```ts
export function registerUtkSerializerPlugin(registry, context) {
  registry.register({
    id: 'example',
    extension: 'example',
    grammar: context.grammar,
    serialize(value) {
      return JSON.stringify(value);
    },
    deserialize(text) {
      return context.parser.parse(text, (body) => JSON.parse(body));
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

Plugin loading executes local plugin code. Treat `.utk/plugins/serialization` and installed `.utk/packs` write access as the trust boundary.

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

JSON Compact for the same object summary:

```json
{"k":"object","keys":["diagnostics","result"]}
```

TRON for the same object summary:

```text
{"k":"object","keys":["diagnostics","result"]}
```

These compact artifacts are intentionally structural. Required facts remain recoverable from `output.raw.*`.
