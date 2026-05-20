# Script Extraction

Convert prose to `scripts/*.ts` when workflow is deterministic, repeated, or validation-heavy.

Good script candidates:

- token counting;
- file inventory;
- frontmatter validation;
- reference link checks;
- copy/sync operations;
- preservation checks for code blocks, paths, URLs, commands;
- scoring candidate rewrites.

Keep prose when judgment is central:

- choosing what matters to user;
- deciding compression aggressiveness;
- interpreting ambiguous policy;
- explaining tradeoffs.

## Evolution Backends

`evolve-candidates.ts` must use a real optimization framework:

- Microsoft Trace via Python package `trace-opt` (`from opto import trace`);
- Agent Lightning via Python package `agentlightning`.

Use Trace for prompt/procedure/code-string optimization with feedback. Use Agent Lightning when optimizing from trajectory/span style rollouts or when a trainer/store workflow already exists. If framework packages are missing, fail with install commands instead of silently using a fake optimizer.
