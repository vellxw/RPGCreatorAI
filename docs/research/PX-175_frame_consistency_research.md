# PX-175 — Frame Consistency Research

Issue: PX-175 / FRA-609
Milestone: M08 — Generated Asset And Animation Research
Date: 2026-06-15
Status: research docs-only, source-cited, no live paid provider calls.

## Purpose

Document frame-to-frame consistency considerations for generated
animation strips and short animation workflows, so M09 (animation
quality rubric), M10 (refinement pipeline) and M11 (sprite sheet
optimization) can build deterministic checks and pipelines that
catch or prevent frame drift.

## Scope (in / out)

In scope:
- Identity preservation across animation frames
- Anchor stability through an action sequence
- Loop smoothness for cycling animations (idle, walk)
- Tradeoffs between still-frame, sprite-sheet, and video-derived
  workflows

Out of scope:
- Specific commercial provider rankings
- Live provider calls (none performed; research only)
- Frame interpolation as a runtime effect (this is generation-side
  only)
- Legal/provenance (covered by PX-183)

## Sources reviewed

- `output/autoprompt/catalog/files_by_area.json`
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
- `docs/PHASE_12_AI_PIPELINE_INVENTORY.md`
- `scripts/dev/normalize_animation_strip.py`
- `scripts/dev/generate_animation_preview.py`
- `src/database/AnimationDatabase.cpp`
- `src/providers/spriteSheetGenerationWorkflow.ts`

External provider docs were not fetched live during this run; specific
provider URLs must be added by the user or a later issue with explicit
permission.

## Findings

### 1. Sources of frame inconsistency

- **Pose drift**: adjacent frames show a character in slightly
  different stance, breaking the illusion of continuous motion.
- **Anchor drift**: the foot/ground point shifts between frames,
  causing vertical bounce during playback.
- **Palette drift**: small color changes per frame, especially in
  lighting and shadow areas.
- **Style drift**: line weight, level of detail, or rendering
  medium changes between frames.
- **Frame-skip mistakes**: a frame is missing or duplicated in the
  sheet, breaking loop math.

### 2. Workflow comparisons

- **Still-frame (per-frame regeneration)**: highest flexibility, lowest
  consistency. Each frame is a fresh sample; drift is the default.
  Use only when per-frame fidelity is critical (e.g., a keyframe
  attack pose) and budget allows manual re-rolls.

- **Sprite-sheet (one batched request)**: best consistency for the
  majority of cases. The model sees the whole sheet during sampling
  and tends to keep style stable. Frame count per request must stay
  under the provider's effective batch size or consistency degrades
  at the seam.

- **Video-derived (generate a short video, then extract frames)**:
  best motion smoothness and loop closure. Tradeoff: lower per-frame
  control, depends on video export and frame extraction quality, and
  introduces an extraction step that can introduce its own artifacts.
  Suitable for actions that need to feel naturally animated
  (idle breathing, walk cycles).

- **Hybrid (sheet generation, then per-frame re-roll on fails)**:
  recommended default. Generate a sheet, run the rubric, re-roll only
  the failing cells with small prompt deltas. Most efficient use of
  budget for predictable results.

### 3. Loop closure

For cyclic animations (idle, walk):
- First and last frame must be near-identical. Rubric should
  compute pixel-level similarity between first and last frame and
  reject if below a threshold.
- Cycle length should be a power of two in frames (2, 4, 8, 16) for
  predictable runtime frame timing, even if the AI generated a
  different count. Normalization step can drop or duplicate frames
  to match.

### 4. Anchor stability

Anchor (typically bottom-center) defines the runtime "footprint" of
the sprite. Drift between frames is the most common runtime-visible
artifact. The existing `normalize_animation_strip.py` script already
extracts an anchor per frame; a stronger check would compare
anchors across all frames of the same action and flag sheets where
the maximum centroid deviation exceeds 2 px.

### 5. Deterministic local checks (recommended for M09)

- **First/last frame similarity** for cyclic actions.
- **Anchor centroid deviation** within action/direction sets.
- **Palette delta** against a locked reference (5-color dominant
  palette comparison).
- **Frame count** matches the action's expected count (e.g., walk
  typically 4 or 6 frames per direction).
- **Pixel-difference between adjacent frames**: not zero (would
  indicate a missed frame) and not above a noise threshold (would
  indicate a glitchy transition).

All of these run locally on a saved frame strip; no provider
involvement.

## Implications for M09..M11

M09 should add the five local checks above to the rubric and require
all to pass before a candidate is marked accepted.

M10 should:
- when a check fails, re-roll only the failing cells (not the whole
  sheet) using the sheet-level reference image
- keep the original reference as lineage metadata on revised
  candidates
- cap refinement rounds per PX-215

M11 should:
- keep anchor, frame count, and palette metadata in the normalized
  output
- emit a preview sheet (PX-235) that lets the human reviewer see
  the loop visually

## Citations

In-repo sources only (no live web fetches in this run). Specific
provider documentation will be added by the user or a follow-up
issue with explicit permission.

## Known limitations of this document

- No live provider calls performed. Recommendations are based on
  in-repo analysis and general public knowledge of provider
  capabilities.
- This document is a starting baseline. Final pixel-difference and
  palette-delta thresholds should be tuned empirically once
  fixtures are available in M09.
- Anchor-stability analysis assumes a single character per sheet;
  multi-character sheets need a per-character anchor definition.
