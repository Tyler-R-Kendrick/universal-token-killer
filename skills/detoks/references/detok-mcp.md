# Detok MCP Reference

The local MCP server is registered in `.vscode/mcp.json` as `detok` and exposes one tool named `detok`.

UTK also includes a GitHub Copilot CLI `preToolUse` hook that can rewrite safe, LLM-bound tool input fields before execution. It returns `modifiedArgs` only when LLMLingua changes an allowlisted field. This is not the same as the MCP tool:

- MCP use is explicit and user/agent initiated.
- The hook is automatic when registered through `.github/hooks/utk-detok-inputs.json` or the plugin `hooks/hooks.json`.
- GitHub Copilot does not expose a prompt-replacement output for `userPromptSubmitted`, so the hook targets tool arguments, not raw user prompts.
- Enable only one repo/plugin registration path per workspace to avoid double compression.

## Tool Call Shape

```json
{
  "text": "Long text to simplify before sending to an LLM.",
  "rate": 0.33,
  "targetToken": 256,
  "forceTokens": ["\n", "?", ":", "/", "\\"]
}
```

Expected response:

```json
{
  "compressedText": "Simplified text returned by LLMLingua2.",
  "originalTokens": 1200,
  "compressedTokens": 410,
  "rate": 0.33,
  "model": "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
  "usedLlmlingua2": true,
  "applied": true
}
```

## Rates

- `0.25`: aggressive summaries for repetitive logs or prose.
- `0.33`: default for general reports, issue text, and chat-sized artifacts.
- `0.50`: safer for code-adjacent output, diffs, stack traces, and tabular data.
- `0.70+`: use when fact loss would be costly but token reduction is still useful.

## Structure Preservation

Use `forceTokens` when structure matters:

- newlines for logs, diffs, stack traces, and tables;
- `/`, `\\`, `.`, and `:` for paths and file references;
- `#`, `@`, and `-` for issue ids, handles, flags, and bullets;
- `?` when questions or prompts are being compressed.

## Common Mistakes

- Do not paste raw large artifacts into chat before compression.
- Do not use compressed text to regenerate exact patches.
- Do not treat compressed text as the recovery source; raw `.utk/` artifacts remain authoritative.
- Do not compress before UTK has parsed schemas/templates when the raw shape still matters.
- Do not configure the pre-tool hook to rewrite operational fields such as commands, paths, patches, diffs, file contents, ids, or edit strings.
