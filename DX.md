# DX — universal-token-killer (UTK)

Standard: the **Monorepo DX Playbook** (canonical in the `HoBo` repo → `docs/standards/monorepo-dx-playbook.md`,
`https://github.com/Tyler-R-Kendrick/HoBo/blob/main/docs/standards/monorepo-dx-playbook.md`).

## Current state
TS ESM **library + CLI + MCP** monorepo (~21 packages) — not a deployable web app. npm (**lockfile committed** ✓,
**not pinned**). **No JS linter at all** (`lint` = `tsc --noEmit` + a docs-only OKF markdown linter). Root `build` is a
hand-ordered 21-package `-w` list. Vitest with **100% coverage** thresholds. Git hook lints **only** `docs/*.md`.
**No CI at all.** Publishes to npm (currently unpublished).

## Adoption checklist (leverage order)
1. 🔥 **Add a real linter (Biome)** — there is *no* JS lint today. **[M]**
2. **Add Turborepo** — replace the fragile hand-ordered 21-package `build` list; run `--affected`. **[M]**
3. **Strengthen the git hook** — currently lints only `docs/*.md`; add staged code lint/format + an affected `pre-push`
   turbo gate. **[M]**
4. **Pin the toolchain**; add project references for incremental typecheck. **[S/M]**
5. **Workflows: none today.** If UTK **publishes to npm**, a **staged release workflow** (tag → build → publish with
   provenance) *is* a justified "staged deployment" (playbook §8 rule 1). Otherwise local hooks only. **[S]**

Keep the committed lockfile and the 100% coverage bar — both are already baseline-aligned.
