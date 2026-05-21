# Detoks Prompt Reference

Use this for prompt, instruction, custom agent body, skill body, markdown report, recovered artifact, or other LLM-bound prose compression.

## CLI First

File input, preferred:

```powershell
node packages/cli/dist/utk.js detoks-prompt --file .\prompt.md
```

Pipe input:

```powershell
Get-Content .\prompt.md -Raw | node packages/cli/dist/utk.js detoks-prompt --stdin
```

Inline input, only for short prompts:

```powershell
node packages/cli/dist/utk.js detoks-prompt --prompt "Long prompt to simplify. `EXACT_TOKEN` must stay."
```

Use MCP `detoks-prompt` only when the workflow already has prompt text loaded and file/stdin flow is not practical. Use raw MCP `detok` for gist-level compression over logs, diffs, reports, or recovered artifacts, not for prompt text with protected spans.

## Preserve

`detoks-prompt` must preserve fenced code, indented code, inline code, Markdown blockquotes, frontmatter, tables, HTML/XML blocks, diffs, merge-conflict markers, stack traces, timestamped logs, lists, math, config/data literals, template placeholders, admonitions, definition lists, quoted strings, file paths, URLs/URIs, package names, model ids, hashes, resource ids, tool names, command names, API names, schema keys, HTTP transcripts, SQL statements, GraphQL operations, cron entries, CSV/TSV blocks, YAML object blocks, Dockerfile instructions, PEM/JWT/base64-like encoded material, network identifiers, CSS/XPath selectors, regular expressions, semver ranges, shell expansions, keyboard chords, menu paths, terminal prompts/ANSI sequences, VCS refs/ranges, and exact validation commands.

Do not compress:

- exact patches or diffs needed for application;
- legal, security, audit, or incident evidence;
- stack traces when line numbers matter;
- raw artifacts before UTK schema/template parsing;
- short text already cheap to read.

## Rates

- `0.25`: repetitive prose or logs.
- `0.33`: default for instructions, reports, issue text, and agent bodies.
- `0.50`: code-adjacent prose, tables, dense technical text.
- `0.70+`: high fact-retention need with modest token reduction.

## Output Contract

Keep compressed result as a working copy. Keep raw source as authority. If conclusions, edits, or follow-up prompts depend on compressed content, say compression was used.
