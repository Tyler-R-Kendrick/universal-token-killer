# Init Report

End each initialization with a concise report that lets the user inspect what changed and what still needs real output evidence.

## Required Summary

Include:

- number of registered tools discovered;
- number initialized from observed output;
- number initialized from sample output;
- number initialized from existing fixtures;
- number initialized from descriptions only;
- number skipped and why.

## Tool Table

Use one row per tool:

| Tool | Source | Status | Schema | Serializer | Notes |
| --- | --- | --- | --- | --- | --- |
| `shell.git.diff` | sample | initialized | `.utk/tools/shell-git-diff/schema.id` | `toon` | sample-backed |
| `github.pull-request.list` | description | tentative | `.utk/tools/github-pull-request-list/output.current.schema.json` | `toon` | needs observed output |

## Required Checks

Before finalizing, verify:

- `.utk/config.toml` exists or was intentionally left unchanged;
- each initialized tool has `output.current.schema.json`;
- sample-backed or observed tools have an observation directory with raw and compact artifacts;
- route indexes exist for mediated tools;
- no raw payload is pasted into the final response.

## Final Wording

Use direct status language:

- "Initialized 8 tools: 5 observed, 2 sample-backed, 1 tentative."
- "Skipped 1 tool because its output is binary-only and no safe sample was provided."
- "The tentative schemas are usable for routing seeds but should be validated by the next observed Copilot hook event."
