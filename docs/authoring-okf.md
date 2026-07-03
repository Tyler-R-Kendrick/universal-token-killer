---
type: guide
title: Authoring the OKF Knowledge Bundle
description: How to add and edit docs so the docs/ bundle stays conformant with the Open Knowledge Format (OKF v0.1).
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
tags: [meta, okf, contributing]
timestamp: 2026-07-03T00:00:00Z
---
# Authoring the OKF Knowledge Bundle

`docs/` is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
(OKF v0.1) bundle: a directory of Markdown concepts, authored by people and agents,
readable by both. This guide is the repo-local convention layer on top of the spec.

## Bundle layout

| Area | Holds | Path pattern |
|---|---|---|
| Features | Shipped project/product docs | `docs/features/<feature>/*.md` |
| Competition | Competitor & product dossiers | `docs/competition/<competitor>/*.md`, `.../products/<product>/*.md` |
| Research | Academic articles / evaluations | `docs/research/<article>/*.md` |
| Techniques | Technique taxonomy (the four gap-analysis axes + research families) | `docs/techniques/<category>/<technique>.md` |
| Gaps | Whole-product analysis & comparisons | `docs/gaps.md` |

Techniques link out to the academic [research](/research/) and [competition](/competition/)
that implement them; competitions and research do not duplicate technique prose.

## Every concept needs frontmatter

A concept document is any `.md` that is not a reserved file. It **must** open with a
YAML frontmatter block:

```yaml
---
type: technique            # REQUIRED — the only field OKF requires
title: LLMLingua-2         # human display name
description: One sentence.  # single-sentence summary (used in index.md + previews)
resource: https://arxiv.org/abs/2403.12968   # canonical URI of the underlying asset
tags: [techniques, prompt-compression, internal]
timestamp: 2026-07-03T00:00:00Z              # ISO 8601, last meaningful change
---
```

`type` is the only hard requirement. `title`, `description`, `resource`, `tags`,
and `timestamp` are recommended and enforced as warnings. Types used in this bundle:
`feature`, `reference`, `guide`, `technique`, `category`, `survey`, `competitor`,
`product`, `benchmark`, `paper`, `analysis`, `plan`. Add new types freely — consumers
tolerate unknown types.

## Reserved files

- **`index.md`** — a directory listing for progressive disclosure. Contains **no
  frontmatter**, except the bundle-root `docs/index.md`, which may declare
  `okf_version: "0.1"`. Regenerate with `npm run docs:index`; do not hand-edit.
- **`log.md`** — append-only change history, newest first, ISO `## YYYY-MM-DD`
  date headings. Maintained by hand.

## Linking

Use **bundle-relative absolute** links that start with `/` (relative to `docs/`):

```markdown
[the gap analysis](/gaps.md)
[RouteLLM](/techniques/model-routing/pre-call-routing/routellm.md)
```

Links are directed, untyped edges; consumers tolerate broken links, but the linter
flags them so keep them live.

## Naming

Lowercase kebab-case files and directories. The folder carries the entity, so files
are role-named inside it: `research.md`, `parity-benchmark.md`, `overview.md` (a
category's prose), `<technique>.md` for technique leaves.

## Enforcement

OKF conformance is checked in four places:

- **npm** — `npm run lint:okf` (report) / `npm run lint:okf:strict` (warnings fail too).
- **git pre-commit** — `.githooks/pre-commit` lints staged `docs/**` (wired by
  `npm run prepare` → `git config core.hooksPath .githooks`).
- **CI** — `.github/workflows/okf-lint.yml` runs `--strict` on every PR touching docs.
- **agent hook** — `.claude/settings.json` runs the linter after any docs edit and
  feeds failures back to the agent.

## Adding a document — checklist

1. Put it in the right area with a kebab-case name.
2. Add frontmatter with a non-empty `type` (plus the recommended fields).
3. Use `/`-absolute links to other concepts.
4. `npm run docs:index` to refresh listings; add a `log.md` line if it's a notable change.
5. `npm run lint:okf:strict` to confirm it's clean.
