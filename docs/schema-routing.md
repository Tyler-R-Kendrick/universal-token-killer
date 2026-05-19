# Schema Routing

UTK uses schemas to make compact tool-output handling repeatable across runs and tools.

## Schema Inference

For each output, UTK infers:

- primitive, array, and object schemas for structured values;
- text pseudo-schemas for plain text outputs;
- binary and stream envelopes for non-text output.

The current schema is written to `output.current.schema.json` and `output.current.toon`, with historical versions under `history/`.

## Rule Extraction

Rules are generic structural observations such as required fields, formats, ranges, cardinality, and opaque/free-text regions. UTK rejects command-specific or use-case-specific rules when generic structure is enough.

## Routing

Routing is deterministic first:

- current schema ids are indexed by tool;
- routes are stored per tool and globally in `.utk/routes/`;
- route confidence is included in the compact response.

If deterministic confidence is below the configured threshold and constrained routing is enabled, UTK can use the constrained decoder layer to select a route.
