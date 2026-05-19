# Detok MCP Server

`detok` is a local stdio MCP server that rewrites LLM-bound text with LLMLingua-2 before the text is sent to a model. It is intentionally local: text is passed to the Python `llmlingua` package running in the workspace environment.

## Install

Install the Python compressor dependency:

```bash
python -m pip install -r requirements-detok.txt
```

Install Node workspace dependencies and build the server:

```bash
npm install
npm run build
```

## VS Code And GitHub Copilot

The workspace registers the server by default in `.vscode/mcp.json`:

```json
{
  "servers": {
    "detok": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/packages/detok-mcp/dist/server.js"]
    }
  }
}
```

VS Code reads workspace MCP configuration from `.vscode/mcp.json`. After building, Copilot can call the `detok` tool.

The MCP server is packaged as private workspace package `@utk/detok-mcp`. Its
`detok-mcp` bin is for local MCP stdio registration, not a public UTK CLI.

UTK also ships an automatic GitHub Copilot CLI `preToolUse` hook for safe tool-input rewriting. That hook is separate from the MCP server:

- MCP `detok` is an explicit tool call for an agent or user workflow.
- The Copilot hook runs before tool execution and can return `modifiedArgs`.
- The hook only rewrites allowlisted long prose fields and leaves operational fields untouched.
- GitHub's `userPromptSubmitted` hook can observe prompts but cannot replace the submitted prompt, so UTK does not use it for prompt rewriting.

The repo hook is `.github/hooks/utk-detok-inputs.json`; the plugin hook is `.github/plugins/universal-token-killer/hooks/hooks.json`. Enable one registration path per workspace to avoid double compression.

## Tool

Tool name: `detok`

Input:

```json
{
  "text": "Long text to simplify before sending to an LLM.",
  "rate": 0.33,
  "targetToken": 256,
  "forceTokens": ["\n", "?", ":"]
}
```

Output:

```json
{
  "compressedText": "Long text simplify before sending LLM.",
  "originalTokens": 12,
  "compressedTokens": 7,
  "rate": 0.33,
  "model": "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
  "usedLlmlingua2": true,
  "applied": true
}
```

## UTK Integration

UTK also uses the same local compressor for LLM-bound mediation artifacts:

- input text is preserved raw in `input.json` and, when compression applies, rewritten to `input.detok.json`;
- raw tool output is persisted and parsed for schema/template inference first;
- after schema parsing, text output is compressed into `output.detok.txt` plus `output.detok.json` metadata before any LLM-bound file-reading flow needs the content.

Short and medium strings are skipped by default during automatic mediation to avoid unnecessary compressor startup overhead. MCP calls force compression because the user explicitly requested the tool.

## Environment

- `UTK_WORKSPACE_ROOT` points the MCP server or hook wrapper at the active workspace.
- `UTK_DETOK_PYTHON` can select a Python executable for `scripts/llmlingua2_compress.py`.
- `UTK_LLMLINGUA_MODEL` documents the intended LLMLingua-2 model in workspace MCP config.
