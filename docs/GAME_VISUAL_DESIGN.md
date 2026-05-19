# Game Visual Design — Source of Truth

## Purpose

`docs/GAME_VISUAL_DESIGN.md` is the binding visual standard for authored
games in RPGCreatorAI. It defines how maps, cameras, tiles, characters,
editor previews, and runtime presentation work together so projects feel
like complete story-RPG scenes rather than tiny test grids.

The attached visual references are quality-direction references only:
readable composition, complete framing, strong mood, clear playable
space, and intentional scale. RPGCreatorAI must use original assets and
must not copy reference art, layouts, characters, or copyrighted content.

---

## 1. Game viewport philosophy

The game screen is the authored frame. A project is not a loose tilemap
floating inside a window; it is a composed scene presented through a
declared viewport profile.

- The viewport owns the visible screen bounds, aspect ratio, base
  resolution, camera rules, and scaling policy.
- Maps may be larger than the viewport, equal to it, or intentionally
  smaller only when the smaller room is a deliberate composition choice.
- The editor and runtime must interpret the same viewport profile.
- A scene should read as complete at first glance: background, playable
  floor, boundaries, objects, and character scale all cooperate inside
  the frame.

## 2. Supported aspect ratios

Every project visual profile must support:

| Preset | Ratio | Intended use |
| --- | --- | --- |
| `16:9` | `16:9` | default modern story-RPG presentation |
| `4:3` | `4:3` | retro/classic RPG composition |
| `1:1` | `1:1` | compact rooms, portrait-social scenes, puzzle layouts |
| `custom` | author-defined | unusual presentation targets with explicit width/height |

Presets are convenience helpers. The saved project stores concrete width
and height values so custom ratios remain deterministic.

## 3. Default recommendation

The default project profile is:

```json
{
  "aspectRatio": "16:9",
  "baseResolution": { "width": 1280, "height": 720 },
  "tileSize": 32,
  "cameraMode": "follow-player",
  "mapPresentation": "full-scene",
  "zoom": 1,
  "integerScale": true
}
```

`16:9` is the default because it best supports modern story-RPG rooms,
wide exterior scenes, dialogue staging, and emotionally composed
locations without forcing every project into a square board.

## 4. Map size vs screen size rules

- A full-scene map should cover at least the visible viewport span in
  world pixels.
- Recommended minimum tile span is
  `ceil(viewportWidth / tileSize) x ceil(viewportHeight / tileSize)`.
- Maps smaller than the viewport are valid only when intentionally marked
  as compact/fixed rooms and given an authored background treatment.
- Outdoor maps should normally exceed the viewport in at least one axis
  so the camera can reveal space through movement.
- Interior maps may equal the viewport or be modestly larger, but they
  still need a complete composition.
- Resizing a map must preserve existing authored cells when possible and
  initialize new cells with explicit fill values, never accidental voids.

## 5. Camera rules

Supported camera modes:

- `follow-player`: centers on the player when possible, clamps to map
  bounds, and never reveals unintended outside-map void.
- `fixed-room`: keeps the authored room framed as a single composition.
- Future modes may exist, but they must not weaken this document.

General rules:

- Camera coordinates are world-space integers after zoom has been
  resolved.
- Camera clamping must account for the full viewport dimensions.
- If a map is smaller than the viewport, the scene is centered only when
  that behavior is intentional; otherwise use authored fill/background.
- Camera bounds must be visible in the editor whenever a viewport overlay
  is enabled.

## 6. Zoom rules

- Zoom changes presentation scale, not map data.
- The editor must expose:
  - fit-to-view
  - actual size / `100%`
  - zoom in / zoom out
  - a visible current zoom readout
- Runtime zoom is authored in the visual profile and interpreted
  consistently with the editor preview.
- Pixel-art projects should prefer integer zoom factors where practical.
- Zoom must never introduce tile seams, blur caused by fractional sprite
  placement, or misleading preview bounds.

## 7. Tile scaling rules

- Tile positions are integer multiples of `tileSize`.
- Tile rendering uses exact cell rectangles; adjacent tiles share edges
  with no fractional offsets.
- Raster assets must be sampled nearest-neighbor when pixel-art styling
  is active.
- Scaling may change tile display size, but not logical tile dimensions.
- Any non-integer fit-to-screen scale must be applied at the composed
  viewport level, not by giving each tile slightly different rounded
  dimensions.

