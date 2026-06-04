# Asset Pipeline

## Release Branding Icons

Release app branding is sourced from `src-tauri/icons/icon-source.svg` and
documented in `docs/RELEASE_BRANDING_ASSETS.md`. The SVG is a locally authored
geometric source asset; no AI image generation, stock image, external logo
file, or untracked source is required.

Regenerate the Tauri desktop/Windows icon set with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File src-tauri/scripts/generate-icons.ps1
```

Validate dimensions, Tauri metadata, and packaged executable icon extraction
with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify-branding-assets.ps1
```

## Phase 11 Asset Library And Runtime Export

Phase 11 adds a project-owned asset library for local-first authoring. The
asset catalog is stored at `data/assets/catalog.json` and is preserved through
browser export/import, Tauri desktop open/save/create, and playtest session
copies. The native runtime does not consume editor-only catalog metadata.

### Asset Classes And Directories

`data/assets/catalog.json` is the editor source of truth for authoring assets.
Catalog entries use these asset classes:

| Class | Catalog `kind` | Runtime path |
| --- | --- | --- |
| Image | `image` | Exported to BMP only when referenced by runtime-facing content. |
| Spritesheet | `spritesheet` | Exported to `assets/generated/runtime/*.bmp` and linked by animation metadata. |
| Tileset | `tileset` | Exported to runtime BMP and referenced by map/tileset database metadata. |
| Audio | `audio` | WAV files are preserved as local runtime-ready paths. |
| Generated concept/intermediate | `generated` | Kept as editor/catalog evidence unless accepted into a concrete runtime class. |

Project-owned asset directories are:

| Directory | Owner | Purpose |
| --- | --- | --- |
| `assets/imported/images/` | Desktop import workflow | User image copies owned by the project. |
| `assets/imported/spritesheets/` | Desktop import workflow | User spritesheet copies that can link to animation clips. |
| `assets/imported/audio/` | Desktop import workflow | User WAV copies that can register BGM/SFX ids. |
| `assets/imported/tilesets/` | Desktop import workflow | User tileset copies that can create tileset metadata. |
| `assets/generated/source/` | Generation and QA scripts | Prompts, source manifests, provenance, and preview manifests. |
| `assets/generated/web/` | Generation and normalization scripts | Editor/browser PNG outputs. |
| `src/assets/generated/` | Bundled editor assets | Static PNG assets imported by TypeScript. |
| `assets/generated/runtime/` | Runtime export scripts | Native BMP outputs with the runtime transparency key. |
| `data/assets/runtime-manifest.json` | Runtime export scripts | Deterministic runtime manifest consumed by validation and runtime tests. |
| `docs/screenshots/` | QA workflows | Committed visual evidence and preview artifacts. |

Desktop import workflows copy selected files into the opened project without
overwriting existing project files:

- images: `assets/imported/images/`
- spritesheets: `assets/imported/spritesheets/`
- audio: `assets/imported/audio/`
- tilesets: `assets/imported/tilesets/`

Imported spritesheets can create animation database clips. Imported audio can
register `system.audio` ids for BGM/SFX selectors. Imported tilesets can
create tileset database metadata for map authoring. Browser mode reports local
imports as unavailable instead of pretending to access arbitrary files.

Runtime-ready asset export is deterministic and local:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1
```

Restricted-policy equivalent:

```bat
scripts\dev\export-runtime-assets.bat
```

Validate the checked-in manifest and outputs without rewriting them:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/export-runtime-assets.ps1 --validate-only
```

The exporter reads the catalog, flattens visual assets to BMP files under
`assets/generated/runtime/` with `#ff00ff` transparency, preserves local WAV
paths as runtime-ready audio, and writes `data/assets/runtime-manifest.json`.
The manifest is deterministic and contains no timestamp.

Milestone 06 integration evidence is recorded in
`docs/PHASE_11_ASSET_LIBRARY_INTEGRATION_GATE.md`.

### Asset States

