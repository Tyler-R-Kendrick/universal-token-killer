# Serialization Providers

UTK separates raw persistence from compact serialization. Raw artifacts preserve the full tool output; compact artifacts are optimized for model context and routing summaries.

## Built-In Serialization Plugins

UTK's built-in serializers are data-only packs. Core loads serialization plugins by scanning pack roots, reading `utk.pack.toml`, loading the plugin's `.lark` grammar, and generating trusted core parser, serializer, linter, and compatibility provider surfaces for the declared `json-value-v1` AST semantics. Serializer plugin folders are never imported or executed.

Maintained plugins live under:

- `packages/plugins/serialization/json-compact`
- `packages/plugins/serialization/toon`
- `packages/plugins/serialization/tron`

User plugins live under `.utk/plugins/serialization/<plugin-name>` by default, or can be installed as normal packs under `.utk/packs/<pack-name>`.

## `toon`

`toon` is the default provider. UTK's trusted codec emits and parses the TOON subset used for `json-value-v1` compact summaries.

## `json-compact`

`json-compact` emits deterministic minified JSON with stable key ordering. `compressed-json` remains a backward-compatible alias.

## `tron`

`tron` uses the trusted `json-value-v1` codec and exposes a TRON-focused Lark grammar through `getSerializerGrammar('tron')` so llguidance-aware callers can attach grammar sidecars without executable plugin code.

The grammar source lives at `packages/plugins/serialization/tron/grammar/tron.lark`.

## Third-Party Serializer Plugins

UTK auto-loads serializer plugin folders from `.utk/plugins/serialization/<plugin-name>`. Add more roots with:

```toml
[plugins]
serialization_paths = [".utk/plugins/serialization", "vendor/utk-serializers"]
```

Each plugin pack needs only `utk.pack.toml` and a Lark grammar. The grammar targets `SerializationAst`, a JSON-compatible tree:

```ts
type SerializationAst = null | boolean | number | string | SerializationAst[] | { [key: string]: SerializationAst };
```

```toml
[pack]
name = "example"
version = "1.0.0"

[[plugins]]
type = "serialization"
id = "example"
symbol = "EXAMPLE_SERIALIZER"
semantics = "json-value-v1"
grammar = "grammar/example.lark"
extension = "example"
canonical = true

[plugins.config_fields.prefix]
type = "string"
default = ""
```

The package index must export a data-only const matching the manifest symbol and id:

```ts
export const EXAMPLE_SERIALIZER = 'example' as const;
```

The grammar file must be valid `.lark` with a `start:` rule. `module` is invalid for serialization plugins; executable serializer hooks are not supported. Core reads the index source text to verify the const export, but does not import it.

## Generated Runtime Surface

Loaded registries expose generated artifacts through the stable serializer id const:

```ts
import { TOON_SERIALIZER } from '@utk/serializer-toon';

const registry = await loadSerializationRegistry(workspaceRoot);
const toon = registry.serializers[TOON_SERIALIZER];

const ast = toon.parser.parse(text);
const canonical = toon.serializer.serialize(ast);
const lint = toon.linter.lint(text);
```

`linter.lint(text)` returns `{ valid, ast?, diagnostics, regenerated?, feedback? }`. Diagnostics include `code`, `severity`, `message`, and optional `path`, `span`, `expected`, and `actual` fields. `linter.lintAst(value)` checks `json-value-v1` compatibility before serialization, including non-finite numbers, `undefined`, functions, symbols, bigint, and non-plain objects.

Plugin loading reads local grammar files but does not execute local plugin code. Treat `.utk/plugins/serialization` and installed `.utk/packs` write access as the grammar trust boundary.

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
