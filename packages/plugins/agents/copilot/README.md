# GitHub Copilot Agent Plugins

This folder owns all GitHub Copilot-specific UTK implementation:

- `src/`: Copilot hook payload adapter and fail-open detok preToolUse runner.
- `hooks/`: repo-local Copilot hook config samples.
- `plugins/utk-cli`: UTK CLI operator agent plus `utk` and `utk-init` skills.
- `plugins/utk-model-proxy`: model-proxy agent and skill.
- `plugins/utk-detoks`: detoks skills, local MCP config, and Copilot preToolUse hook wrapper.

The repository marketplace is `.github/plugin/marketplace.json`; it points to the focused plugin roots under `packages/plugins/agents/copilot/plugins`.

Install from this repository:

```bash
copilot plugin marketplace add .
copilot plugin install utk-cli@universal-token-killer
copilot plugin install utk-model-proxy@universal-token-killer
copilot plugin install utk-detoks@universal-token-killer
```

For local development, reinstall a plugin by path after edits:

```bash
copilot plugin install ./packages/plugins/agents/copilot/plugins/utk-detoks
```

The detok hook wrapper is deliberately fail-open. If it cannot find a built UTK hook runner, it emits `{}` so Copilot continues the tool call unchanged.