Phase 11 uses explicit operational states so agents do not confuse drafts,
accepted project assets, and protected shipped outputs. `protected` is an
operational rule, not a catalog enum.

| State | Requirements before use | May enter runtime export |
| --- | --- | --- |
| Imported | File was copied into `assets/imported/*`, catalog metadata matches the copied file, and any database link validates. | Yes, when the asset class is runtime-facing and the exporter supports it. |
| Generated draft | Provider/mock output has prompt provenance and candidate metadata, but review is still pending or rejected. | No. Drafts stay outside runtime data. |
| Generated accepted | Reviewer accepted the candidate, generated metadata includes prompt/provider/template provenance, QA metadata is stored, and local output paths exist. | Yes, after normal export validation. |
| Protected shipped output | Checked-in bundled assets, runtime BMPs, source manifests, branding icons, and preview evidence generated by repo scripts. | Already part of the shipped evidence; regenerate only through the documented script and re-run validation. |

Do not hand-edit protected runtime BMPs, generated manifests, or bundled icon
outputs. Change the source asset or manifest input, run the owning script, and
commit the regenerated outputs with validation evidence.

### Reproducible Workflows

Use the focused workflow docs for detailed UI evidence:

| Workflow | Primary doc | Recovery if it fails |
| --- | --- | --- |
| Image import | `docs/PHASE_11_IMAGE_IMPORT_WORKFLOW.md` | Confirm desktop mode, readable supported file, unique catalog id, and project write permission; browser mode must remain unavailable. |
| Spritesheet import | `docs/PHASE_11_SPRITESHEET_IMPORT_WORKFLOW.md` | Fix frame size/count metadata, duplicate ids, or invalid animation links before saving. |
| Audio import | `docs/PHASE_11_AUDIO_IMPORT_WORKFLOW.md` | Use a readable WAV file, resolve duplicate audio ids, and keep failed imports out of `system.audio`. |
| Tileset import | `docs/PHASE_11_TILESET_IMPORT_WORKFLOW.md` | Fix tile dimensions, tileset metadata, duplicate ids, or invalid map references. |
| Generated tilesets | `docs/PHASE_11_AI_TILESET_GENERATION_WORKFLOW.md` | Use mock-backed validation, resolve review warnings, and accept only reviewed candidates. |
| Generated item icons | `docs/PHASE_11_AI_ITEM_ICON_GENERATION_WORKFLOW.md` | Re-run mock generation or reject the candidate; do not assign failed visual QA assets. |
| Generated portraits | `docs/PHASE_11_AI_PORTRAIT_GENERATION_WORKFLOW.md` | Keep rejected portraits out of actor/event references and retry through the review surface. |
| Image edits/variations | `docs/PHASE_11_IMAGE_EDIT_VARIATION_WORKFLOW.md` | Preserve parent provenance, reject failed variations, and retry without overwriting the accepted parent. |
| Sprite sheets | `docs/PHASE_11_SPRITE_SHEET_GENERATION_PIPELINE.md` | Repair source concept linkage, animation QA, or visual QA before final acceptance. |
| Animation normalization | `docs/PHASE_11_ANIMATION_STRIP_NORMALIZATION.md` | Fix source strip path, frame dimensions, frame count, transparency, anchor, or empty frames, then re-run the normalizer. |
| Animation previews | `docs/PHASE_11_ANIMATION_PREVIEW_GENERATION.md` | Validate the normalization manifest and web PNG first, then regenerate preview GIF/sheet evidence. |
| Runtime export | `docs/PHASE_11_ASSET_OPTIMIZATION_RUNTIME_EXPORT.md` | Fix missing catalog paths, unsupported formats, invalid manifest references, or stale runtime BMPs, then rerun export validation. |

### QA And Export Gates

Asset work is not complete until the relevant local gates pass:

- Visual scenes and authored map evidence follow the seven-category rubric in
  `docs/GAME_VISUAL_QA.md`: viewport framing, seam/gap correctness, map fill,
  scene composition, character/object scale, editor/runtime consistency, and
  map-creation usability.
