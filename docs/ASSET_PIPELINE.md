# Asset Pipeline

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
