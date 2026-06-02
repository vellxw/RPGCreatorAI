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
