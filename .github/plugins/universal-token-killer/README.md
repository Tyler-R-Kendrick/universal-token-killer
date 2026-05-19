# Universal Token Killer Copilot Plugin

This plugin exposes UTK to GitHub Copilot CLI using the official plugin marketplace layout:

- `agents/`: UTK operator custom agent.
- `skills/`: `utk`, `utk-init`, and `detoks` Agent Skills.
- `.mcp.json`: local `detok` MCP server configuration.
- `hooks/hooks.json`: Copilot CLI `preToolUse` hook for safe LLMLingua rewriting of long LLM-bound tool input fields.

The hook file uses GitHub's `version: 1` contract:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "command": "node hooks/detokPreToolUseHook.js",
        "cwd": ".",
        "timeoutSec": 30
      }
    ]
  }
}
```

The wrapper script is deliberately fail-open: if it cannot find a built UTK hook runner in the active workspace or plugin dependencies, it emits `{}` so Copilot continues the tool call unchanged.

## Install

From this repository:

```bash
copilot plugin marketplace add .
copilot plugin install universal-token-killer@universal-token-killer
```

For local development, reinstall after edits because Copilot caches plugin content:

```bash
copilot plugin install ./.github/plugins/universal-token-killer
```

The `detok` MCP server expects the UTK workspace to be built:

```bash
python -m pip install -r requirements-detok.txt
npm install
npm run build
```

The repository also includes `.github/hooks/utk-detok-inputs.json` for repo-local hook registration. Use either the repo hook or the plugin hook in a workspace, not both, to avoid double compression.
