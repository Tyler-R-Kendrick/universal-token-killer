---
okf_version: "0.1"
title: UTK Knowledge Bundle
description: Open Knowledge Format bundle for the Universal Token Killer project — features, competition, research, techniques, and gap analysis.
---

# UTK Knowledge Bundle

An [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) (OKF v0.1) bundle. Each concept is a Markdown file with YAML frontmatter; directories carry an `index.md` for progressive disclosure and a `log.md` for change history. See [authoring-okf.md](/authoring-okf.md) to add or edit docs.

## Areas

* [Competition](/competition/)
* [Features](/features/)
* [Research](/research/)
* [Techniques](/techniques/) - The map over UTK’s token-optimization technique tree: prompt compression, model routing, output compression, and tool-schema reduction are complementary sinks, not substitutes.

## Documents

* [Authoring the OKF Knowledge Bundle](/authoring-okf.md) - How to add and edit docs so the docs/ bundle stays conformant with the Open Knowledge Format (OKF v0.1).
* [Optimization vs. Competitor Gap Analysis](/gaps.md) - A synthesis layer over the two existing competitive docs, answering one question they do not answer directly: taking UTK's actually-shipped optimizations, where does each stand against the nearest…
