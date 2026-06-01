# Game Visual QA

## Purpose

This rubric scores whether RPGCreatorAI scenes satisfy
`docs/GAME_VISUAL_DESIGN.md`. The visual pass is successful only when the
average score is at least `8.0` and no category scores below `7.0`.

| Category | 0 | 5 | 10 |
| --- | --- | --- | --- |
| Viewport framing | tiny/floating map | mostly readable, some wasted frame | authored scene fills the intended frame |
| Tile seam / gap correctness | obvious holes or seams | rare defects | no accidental seams or gaps |
| Map fill / completeness | exposed voids | mostly filled | complete authored coverage with explicit empties only |
| Scene composition | random grid | readable but plain | strong focal logic and spatial hierarchy |
| Character / object scale | toy-sized or confusing | serviceable | intentional and expressive |
| Editor / runtime consistency | materially different | minor differences | matching framing and scale |
| Map-creation usability | awkward or opaque | usable with friction | efficient, clear authoring workflow |

## Required screenshots

Store the final evidence under `docs/screenshots/game-visual-design/`:

1. `01-editor-16x9-map.png`
2. `02-runtime-16x9-map.png`
3. `03-editor-square-map.png`
4. `04-runtime-square-map.png`
5. `05-map-validation-no-gaps.png`
6. `06-scene-template-town.png`
7. `07-scene-template-forest.png`
8. `08-scene-template-interior.png`

For before/after comparison, the old Phase 3 editor baseline remains in
`docs/screenshots/phase-3/01-main-editor.png`; compare it with
`01-editor-16x9-map.png` to see the shift from a tiny centered square
board to a full authored widescreen scene.

## Review notes

- Scores must be based on committed screenshots, not memory.
- If a category is below `7`, the work is not done.
- The references supplied by the user are quality-direction references
  only; do not reward imitation of copyrighted art.

## Final Phase 8 scorecard

Scored from the committed evidence set under
`docs/screenshots/game-visual-design/`.

| Category | Score | Evidence |
| --- | ---: | --- |
| Viewport framing | 9 | widescreen and square editor/runtime captures show intentional screen bounds |
| Tile seam / gap correctness | 9 | full-bleed generated tiles plus the validation capture show no accidental tile seams |
| Map fill / completeness | 9 | editor validation and authored templates show explicit filled layers |
| Scene composition | 8 | town, forest, and interior templates present clear routes and focal staging |
| Character / object scale | 8 | actors, chests, and interactables remain readable in both editor and runtime |
| Editor / runtime consistency | 9 | matching 16:9 and square captures preserve the same framing model |
| Map-creation usability | 9 | templates, layers, brush sizes, fill, rectangle, resize, and viewport controls are visible in the editor |

**Average:** `8.7 / 10`  
**Minimum category:** `8 / 10`

Phase 8 satisfies the required visual QA threshold: average is at least
`8.0` and no category is below `7.0`.

## Phase 10 MVP runtime smoke evidence

FRA-29 extends `scripts/dev/smoke-runtime.ps1` so the native smoke writes
bounded runtime screenshots under `docs/screenshots/phase10-mvp/` and asserts
real runtime log markers before passing.

Required Phase 10 MVP evidence:

1. `phase10-01-route-coach-dialogue.bmp` - player interacts with the route
   coach and the command path is visibly in dialogue.
2. `phase10-02-event-route-after.bmp` - `setMovementRoute` has moved the
   `patrol_crate` object one tile to the right.
3. `phase10-03-foreground-occlusion.bmp` - player stands under the foreground
   tree layer and is occluded by authored foreground tiles.

The same smoke run asserts the corresponding logs for `showChoices`
selection, event-target movement, `Audio requested: chest_open`,
`pluginCommand debug.log`, and `Smoke shots complete`.

## Phase 10 MVP documentation closeout

FRA-34 aligns user-facing build/run/playtest docs with this visual evidence:
browser mode is a simulated editor preview, desktop mode can launch the
native runtime, and the committed Phase 10 smoke screenshots are the required
runtime visual proof for route movement and foreground occlusion.
