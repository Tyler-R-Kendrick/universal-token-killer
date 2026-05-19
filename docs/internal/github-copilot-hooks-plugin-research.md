# GitHub Copilot Hooks And Plugin Marketplace Research

This note records the source material used to validate UTK's Copilot hook and plugin packaging.

## Sources

- GitHub Docs, "Using hooks with GitHub Copilot CLI": hook files live in `.github/hooks/*.json` for repository scope and `~/.copilot/hooks/` for user scope.
- GitHub Docs, "GitHub Copilot hooks reference": hook configuration uses `version: 1` and a top-level `hooks` object.
- GitHub Docs, "GitHub Copilot hooks reference": command hook entries require `type: "command"` and at least one of `bash`, `powershell`, or `command`.
- GitHub Docs, "GitHub Copilot hooks reference": `preToolUse` can return `permissionDecision`, `permissionDecisionReason`, or `modifiedArgs`.
- GitHub Docs, "GitHub Copilot hooks reference": `preToolUse` emits camelCase `toolName`/`toolArgs`; PascalCase `PreToolUse` emits VS Code-compatible `tool_name`/`tool_input`.
- GitHub Docs, "GitHub Copilot CLI plugin reference": plugins can ship `hooks.json` or `hooks/hooks.json`; marketplaces use `.github/plugin/marketplace.json`.
- `github/awesome-copilot`: marketplace file is `.github/plugin/marketplace.json`; plugin manifests live under plugin directories; hook examples use the same `version: 1` plus top-level `hooks` object.

## UTK Implementation Decisions

- Repository hook: `.github/hooks/utk-detok-inputs.json` uses GitHub's command hook schema exactly.
- Plugin hook: `.github/plugins/universal-token-killer/hooks/hooks.json` uses the same schema and points to a plugin-local fail-open wrapper.
- Hook runner output: `processCopilotPreToolUsePayload` emits `{ "modifiedArgs": ... }` only when safe fields actually changed.
- Payload support: the runner accepts both official `preToolUse` camelCase payloads and VS Code-compatible `PreToolUse` snake_case payloads.
- Marketplace shape: `.github/plugin/marketplace.json`, plugin root `plugin.json`, mirrored `.github/plugin/plugin.json`, `agents/`, `skills/`, `.mcp.json`, and `hooks/hooks.json` are tested as package boundaries.
