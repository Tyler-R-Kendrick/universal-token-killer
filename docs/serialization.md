# Serialization Providers

UTK separates raw persistence from compact serialization. Raw artifacts preserve the full tool output; compact artifacts are optimized for model context and routing summaries.

## `toon`

`toon` is the default provider and uses the official `@toon-format/toon` package.

```ts
import { encode, decode } from '@toon-format/toon';
```

The provider validates compact output by decoding the TOON text and comparing it against the expected canonical value.

## `compressed-json`

`compressed-json` emits deterministic minified JSON with stable key ordering. It is useful for tools or downstream consumers that prefer JSON over TOON.

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

These compact artifacts are intentionally structural. Required facts remain recoverable from `output.raw.*`.
