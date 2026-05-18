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

## Review notes

- Scores must be based on committed screenshots, not memory.
- If a category is below `7`, the work is not done.
- The references supplied by the user are quality-direction references
  only; do not reward imitation of copyrighted art.

