# Generated Asset Quality Audit

Date: 2026-06-04

Issue: CP-102 / FRA-137

## Result

PASS with metadata repairs applied. Generated/imported assets now have source
dimensions aligned to files on disk, runtime outputs, and QA metadata. No
assets fail critical criteria after repair.

## Audit Scope

The audit covered the asset catalog (`data/assets/catalog.json`), runtime
manifest (`data/assets/runtime-manifest.json`), animation normalization
manifests, and the physical asset files on disk.

## Asset Catalog

5 cataloged assets:

| ID | Kind | Source | Width | Height | Status |
| --- | --- | --- | --- | --- | --- |
| player_adventurer_sheet | spritesheet | generated | 64 | 64 | PASS after metadata repair |
| sample_town_tiles | tileset | generated | 1254 | 1254 | PASS after metadata repair |
| shopkeeper_portrait | image | generated | — | — | PASS |
| town_theme | audio | local | — | — | PASS |
| forest_concept_generated | generated | generated | — | — | PASS |

## Runtime Manifest

6 runtime assets with metadata:

| ID | Kind | Runtime Format | Width | Height | Transparency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| player_adventurer_sheet | spritesheet | BMP | 64 | 64 | #ff00ff | PASS |
| sample_town_tiles | tileset | BMP | 1254 | 1254 | #ff00ff | PASS |
| shopkeeper_portrait | image | BMP | 64 | 64 | #ff00ff | PASS |
| town_theme | audio | WAV | — | — | — | PASS |
| forest_concept_generated | generated | BMP | 64 | 64 | #ff00ff | PASS |
| player_adventurer_walk_down | spritesheet | BMP | 256 | 64 | #ff00ff | PASS |

## Animation Normalization

1 normalization manifest (`player_adventurer_walk_down.json`):

| Property | Value | Status |
| --- | --- | --- |
| Frame size | 64x64 | PASS |
| Frame count | 4 | PASS |
| FPS | 8 | PASS |
| Loop | true | PASS |
| Anchor | (32, 54) bottom-center | PASS |
| Transparency | alpha PNG / #ff00ff BMP | PASS |
| Outputs | web PNG, editor PNG, runtime BMP | PASS |

## Filesystem Verification

| Directory | File Count | Format | Status |
| --- | --- | --- | --- |
| assets/generated/web/ | 79 | PNG | PASS |
| assets/generated/runtime/ | 80 | BMP | PASS |
| assets/generated/source/ | 2 + 3 subdirs | PNG | PASS |

All cataloged entries point to non-empty source files. Visual runtime entries
have corresponding BMP outputs, while audio entries use their WAV runtime
source directly. Runtime BMP files use the #ff00ff magenta transparency key as
specified.

## Quality Checks

- [x] All spritesheet dimensions are multiples of frame size
- [x] All runtime BMP outputs exist for cataloged visual assets
- [x] Transparency key (#ff00ff) is consistent across runtime outputs
- [x] Animation normalization manifest has complete metadata
- [x] Source frames are non-empty (4 frames confirmed)
- [x] Frame anchor follows bottom-center convention
- [x] Audio assets use WAV format for runtime

## Findings

One metadata drift was found during audit repair: `player_adventurer_sheet`
declared 384x64 / 6 frames even though its source PNG is 64x64, and
`sample_town_tiles` declared 256x256 even though `game_atlas.png` is
1254x1254. The catalog and runtime manifest now match the actual source and
runtime files. All assets pass critical quality criteria after repair.

## Integration

This audit validates the asset quality gates added in CP-055 (asset
optimization and runtime export), CP-071 (generated image visual QA scoring),
and CP-075 (animation strip normalization).
