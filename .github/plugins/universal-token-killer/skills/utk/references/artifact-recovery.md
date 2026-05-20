# Artifact Recovery

UTK stores artifacts under `.utk/` inside the workspace.

Raw outputs live below:

```text
.utk/tools/<tool-id>/observations/<run-id>/output.raw.json
.utk/tools/<tool-id>/observations/<run-id>/output.raw.txt
.utk/tools/<tool-id>/observations/<run-id>/output.raw.bin
```

Compact serialized outputs live beside the raw file as `output.compact.toon`, `output.compact.json`, `output.compact.tron`, or a plugin extension, with `output.compact.validation.json` recording drift validation.

Schema and routing artifacts are stored in:

```text
.utk/tools/<tool-id>/output.current.schema.json
.utk/tools/<tool-id>/output.current.toon
.utk/tools/<tool-id>/history/*.schema.json
.utk/tools/<tool-id>/route.json
.utk/tools/<tool-id>/route.toon
.utk/routes/index.json
.utk/routes/index.toon
```

Use the compact response path first for review. Open the raw artifact only when full fidelity recovery is necessary.
