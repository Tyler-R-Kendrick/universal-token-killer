# Workflow

1. Inspect source skill folder.
2. Compute token estimate per markdown file.
3. Preserve original source in place. Generate companion under explicit output path.
4. Rewrite companion root `SKILL.md` as short table of contents.
5. Move detailed workflow, edge cases, examples, and policy into `references/`.
6. Compress reference prose with `detoks-prompt` when installed; preserve code and quoted spans.
7. Detect deterministic processes and extract them into `scripts/*.ts`.
8. Run validation:
   - source skill still present;
   - optimized root has valid frontmatter copied exactly from source;
   - optimized root references all detail docs;
   - code blocks, commands, paths, URLs, and frontmatter are preserved;
   - optimized root token estimate is lower than source root token estimate.
9. Run AgentEvals `evals/EVAL.yaml`.
10. Report output path, token ratio, scripts created, eval status, unresolved risks.

## Output Shape

Use sibling companion by default:

```text
.agents/skills/<skill>/
.agents/skills/<skill>-detoks/
```

For packaged skills:

```text
skills/<skill>/
skills/<skill>-detoks/
```

Do not delete, rewrite, or move original skill unless user explicitly asks.