## 8. No accidental holes/gaps rule

- A playable visual layer must never contain unintentional empty cells.
- Missing tile ids, undefined tile ids, or tile-array length mismatches
  are validation problems.
- Intentional transparency must use an explicit tile id and editor visual,
  never silently share the same appearance as missing content.
- The editor must surface:
  - missing tile warnings
  - visual layer completeness warnings
  - explicit empty/void cells
- Rendering must use pixel-perfect alignment: no CSS/SVG seams, no
  subpixel offsets, no rounding gaps between neighbors.
- Auto-fill may be offered, but must remain an explicit author action.

## 9. Scene composition rules

Every scene should have:

- a clear focal route or focal interaction
- a readable foreground / playable midground / background hierarchy
- intentional negative space rather than accidental emptiness
- a silhouette and value structure that lets the player immediately read
  walkable space, blockers, entrances, and interactables
- complete frame coverage, with no unplanned black voids or detached map
  islands

The composition may be sparse, but it must look authored.

## 10. Layering rules

Recommended layer roles:

| Layer | Responsibility |
| --- | --- |
| background | fills the scene behind playable tiles |
| ground / floor | primary walkable visual surface |
| decoration / midground | non-blocking scene detail |
| collision | movement truth, editor-visible overlay |
| events / entities | interactables, NPCs, transfer points |
| foreground | optional occluders, frame elements, canopy, walls |

Rules:

- Gameplay authority stays in data layers, not renderer guesswork.
- Decorative layers must not silently define collision.
- Collision truth must stay readable in the editor.
- Foreground elements may occlude only when player readability remains
  acceptable.

## 11. Interior map rules

- Interiors should feel like rooms, not warehouse grids.
- Use enclosing walls, floor treatment, furniture clustering, doors,
  lighting accents, and believable walking lanes.
- Most story interiors should fit cleanly inside one authored frame or a
  small number of adjacent frames.
- The walkable area should usually occupy roughly `35–70%` of the frame;
  denser or emptier rooms need a clear expressive reason.
- Entrances, exits, and important interactables should be visually
  discoverable within two seconds.

## 12. Exterior map rules

- Exteriors should feel wider, layered, and alive.
- Use pathing, vegetation, water, height changes, boundary shapes, and
  object clusters to prevent “flat lawn” syndrome.
- Wide outdoor maps should use camera movement to reveal authored detail,
  not expose empty margins.
- Boundaries should feel natural where possible: tree lines, fences,
  cliffs, rivers, walls, buildings, or snow banks rather than naked
  rectangular edges.

## 13. Story-RPG scene rules

- A scene must support emotional staging, not only traversal.
- Rooms should be compact enough for readable dialogue blocking.
- NPCs and interaction targets need visual breathing room and clear
  composition.
- Scene props should imply place, time, and use: beds, shelves, signs,
  carts, flowers, lamps, tracks, footprints, benches, etc.
- Battle/playtest scenes should preserve readable silhouettes and HUD
  space while still feeling like part of the authored world.

## 14. Collision readability rules

- Collision should align with visible blockers wherever possible.
- Walkability should be inferable from art before the player tests it.
- Invisible blockers require a deliberate reason and editor-visible
  annotation.
- Transfer tiles and doors may override wall collision, but the editor
  must show that relationship clearly.
- QA should verify that important routes, entrances, and exits are not
  visually ambiguous.

## 15. Character scale rules

- Character scale must feel intentional relative to doors, furniture,
  paths, and room size.
- Default placeholder actors should read clearly at the default camera
  scale without becoming toy-sized specks.
- Character animation sets may declare
  `display: { heightTiles, widthTiles?, yOffsetPx? }`. Characters render
  bottom-center on their logical tile using that display size; the bundled
  default is `heightTiles: 1.5`.
- `GameEvent.displayHeightTiles` may override one event's character
  height. Props and simple objects stay tile-sized unless they opt into
  character display metadata.
- In compact interiors, one character should usually occupy a meaningful
  fraction of a tile or multi-tile footprint; if the art style needs
  different proportions, author it consistently.
- Event markers and player sprites should preserve silhouette clarity at
  editor preview zoom levels.

## 15a. Character motion and animation rules

- Runtime movement remains tile-authored for collision, saves, touch
  events, and map transfers.
