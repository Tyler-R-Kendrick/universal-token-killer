# Update Log

## 2026-07-03
* **Restructure**: Reorganized `docs/` into an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) v0.1 bundle — top-level `competition/`, `research/`, `techniques/`, `features/`, and `gaps.md`.
* **Frontmatter**: Added YAML frontmatter (`type` + `title`/`description`/`resource`/`tags`/`timestamp`) to every concept document.
* **Navigation**: Generated reserved `index.md` progressive-disclosure listings at each directory level and rewrote cross-links to bundle-relative absolute paths.
* **Rename**: Competitive dossiers → `/competition/<competitor>/research.md`; benchmark results → `parity-benchmark.md`; the four gap-analysis axes → `/techniques/` categories; category `README.md` → `overview.md`. History preserved via `git mv`.
* **Reclassify**: Research-paper dossiers moved out of `techniques/` into `research/` (the prompt-compression and model-routing method families, incl. routing-research, plus SkillReducer, Anka, TokenSugar). Cavekit and Cavemem moved under `competition/caveman/products/`. `techniques/` now holds only UTK's implementation axes. Added a linter rule binding each `type` to its area (`paper`→`research/`, `competitor`/`product`→`competition/`, `feature`/`reference`→`features/`).
