# Tool Discovery

Discover registered tools before generating schemas. Prefer project-owned declarations over inferred names.

## Search Order

1. Existing UTK state:
   - `.utk/config.toml`
   - `.utk/tools/*/manifest.json`
   - `.utk/routes/index.json`
2. Copilot hook or tool registries:
   - hook adapter descriptors
   - tool manifest files
   - files containing `toolId`, `tool_name`, `tools`, `registeredTools`, or `registerTool`
3. Agent skill descriptors:
   - `skills/*/SKILL.md`
   - `skills/*/references/*.md`
   - skill metadata that names tool ids or hook behavior
4. Package exports and tests:
   - adapters that call `mediateToolExecution`
   - fixtures that define tool ids and representative outputs

Use `rg` first. Useful queries:

```bash
rg -n "toolId|tool_name|registeredTools|registerTool|mediateToolExecution|processCopilotToolHookPayload" .
rg -n "shell\\.|github\\.|linear\\.|tool-output|tool output|hook" skills docs packages
```

## Registration Record

Build a working record for each discovered tool:

```ts
type InitToolRecord = {
  id: string;
  source: 'registry' | 'utk-existing' | 'agent-skill' | 'fixture' | 'user-hint';
  description?: string;
  sampleInput?: unknown;
  sampleOutput?: unknown;
  serializerOverride?: string;
};
```

## Discovery Rules

- Do not treat every shell command string as a new tool. Use stable tool ids such as `shell.git.diff`.
- Do not duplicate a tool when the same id appears in multiple sources; merge descriptions and samples.
- Keep shell and non-shell tools in the same registry.
- If the project has no explicit registry, use fixtures and hook adapter tests as the evidence source, then report that registration should be made explicit.
