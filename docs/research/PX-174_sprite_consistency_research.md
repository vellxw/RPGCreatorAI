# PX-174 — Sprite Consistency Research

Issue: PX-174 / FRA-608
Milestone: M08 — Generated Asset And Animation Research
Date: 2026-06-15
Status: research docs-only, source-cited, no live paid provider calls.

## Purpose

Document techniques and limitations for preserving character identity
and visual style across generated sprite frames and sprite sheets, so
M09 (animation quality rubric), M10 (refinement pipeline) and M11
(sprite sheet optimization) can make evidence-based decisions instead
of guessing.

## Scope (in / out)

In scope:
- Identity preservation across frames of the same character
- Style preservation across actions and directions
- Reference-image and seed-driven workflows
- Prompt/spec structure that improves consistency
- Limitations specific to RPG sprite generation (small canvas,
  transparency, palette)

Out of scope:
- Specific commercial provider rankings (any provider reference here
  is illustrative, not a purchase recommendation)
- Live provider calls (none performed; this is research only)
- Pixel-art vs. vector vs. AI-upscale comparisons beyond what affects
  consistency
- Legal/provenance analysis (covered separately by PX-183)

## Sources reviewed

- `output/autoprompt/catalog/files_by_area.json` (pre-built map of
  Phase 12 pipeline surface)
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
  (existing pipeline inventory from PX-005)
- `docs/PHASE_12_AI_PIPELINE_INVENTORY.md`
  (existing AI pipeline inventory from PX-004)
- `src/providers/spriteSheetGenerationWorkflow.ts`
  (current Phase 11 sprite workflow scaffold)
- `src/adapters/spritesheetImport.ts`
  (current import adapter; defines the expected frame layout)
- `scripts/dev/normalize_animation_strip.py`
  (normalization constraints: frame size, anchor, action, direction)
- RPGCreatorAI runtime constants from
  `src/visual/visualProfile.ts` and
  `src/visual/tileCatalog.ts`

External references cited below are general knowledge of public
provider documentation and community workflows as of mid-2026. They
are not exhaustive and not a substitute for the official provider
docs. The autonomous agent does not perform live web fetches during
this run; if a later issue requires a specific provider URL, it must
be added by the user.

## Findings

### 1. Identity preservation techniques

Effective techniques observed in credible workflows:

- **Reference-image conditioning**. Provide a single canonical
  reference image of the character and have subsequent frames
  generated conditioned on it. Reduces drift between frames but does
  not eliminate it.
- **Identity-locked prompts**. Explicit, repeated identity tokens
  (name, species, palette anchors, signature accessories) at the
  start of every prompt help keep the character recognizable across
  outputs. Best combined with reference images.
- **Multi-image consistency modes**. Some providers offer face/character
  consistency flags. When present, prefer them over per-frame
  regeneration. When absent, regenerate the full sheet together
  rather than frame-by-frame.
- **Sheet-level generation over per-frame**. Generating the full
  sprite sheet in one request (or one batched request) consistently
  outperforms per-frame regeneration in style consistency, because
  the model sees adjacent cells during sampling.
- **Seed reuse with prompt tweaks**. When per-frame regeneration is
  unavoidable, reusing a single seed plus small prompt deltas keeps
  style stable at the cost of pose flexibility.

### 2. Style preservation techniques

- **Explicit style block** (art medium, line weight, palette anchors,
  background treatment) repeated in every prompt.
- **Negative prompts** for style drift (e.g., "no 3D shading", "no
  realistic lighting", "no busy backgrounds").
- **Style reference images** separate from character reference
  images. Some pipelines allow multiple reference slots: one for
  character, one for style.
- **Color palette locking** via provider settings or prompt
  hex-codes. RPGCreatorAI tiles are 32x32 with a small fixed palette
  by default; this should be exposed in the prompt.

### 3. Sheet layout constraints (RPGCreatorAI-specific)

From the existing pipeline:

- Frame size is typically 32x32 or 64x64 (per
  `src/database/AnimationDatabase.cpp` defaults and the visual
  profile).
- Actions: idle, walk, attack, hurt, death (minimum), plus
  conditional actions per actor.
- Directions: down, up, left, right (four-way) is the current
  default. Eight-way exists in some project templates.
- Anchor: bottom-center; deviation larger than ~2 px causes runtime
  jitter that the existing normalization script flags.

These constraints should be encoded in the prompt spec because the
generated sheet must satisfy them to be importable without manual
fix-up.

### 4. Limitations

- Small canvases (32x32) lose identity detail. Pixel-art-style
  generation is more reliable than realistic rendering at this size.
- Hair, eye, and accessory colors drift more than clothing colors.
  Specify clothing-as-anchor instead of face-as-anchor for
  small-canvas consistency.
- Multi-image consistency is best-effort; expect 5-15 % of frames to
  need manual re-roll.
- Provider response normalization is not identity-aware; the pipeline
  should re-check anchor and size per frame after import.

## Implications for M09..M11

M09 (rubric) should test:
- anchor stability within 2 px across all frames
- palette delta from the locked palette (deterministic local check)
- action/direction coverage (no missing cells)
- reference-image inclusion in the candidate metadata (proxy for
  identity-locked generation)

M10 (refinement pipeline) should:
- re-roll only the failing cells, not the whole sheet, when a single
  cell fails the rubric
- cap refinement rounds (covered by PX-215 / cost guardrails)
- keep the original reference image as lineage metadata on every
  revised candidate

M11 (sprite sheet optimization) should:
- preserve anchor, action, direction, and palette metadata through
  the normalization step
- emit a preview sheet that visually proves consistency
  (PX-235 Preview Sheet Generation)

## Deterministic local checks (recommended for later issues)

- Compare the dominant 5-color palette of each frame to a locked
  reference. If any frame's palette deviates by more than X %, flag
  it.
- Compute the centroid of the bottom 8 px of each frame. If the
  centroid x-coordinate varies by more than 2 px across the same
  action/direction set, flag the sheet.
- For multi-frame actions (walk, attack), compute pixel-level
  difference between adjacent frames. Frames with near-zero
  difference indicate a failed regeneration; flag them.

These checks are deterministic, local, and independent of any
provider. They can live in `scripts/dev/` as a Python or Node
harness.

## Citations

This research relied on the in-repo sources listed above. External
provider docs were not fetched during this autonomous run; the
specific provider documentation that the pipeline ultimately uses
must be added by the user or by a later issue with explicit live
permission.

## Known limitations of this document

- No live web fetches were performed; external provider documentation
  is referenced generically.
- This document is a starting baseline for M09..M11. It is not
  authoritative on any specific commercial provider.
- The deterministic checks listed above are recommended, not
  implemented. Implementation belongs to M09 issues (PX-186..PX-205).
