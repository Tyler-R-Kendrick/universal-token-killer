# Detoks Skill Reference

Use this when consolidating `detoks-skill` content into `detoks`, compressing agent skills, or refactoring repeated instructions into skill references.

## Consolidation

Keep one discoverable skill named `detoks`. Do not create a sibling `detoks-skill` folder. Move skill-specific operating detail into `skills/detoks/references/detoks-skill.md`; keep root `SKILL.md` as router.

Required shape:

```text
skills/detoks/
├── SKILL.md
├── agents/openai.yaml
└── references/
    ├── detok-mcp.md
    ├── detoks-prompt.md
    ├── detoks-skill.md
    ├── detoks-agentsmd.md
    └── detoks-ghcp-subagent.md
```

## Skill Refactor Rules

1. Preserve YAML frontmatter with only `name` and `description` unless target format requires more.
2. Put trigger conditions in `description`, because only metadata is available before skill load.
3. Move long workflow variants into one-level `references/` files linked from `SKILL.md`.
4. Keep `SKILL.md` concise: route, core invariants, validation.
5. Remove duplicated old skill text after equivalent reference docs exist.
6. Keep plugin copies byte-for-byte synchronized with canonical `skills/`.

## Edge Cases

Preserve exact fenced snippets, markdown links, validation commands, quoted strings, Windows paths, and code-adjacent examples in `references/`. Do not let compressed or generated skill bodies:

- inject extra frontmatter delimiters or metadata keys from multiline descriptions;
- drop procedure steps when additional reference files exist;
- overwrite references whose filenames normalize to the same slug;
- omit a fallback trigger or procedure when extracted skill profiles are sparse;
- count only unique trigger names when repeated chat evidence shows reuse;
- emit non-spec skill names with underscores or punctuation;
- ship descriptions that omit `Use when`;
- let long descriptions bloat frontmatter instead of moving detail into references;
- match triggers as substrings inside unrelated words;
- lose generated procedure text when a custom `procedure.md` reference exists;
- write empty custom references with no fallback text;
- write traversal or Windows-reserved reference filenames;
- inline every long procedure step into `SKILL.md`;
- repeat duplicate trigger lines in the skill preview;
- render reference lists in unstable order;
- leave unsafe YAML scalars unquoted;
- add non-`name`/`description` fields to skill frontmatter;
- omit a scannable heading after frontmatter;
- hide required sub-skill references from the root skill;
- strip plugin namespace separators from required skill names;
- render empty optional sections for blank required skills, mistakes, or eval scenarios;
- omit "do not use when" boundaries for skill selection;
- duplicate selection-boundary bullets case-insensitively;
- bloat `SKILL.md` with common mistakes or eval scenarios instead of reference files;
- inline fenced blocks, tables, or admonitions in the root procedure preview;
- leave stale reference files after regenerating a skill;
- preserve control characters in metadata;
- allow path-like names to escape `.utk/session-skills`;
- double-render existing bullet or numbering markers in previews;
- count overlapping trigger phrases twice when one mention matched a longer trigger.

## Compression Use

Run `detoks-prompt` on large skill bodies or old instruction dumps before rewriting. Do not compress exact code examples, command snippets, YAML frontmatter, or file trees. Compress surrounding prose only.

## Validation

Run the repo skill/package checks that exist in the workspace. For this repo, use:

```powershell
npx skills add . --list
npm test -- --run packages/core/test/packageBoundary.test.ts
```

Run broader `npm run typecheck`, `npm run build`, or `npm test` when edits touch code, packaging, or manifests.
