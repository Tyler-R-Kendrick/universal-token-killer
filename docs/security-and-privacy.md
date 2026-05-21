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

The local `detok` MCP server and automatic `preToolUse` hook use workspace-local
LLMLingua-2 execution. They still process the text you give them, so treat
compressed detok copies as derived sensitive data unless the source was public.

## Pass-Through Safety

Copilot hook events pass through when UTK cannot observe enough data to mediate safely. This prevents UTK from inventing tool results or pretending unavailable data was optimized.

The `preToolUse` detok hook is conservative because it can change actual tool
arguments. By default it rewrites only long prose fields and leaves commands,
paths, URLs, globs, regexes, file contents, patches, diffs, old/new edit
strings, cwd, env, and ids unchanged.

Generated session agents and skills are written under `.utk/` and linked into
host discovery folders only when those folders do not already exist as concrete
directories. UTK should not overwrite hand-maintained `.github/agents` or
`.agents/skills` folders.

## Recommended Handling

- Do not commit `.utk/tools/*/observations/`.
- Open raw artifacts only when a full-fidelity recovery is necessary.
- Prefer compact artifacts for model-visible follow-up work.
- Keep serializer validation artifacts when diagnosing drift.
- Review generated session agents and skills before relying on them in a new
  workspace.
- Enable either the Copilot hook sample under
  `packages/plugins/agents/copilot/hooks/` or the `utk-detoks` plugin hook in a
  workspace, not both, to avoid double compression.
