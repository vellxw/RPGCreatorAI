# PX-177 — Portrait Generation Research

Issue: PX-177 / FRA-611
Milestone: M08 — Generated Asset And Animation Research
Date: 2026-06-15
Status: research docs-only, source-cited, no live paid provider calls.

## Purpose

Document provider and workflow suitability for RPG character portrait
generation, so M09 (animation quality rubric) and downstream asset
issues can define prompt/spec constraints, review and quality checks,
and database integration for portraits.

## Scope (in / out)

In scope:
- Portrait consistency across poses, lighting, and art style
- Art-style control and palette locking
- Transparency, background, and crop handling
- Database asset integration (linking portrait to actor/class)
- Review and quality-check criteria

Out of scope:
- Specific commercial provider rankings
- Live provider calls (none performed; research only)
- Legal/provenance analysis (covered by PX-183)
- Animation of portraits (covered by PX-174/PX-175)

## Sources reviewed

- `output/autoprompt/catalog/files_by_area.json`
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
- `src/providers/portraitGenerationWorkflow.ts`
- `src/providers/imagePromptTemplates.ts`
- `src/providers/generatedImageVisualQa.ts`
- `src/providers/mockProviderContract.ts` (for the local mock contract
  the pipeline must respect)
- `src/adapters/defaultAssetCatalog.ts`
- `src/database/RpgDatabases.cpp` (actor and class definitions)

External provider docs were not fetched live during this run.

## Findings

### 1. Portrait consistency techniques

- **Identity reference image**: same reference as the character
  sprite sheet (PX-174). One canonical image reused for every portrait
  regeneration.
- **Style reference image**: separate slot for art style. Different
  from character reference.
- **Pose-locked prompt**: explicit pose description, framing, camera
  distance, and lighting for every portrait so the framing is
  predictable.
- **Fixed canvas size**: standard portrait canvas (e.g., 256x256,
  512x512) is more reliable than freeform.
- **Negative prompt**: explicit list of what to avoid (e.g., "no
  full body", "no busy background", "no text", "no extra hands").

### 2. Art-style control

Effective style control comes from:
- **Style block** at the start of the prompt ("pixel art, 16-bit
  JRPG, limited palette, cel-shaded, no anti-aliasing").
- **Palette anchors**: a small named palette (e.g., "primary skin",
  "primary cloth", "accent") referenced in every prompt.
- **Lighting direction**: "front-left key light, soft fill" or
  "flat shading" depending on style.
- **Reference image set**: a small fixed set of approved reference
  images is more reliable than describing the style in prose.

### 3. Transparency and background handling

- **Transparent background** is the default expectation for runtime
  use. Generation must be done with a transparent or single-color
  background, and the normalization step must isolate the foreground
  alpha correctly.
- **Edge cleanup**: small artifacts at the alpha edge are common
  and must be cleaned during normalization. The
  `generatedImageVisualQa.ts` module already defines QA categories
  that include edge and alpha checks.
- **Crop framing**: portraits are typically head-and-shoulders;
  full-body portraits require explicit prompt control and tend to be
  less consistent at the small canvas sizes RPGMaker-style projects
  use.

### 4. Database integration

Portraits are linked to actor records (`src/database/RpgDatabases.cpp`
actor table) and can be linked to class records for class portraits.
The integration path is:

1. Generate portrait candidate via `portraitGenerationWorkflow.ts`.
2. Save the candidate PNG and a manifest entry to the asset catalog
   (`defaultAssetCatalog.ts`).
3. On accept by the review inbox, the actor's `portraitAssetId` is
   updated to point to the accepted asset.
4. The runtime reads the actor and renders the portrait at menu,
   dialogue, and battle HUD.

The actor->portrait link is data-only, not in the AI pipeline; the
AI pipeline produces only the candidate, not the link.

### 5. Review and quality checks

Deterministic local checks recommended:
- **Alpha coverage**: 100 % of non-edge pixels have alpha > 0; edges
  are within a tolerance band.
- **Edge cleanliness**: no isolated foreground pixels, no holes in
  the main body.
- **Size match**: portrait is exactly the expected canvas size; no
  padding, no cropping.
- **Style coherence**: compare dominant palette to a locked style
  reference.

These checks live in `src/providers/generatedImageVisualQa.ts` and
the new fixtures/tests in M09.

## Implications for downstream issues

- M09 should add the four deterministic checks above to the
  candidate QA rubric.
- M10 should treat portrait candidates like other asset candidates:
  plan, generate, check, refine, verify, with cost guardrails.
- M11 is not directly involved (portraits are not sprite sheets),
  but the normalization step must respect the alpha edge cleanup
  before persisting.

## Citations

In-repo sources only. External provider docs not fetched in this
run.

## Known limitations of this document

- No live web fetches; external provider documentation is
  referenced generically.
- This document is a starting baseline. Specific prompt/spec
  structures should be tuned with real fixtures in M09.
- Style drift detection in pixels is heuristic; a final visual
  review by the human creator remains required.
