# Security And Privacy

UTK reduces model-visible payload exposure, but it deliberately preserves raw outputs locally for recovery.

## What Goes To Chat

The model-visible response contains:

- raw artifact path;
- schema id;
- serializer id;
- compact artifact path;
- route confidence;
- a statement that the full payload was omitted from chat context.

The raw payload itself is not included in the compact response.

## What Goes To Disk

Raw tool outputs are written under `.utk/tools/<tool-id>/observations/<run-id>/`. Treat `.utk/` as sensitive project-local state.

The default `.utk/.gitignore` excludes observation payloads, routing telemetry, traces, temp files, eval results, and raw output files.

## Pass-Through Safety

Copilot hook events pass through when UTK cannot observe enough data to mediate safely. This prevents UTK from inventing tool results or pretending unavailable data was optimized.

## Recommended Handling

- Do not commit `.utk/tools/*/observations/`.
- Open raw artifacts only when a full-fidelity recovery is necessary.
- Prefer compact artifacts for model-visible follow-up work.
- Keep serializer validation artifacts when diagnosing drift.
