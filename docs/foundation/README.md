# Project Foundation Contract

This directory defines the canonical documentation package for an
RPGCreatorAI game project. It complements the executable project data under
`data/`; it does not replace or extend the runtime `data/project.json` schema.

## Canonical project documents

New projects store the files in a `game/` directory. The Tauri Project Wizard
copies the selected template from `templates/project/` (or
`templates/horror-bl/`) and keeps the runtime data under `data/`:

| File | Authority |
| --- | --- |
| `game/README.md` | Project entry point, status, ownership, and document map. |
| `game/GAME_DESIGN.md` | Player promise, pillars, loop, content, rules, scope, and acceptance criteria. |
| `game/GAME_STYLE.md` | Binding project-specific visual and sensory direction. |
| `game/TECHNICAL.md` | Runtime targets, data constraints, budgets, workflows, and release gates. |
| `game/ASSETS.md` | Asset inventory policy, licensing, attribution, generation provenance, and readiness. |

The Wizard also creates derived contracts at
`data/design/game-design.json`, `data/style/game-style.json`,
`data/technical/runtime-config.json`, and `data/assets/assets-manifest.json`.
They are machine-readable companions, never a substitute for the Markdown
source of truth.

When two project documents disagree, resolve them in this order:

1. Safety, legal, and license constraints in `ASSETS.md`.
2. Runtime and data constraints in `TECHNICAL.md`.
3. The player promise and mechanics in `GAME_DESIGN.md`.
4. Presentation choices in `GAME_STYLE.md`.
5. Summary text in the project `README.md`.

Repository-level engine constraints remain authoritative over every generated
project. In particular, `docs/GAME_VISUAL_DESIGN.md` governs supported
viewport, map, camera, tile, and runtime presentation behavior. A project's
`GAME_STYLE.md` specializes that contract for one game without weakening it.

## Machine-readable companion

`foundation-manifest.schema.json` describes a small, optional project-root
`foundation-manifest.json`. The manifest is an index and review record for
the Markdown documents. It intentionally contains no secrets, full prompts,
binary asset metadata, or runtime state.

Use `foundation-manifest.example.json` as the canonical example. Paths are
project-relative, use forward slashes, and must stay inside the project root.
The engine and editor do not currently require or load this optional manifest;
the Wizard's `game/template.json` records the selected built-in template.
Tooling may adopt the richer foundation manifest later without changing
runtime behavior.

## Provenance boundary

The documentation package records why a style or asset was chosen and where
its references came from. Runtime-facing asset metadata remains in
`data/assets/catalog.json`; generation history remains in
`data/project.json`; credentials remain outside project data. Never put API
keys, access tokens, private provider responses, or personal information in
these documents or in the manifest.

For every external, imported, commissioned, or generated asset, `ASSETS.md`
must identify its source, license/terms status, attribution requirement, and
runtime readiness. `GAME_STYLE.md` must also record the provenance and usage
limits of mood boards and other visual or sensory references. References are
directional evidence, not permission to copy protected characters, layouts,
music, voices, trademarks, or a living artist's signature style.