- Rendering may interpolate an entity between logical tiles. Camera focus
  follows that interpolated visual position, not only the committed tile,
  so held movement reads smoothly.
- Movement speed is explicit data. The bundled player uses
  `playerMovementSpeed: "double"` (`8 tiles/s`, `125 ms/tile`) while
  `"normal"` remains the classic `4 tiles/s`.
- Diagonal movement is not part of the default RPG control model.
- Player and event animations are selected from data-driven animation
  sets. Static `sprite` keys remain a fallback when no matching clip
  exists.
- Animation sheets use fixed-size frames, bottom-center anchors, and
  nearest-neighbor sampling. Frame dimensions and FPS live in
  `data/database/animations.json`.
- Event commands may request a named animation, but `EventRunner` only
  emits an animation request. `Game` applies it to the player or event
  runtime state so rendering stays separate from event execution.
- Development-time AI or procedural tools may generate assets, but the
  runtime must never depend on AI services. It consumes only committed
  PNG/BMP/JSON assets.

## 16. Object placement density rules

- Empty cells are not automatically bad; accidental emptiness is.
- Recommended starting density targets:
  - compact interiors: one meaningful prop cluster every `4–8` tiles
  - towns/exteriors: one decorative or navigational accent every `6–12`
    tiles, with looser spacing along paths
  - story focal spaces: enough detail to suggest life, but not so much
    that the interaction target disappears
- Props should form clusters and edges, not random confetti.

## 17. Environment life/detail rules

- Scenes should imply inhabitants and history through:
  - vegetation variation
  - lighting or color accents
  - signs of use
  - small set-dressing details
  - coherent prop families
- Use repeated motifs sparingly and deliberately.
- “Alive” does not require animation in the first pass; static
  composition, believable placement, and environmental storytelling are
  the baseline.

## 18. Editor preview rules

The editor preview must make the final game frame legible before launch.

- It must show the actual game-screen bounds.
- It must show the selected aspect-ratio frame.
- It must expose camera bounds and current camera preview where relevant.
- It must support fit-to-view and actual-size zoom.
- It must distinguish:
  - authored transparent cells
  - accidental empty/void cells
  - collision cells
- The canvas should use available workspace intelligently instead of
  shrinking valid maps into a tiny centered square.
- Playtest preview must reuse the runtime character display rules and
  should keep the map/event SVG layers static while only the active player
  motion updates per animation frame.

## 19. Runtime rendering rules

- Runtime must read the saved visual profile from project/system data.
- Runtime window size and presentation obey configured resolution and
  aspect ratio.
- Runtime and editor use the same interpretation of map dimensions, tile
  size, zoom, and camera framing.
- Background fill outside map bounds must be intentional and themeable,
  never the accidental result of undersized content.
- Camera clamping, tile alignment, and sprite placement must avoid seams
  and accidental void exposure.
- Gameplay interactions, collisions, menus, save/load, and event logic
  continue to work under every supported aspect ratio.

## 20. Acceptance criteria and screenshot examples

The implementation is acceptable only when the committed screenshots
under `docs/screenshots/game-visual-design/` demonstrate the following:

| Screenshot | Required proof |
| --- | --- |
| `01-editor-16x9-map.png` | editor frame shows a composed widescreen scene filling the preview area |
| `02-runtime-16x9-map.png` | native runtime respects the same widescreen framing |
| `03-editor-square-map.png` | square scene is intentional, readable, and not treated as a bug |
| `04-runtime-square-map.png` | runtime preserves that square framing |
| `05-map-validation-no-gaps.png` | editor exposes fill/void validation and no accidental seams |
| `06-scene-template-town.png` | town template reads as a complete authored exterior |
| `07-scene-template-forest.png` | forest template shows layered, alive environment composition |
| `08-scene-template-interior.png` | interior template shows compact room composition with clear collisions |

Minimum acceptance bar:

- default project does not render as a tiny centered square map
- 16:9 works by default
- 4:3, 1:1, and custom profiles are supported
- editor preview frame matches runtime framing
- no accidental tile holes or seams remain
- missing/void cells are validated and visibly distinct
- scene templates produce complete maps with spawn, collision, event, and
  interaction content
- assets are original and production surfaces do not use random emoji
- runtime and editor preserve gameplay correctness while following this
  visual standard