- Generated image candidates use the five-check review in
  `docs/PHASE_11_GENERATED_IMAGE_VISUAL_QA_SCORING.md`: dimensions,
  transparency, style consistency, readability, and runtime suitability.
- Generated/imported asset inventory and runtime output drift are audited in
  `docs/GENERATED_ASSET_QUALITY_AUDIT.md`.
- Runtime export must pass `scripts/dev/export-runtime-assets.ps1
  --validate-only` before a runtime-facing asset issue can be marked done.
- Normal validation uses mocks, fixtures, and local scripts only; live paid
  providers are not part of asset pipeline validation.

## Phase 11 Animation Strip Normalization

CP-075 adds a deterministic local normalizer for generated or imported raw
character strips:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1
```

Restricted-policy equivalent:

```bat
scripts\dev\normalize-animation-strip.bat
```

The normalizer reads one project-relative horizontal source strip, enforces
frame width, frame height, frame count, FPS, loop, anchor, transparency, and
non-empty frame rules, then writes runtime/editor-ready outputs:

- `assets/generated/web/{outputId}.png`
- `src/assets/generated/{outputId}.png`
- `assets/generated/runtime/{outputId}.bmp`
- `assets/generated/source/phase11_animation_normalization/{outputId}.json`

The manifest is deterministic and stores source-to-output traceability,
optional source asset/concept ids, source slot bounds, normalized bounds,
shared scale, anchor, action, direction, FPS, loop, and output paths.

Validate an existing normalized strip manifest without rewriting outputs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/normalize-animation-strip.ps1 --validate-manifest assets/generated/source/phase11_animation_normalization/{outputId}.json
```

Detailed CP-075 evidence is recorded in
`docs/PHASE_11_ANIMATION_STRIP_NORMALIZATION.md`.

## Phase 11 Animation Coverage Validation

CP-076 extends project validation so character animation sets cannot silently
ship with missing required coverage. The editor validation gate now checks:

- the configured player animation set has `idle`, `walk`, `interact`,
  `attack`, `hurt`, and `death` for all four directions
- NPC-style animation set ids (`npc_` or `npc-`) have `idle` and `walk` for
  all four directions
- enemy-style animation set ids (`enemy_` or `enemy-`) have `idle`, `attack`,
  `hurt`, and `death` for all four directions
- `any` direction clips satisfy each required action for every direction
- spritesheet assets used by clips have runtime-compatible metadata and output
  dimensions when catalog width/height/frame metadata is present

Coverage gaps are warnings in the validation panel; malformed spritesheet
metadata and runtime-incompatible referenced assets are errors. Detailed
CP-076 evidence is recorded in
`docs/PHASE_11_ANIMATION_COVERAGE_VALIDATOR.md`.

## Phase 11 Animation Preview Evidence

