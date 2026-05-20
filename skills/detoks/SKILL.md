---
name: detoks
description: Use when local prompt or artifact compression is needed before sending bulky text, recovered artifacts, logs, diffs, reports, or tool output into an LLM context
---

# Detoks

Use the local `utk detoks-prompt` CLI flow for LLMLingua-2 prompt compression so bulky prompt text can stay in files or stdin instead of being pasted into agent context. Use the detok MCP server for explicit tool workflows over already-loaded text. This skill does not replace UTK raw artifact persistence, schema inference, routing, or recovery.

## Decision Rules

Use `detoks-prompt` CLI when:

- the target is a prompt, instruction block, or reusable skill/agent text;
- prompt text is large enough that pasting it into chat would waste context;
- prompt text may contain fenced code, inline code, Markdown blockquotes, or quoted requirements that must remain unchanged.

Use MCP `detok` when:

- text is large enough to crowd model context;
- the task needs gist-level reasoning over logs, diffs, markdown reports, or recovered raw artifacts;
- the user asks to simplify, compress, reduce tokens, detokenize, or rewrite input before reasoning;
- UTK already parsed templates/schemas and the next step would otherwise read a large text artifact into the LLM.

Do not use `detok` when:

- exact bytes, line numbers, patches, stack traces, legal text, or security evidence must remain verbatim;
- schema inference, template parsing, routing, or fact retention still needs raw content;
- the content is already compact enough to read directly;
- compression would hide facts the user explicitly asked to inspect.

The Copilot CLI `preToolUse` hook may run automatically for long, allowlisted prose fields such as `prompt`, `instructions`, `description`, `question`, `message`, `summary`, `notes`, or `body`. It must not rewrite commands, paths, patches, diffs, file contents, ids, or edit strings.

## Workflow

1. Preserve or locate the raw source first.
2. If the content comes from UTK, prefer raw artifacts for recovery and schema facts.
3. For prompt text, write or locate it in a file and run `node packages/cli/dist/utk.js detoks-prompt --file <path>`.
4. For piped prompt text, run `Get-Content <path> -Raw | node packages/cli/dist/utk.js detoks-prompt --stdin`.
5. Use MCP tool `detok` only for explicit LLM-bound reading copies where CLI file/stdin flow is not the right fit.
6. Use `rate: 0.33` by default; raise it for code, diffs, and dense technical output.
7. Keep force tokens such as newlines, punctuation, paths, and issue markers when structure matters.
8. State that reasoning used compressed text when final conclusions depend on compression.

## Reference

Read `references/detok-mcp.md` for tool arguments, examples, and common mistakes.
