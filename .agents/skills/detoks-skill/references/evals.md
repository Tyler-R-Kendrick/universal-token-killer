# Evals

AgentEvals `EVAL.yaml` is canonical quality contract.

Required checks:

- `code_judge`: deterministic verifier loads source and optimized folders, then checks token ratio, byte-identical frontmatter declarations, reference links, and preservation invariants.
- `tool_trajectory`: expected sequence includes analyze, render, validate, eval.
- `execution_metrics`: optimized root must be smaller than source root and validation must pass.

Suggested scenarios:

- verbose skill with long workflow prose;
- skill containing fenced code block;
- skill containing paths, commands, URLs, and YAML frontmatter;
- deterministic numbered workflow that should become script candidate;
- unsafe output missing source code block, expected fail.

Pass criteria:

- source unchanged;
- companion generated;
- root `SKILL.md` concise;
- references carry details;
- script candidates identified;
- validation and AgentEvals green.
