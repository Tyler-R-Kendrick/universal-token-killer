# Implementation Guide

Use this guide when extending UTK without breaking the hook-first architecture.

## Add A New Hook Adapter

1. Parse the host hook payload.
2. Extract a stable `toolId`, input, and observable output.
3. Call `mediateToolExecution`.
4. Return the compact mediated response in the host's supported output field.
5. Return `undefined` or equivalent pass-through only for malformed, unobservable, or unsafe events.

## Add Or Use LLM-Bound Detok Compression

1. Preserve raw inputs and outputs first.
2. Parse templates and infer output schemas from raw content.
3. Apply `compressTextWithLlmlingua2` only after schema parsing when text is about to be sent to an LLM or read through the local `detok` MCP tool.
4. Keep compressed text in `input.detok.json`, `output.detok.txt`, or the MCP response; do not replace raw recovery artifacts.

## Add A Serialization Plugin

Built-in serializers are maintained plugin packs under `packages/plugins/serialization`. User serializers load from `.utk/plugins/serialization/<plugin-name>`, extra TOML plugin paths, or installed pack roots in `.utk/packs/<pack-name>`.

1. Create `utk.pack.toml` with `[pack]` metadata and a `[[plugins]]` entry whose `type = "serialization"` declares `id`, `module`, `grammar`, `extension`, optional `aliases`, and optional `config_fields`.
2. Store grammar at `grammar/<id>.lark`; it must include a `start:` rule.
3. Export `registerUtkSerializerPlugin(registry, context)` from the module.
4. Call `registry.register()` with `id`, `extension`, `grammar: context.grammar`, `serialize`, `deserialize`, `validate`, and `estimateTokens`.
5. Use `context.parser.parse(text, parserFn)` in deserialization or validation so the manifest grammar is part of the parser path.
6. Add TOML tests for default selection, overrides, disabled providers, plugin config fields, and invalid manifests.

## Add A Parity Scenario

1. Add the scenario name to `RTK_PARITY_EVALS`.
2. Add a fixture in `rtkParityFixtures.ts`.
3. Provide required facts that prove recovery, not just compression.
4. For CLI scenarios, set an RTK baseline and ensure UTK is strictly better.
5. Run the dedicated parity test and full repo gates.

## Add A Bash-Like Tool Template

1. Register the tool id, base command, and known positional/flag/option completions.
2. Use `completeBashLikeToolInvocation` from `@utk/core`.
3. Store the generated compact template and guidance grammar under `.utk/tools/<tool-id>/templates/`.
4. Add a fixture in `packages/evals/fixtures/bashRewriteFixtures.ts`.
5. Assert exact command/argv accuracy and token wins in `bash-rewrite-metrics.test.ts`.

## Add A Session Agent Or Session Skill Generator

1. Initialize the workspace with `initializeWorkspaceStore`.
2. For domain-specific repeated reasoning, use `upsertSessionAgent` and include a compact lexicon.
3. For repeated procedural work, use `upsertSessionSkill` and keep the root `SKILL.md` concise.
4. Keep generated content under `.utk/session-agents` or `.utk/session-skills`.
5. Do not overwrite existing concrete `.github/agents` or `.agents/skills` directories.

## Required Gates

```bash
npm run typecheck
npm run build
npm test
npm run coverage
```

Keep coverage at 100% and keep all public behavior covered by deterministic tests.
