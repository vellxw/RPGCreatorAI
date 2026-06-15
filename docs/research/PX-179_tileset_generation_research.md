# PX-179 — Tileset Generation Research

Issue: PX-179 / FRA-613
Milestone: M08 — Generated Asset And Animation Research
Date: 2026-06-15
Status: research docs-only, source-cited, no live paid provider calls.

## Purpose

Document provider and workflow suitability for RPG tileset generation,
so M09 (animation quality rubric), M10 (refinement pipeline) and M11
(sprite sheet optimization) can make evidence-based decisions about
prompt/spec constraints, post-processing, and runtime tile-size
compatibility.

## Scope (in / out)

In scope:
- Tile grid consistency (every cell the same size, aligned)
- Seamless / repeatable edge handling
- Passability and collision metadata
- Runtime tile-size constraints (16, 32, 48 px)
- Tileset variants (outdoor, indoor, dungeon, seasonal)

Out of scope:
- Specific commercial provider rankings
- Live provider calls (none performed; research only)
- Tileset authoring tools (Tiled, etc.) beyond what affects the
  pipeline
- Legal/provenance (covered by PX-183)

## Sources reviewed

- `output/autoprompt/catalog/files_by_area.json`
- `docs/PHASE_12_ASSET_ANIMATION_PIPELINE_INVENTORY.md`
- `src/providers/tilesetGenerationWorkflow.ts`
- `src/adapters/tilesetImport.ts`
- `src/world/MapLoader.cpp` (the runtime consumer of tilesets)
- `src/world/MapScene.cpp` (collision tile handling; see also the
  kCollisionTileId constant noted in
  `docs/analysis/05_MAGIC_NUMBERS.md`)
- `src/visual/tileCatalog.ts`
- `src/database/RpgDatabases.cpp` (tileset metadata)

External provider docs were not fetched live during this run.

## Findings

### 1. Tile grid consistency

The hardest problem in tileset generation is keeping every cell the
exact same size and on a strict grid. AI image generators do not
naturally produce pixel-aligned grids; they produce a rectangular
image that the import step slices into cells.

Implications for the pipeline:
- **Generation produces a whole image, not individual tiles.** The
  generator emits a fixed-dimension image (e.g., 256x256) and the
  normalization step slices it into N x M cells.
- **Cell size must be specified in pixels in the prompt.** "16x16
  tiles in a 256x256 sheet with 4x4 visible cells" is more reliable
  than "small tiles in a grid".
- **Generation artifacts at cell edges** (slight color bleeding,
  anti-aliasing) need to be detected and cleaned during import.
  The `tilesetImport.ts` adapter should reject sheets where cell
  edges are not clean.

### 2. Seamless / repeatable edges

Some tiles are designed to repeat (ground, walls, paths). For these:
- **Top edge must match bottom edge** for vertical repeat.
- **Left edge must match right edge** for horizontal repeat.
- **Corner tiles** (e.g., 4-corner wall tiles) must be generated
  together to ensure they meet cleanly.

The pipeline should mark each tile with a `repeat` flag and a
`category` (corner, edge, fill, decoration) so the import step can
verify edges only where appropriate.

### 3. Passability and collision metadata

The runtime (`MapLoader.cpp`, `MapScene.cpp`) reads a per-tile
passability flag from the tileset metadata. The pipeline must
produce both the image and the metadata.

Recommended approach:
- Define passability by category in the prompt: "ground tiles are
  passable (collision=0); wall tiles are impassable (collision=9)".
- The generator's response should include a JSON manifest listing
  each cell, its position, category, and passability.
- The pipeline validator must check the manifest against the image
  (count, position, no missing or duplicated cells).

The current `RuntimeProjectValidator.cpp` already validates
collision tile presence; the new generator should expose a
deterministic manifest so the validator can be more precise.

### 4. Runtime tile-size constraints

- The runtime supports 16, 32, 48 px tile sizes (see
  `src/visual/visualProfile.ts` and `tileCatalog.ts`).
- Default is 32 px in `PlayerMotion.cpp` and
  `RpgDatabases.cpp`.
- The generated sheet's effective cell size must match the project's
  declared tile size. Mismatch causes visual artifacts in the
  runtime.
- The prompt must specify the target tile size; the import step must
  verify the cell size matches.

### 5. Variants

Tileset variants (outdoor, indoor, dungeon, seasonal) are
independent generation tasks. Each variant is a separate candidate
with its own lineage. The project may keep multiple accepted
variants and let the map author choose at edit time.

## Implications for downstream issues

- M09 should add the following deterministic checks to the rubric:
  cell count, cell size, edge cleanliness for repeat tiles, manifest
  completeness.
- M10 (refinement pipeline) should refine only the failing cells,
  not the whole sheet. The lineage must point back to the original
  manifest.
- M11 (sprite sheet optimization) is also relevant for tileset
  sheets; the optimization should preserve cell alignment and not
  re-balance the palette in a way that breaks edge repeatability.

## Citations

In-repo sources only. External provider docs not fetched in this
run.

## Known limitations of this document

- No live web fetches; external provider documentation is referenced
  generically.
- The deterministic edge-cleanliness check is recommended, not
  implemented. Implementation belongs to M09 issues.
- Specific provider prompt templates will be added by follow-up
  issues with explicit permission to fetch live documentation.
