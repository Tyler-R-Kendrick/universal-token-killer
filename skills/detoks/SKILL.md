---
name: detoks
description: Use when local LLMLingua2 prompt compression is needed through the detok MCP server, especially before sending bulky text, recovered artifacts, logs, diffs, reports, or tool output into an LLM context
---

# Detoks

Use the local `detok` MCP server to rewrite bulky LLM-bound text with LLMLingua-2. This skill is about when and how to use the MCP helper and the automatic Copilot pre-tool input hook; it does not replace UTK raw artifact persistence, schema inference, routing, or recovery.

## Decision Rules

Use `detok` when:

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
3. Call MCP tool `detok` only for the LLM-bound reading copy.
4. Use `rate: 0.33` by default; raise it for code, diffs, and dense technical output.
5. Keep force tokens such as newlines, punctuation, paths, and issue markers when structure matters.
6. State that reasoning used compressed text when final conclusions depend on compression.

## Reference

Read `references/detok-mcp.md` for tool arguments, examples, and common mistakes.