CP-077 adds a deterministic preview generator for normalized animation strips:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-preview.ps1
```

Restricted-policy equivalent:

```bat
scripts\dev\generate-animation-preview.bat
```

The generator reads a CP-075 normalization manifest, opens the normalized web
PNG strip, verifies every preview frame is non-empty, and writes:

- `docs/screenshots/phase11-animation-preview/{outputId}.gif`
- `docs/screenshots/phase11-animation-preview/{outputId}_sheet.png`
- `assets/generated/source/phase11_animation_previews/{outputId}.json`

Preview manifests store source normalization manifest links, source strip
paths, optional source asset/concept ids, frame metadata, preview scale,
duration, output paths, and `runtimeDependency: false`. The sample
`player_adventurer_walk_down` preview evidence is checked in for visual QA.
Detailed CP-077 evidence is recorded in
`docs/PHASE_11_ANIMATION_PREVIEW_GENERATION.md`.

## Phase 11 Runtime BMP Export For Generated Characters

CP-078 extends the runtime exporter so accepted/generated character animation
strips can enter the native runtime path convention. In addition to catalog
assets, `scripts/dev/export_runtime_assets.py` now reads CP-075 normalization
manifests from:

```text
assets/generated/source/phase11_animation_normalization/*.json
```

For each manifest with a local `outputs.webPng`, the exporter writes:

```text
assets/generated/runtime/{id}.bmp
```

using `#ff00ff` as the runtime transparency key, then records a generated
spritesheet entry in `data/assets/runtime-manifest.json` with the source
normalization manifest, source asset/concept ids, frame metadata, action,
direction, FPS, loop, anchor, runtime key, and runtime path. The runtime path
matches `SpriteCatalog::runtimePathFor(id)`.

Detailed CP-078 evidence is recorded in
`docs/PHASE_11_RUNTIME_BMP_EXPORT_GENERATED_CHARACTERS.md`.

## Phase 11 Character Animation Integration Gate

CP-080 validates the AI character/animation pipeline as one local-first
workflow:

1. reviewed `character-concept-v1` mock generation
2. `character-spritesheet-v1` mock generation from the reviewed concept
3. explicit character animation QA metadata
4. visual QA metadata
5. project validation for accepted generated spritesheet assets
6. editor `AnimationPreview` rendering through a preview URL
7. normalized preview/export fixtures for `player_adventurer_walk_down`
8. runtime BMP manifest validation and native `SpriteCatalog` path tests

Normal validation remains mock-backed and offline. Runtime export is a
deterministic asset pipeline step; the native runtime continues to load local
data and BMP assets only.

Detailed CP-080 evidence is recorded in
`docs/PHASE_11_AI_CHARACTER_ANIMATION_INTEGRATION_GATE.md`.

## Phase 9 Character Animations

Phase 9 uses an `agent-sprite-forge`-compatible workflow for development
assets and commits only final runtime/editor outputs:

- Source workflow: `https://github.com/0x0funky/agent-sprite-forge`
- Pinned commit: `fff651a89223b044ccfc0b75ed9f3754c6d739b1`
- Referenced skill: `generate2dsprite/SKILL.md`
- Local generator: `scripts/dev/generate_animation_assets.py`
- PowerShell wrapper: `scripts/dev/generate-animation-assets.ps1`
- Batch wrapper: `scripts/dev/generate-animation-assets.bat`

The generator starts from the approved shipped seed sprites in
`src/assets/generated/`, creates full horizontal action strips, normalizes
each frame to `64x64`, and writes:

- editor/web PNG sheets to `src/assets/generated/` and
  `assets/generated/web/`
- runtime BMP sheets with `#ff00ff` transparency key to
  `assets/generated/runtime/`
- animation metadata to `data/database/animations.json`
- prompts and manifest to `assets/generated/source/phase9_animation/`
- preview PNG/GIF evidence to `docs/screenshots/phase-9-animation/`

The runtime has no AI dependency. It loads animation metadata and already
committed BMP sheets through `AnimationDatabase` and `SpriteCatalog`.

## Required Clips

`player_adventurer` must ship these actions for `down`, `left`, `right`,
and `up`:

- `idle`
- `walk`
- `interact`
- `attack`
- `hurt`
- `death`

The bundled primary NPC sets must ship at least `idle` and `walk` for all
four directions:

- `npc_old_man`
- `npc_shopkeeper`

`data/database/animations.json` is the source of truth for action,
direction, asset key, frame size, frame count, FPS, loop behavior,
anchor, and optional field-display metadata. Character sets should
declare `display.heightTiles`; the bundled player and NPC sets use
`1.5` so `64x64` frames render as field characters instead of being
compressed into a padded tile interior. If a generated sheet fails
metadata or visual QA, regenerate it before committing.

## Regeneration

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/generate-animation-assets.ps1
```

Quality gates:

- every required sheet exists in PNG and BMP form
- each sheet has four non-empty `64x64` frames
- every character animation set declares positive display metadata
- runtime BMP transparency uses magenta only as the color key background
- preview GIFs under `docs/screenshots/phase-9-animation/` show readable
  motion at game scale
