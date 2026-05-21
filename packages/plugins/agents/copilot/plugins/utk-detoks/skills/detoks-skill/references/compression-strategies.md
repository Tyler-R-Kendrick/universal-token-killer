# Compression Strategies

## Root TOC Split

Keep root `SKILL.md` below 200-500 words when possible. It should contain trigger-worthy purpose, load map, and hard rules only. Move examples, branches, long policies, and background to `references/`.

## Detokenize References

Use compression only after preserving source. Acceptable passes:

- `node packages/cli/dist/utk.js detoks-prompt --file <path>` for prompt-safe prose compression;
- `detoks` LLMLingua2 for bulky prose;
- caveman prose for memory-like instructions;
- manual rewrite for high-risk instructions.

Never compress exact regions:

- fenced code blocks;
- inline code;
- commands;
- paths;
- URLs;
- YAML frontmatter;
- schema examples;
- security/legal evidence.

## Frontmatter Optimization

Do not rewrite Agent Skill frontmatter declarations. Discovery depends on exact `name` and `description` semantics. If frontmatter costs too many context tokens, generate a compact context shadow with `scripts/optimize-agent-frontmatter.ts`; keep `SKILL.md` declarations byte-for-byte identical.

## Skill-Preserving Rewrite

Keep:

- trigger semantics from frontmatter;
- required sequencing;
- safety boundaries;
- validation gates;
- filenames and tool names.

Drop:

- repeated explanations;
- generic rationale;
- multiple examples proving same pattern;
- prose that can become script arguments or validation checks.
