# Data Format

The runtime is data-driven. All game content lives in JSON under
`data/`. The runtime never hardcodes content; it interprets these files.

```
data/
  project.json
  maps/
    town.json
    house.json
  database/
    animations.json
    actors.json
    classes.json
    commonEvents.json
    enemies.json
    items.json
    quests.json
    shops.json
    skills.json
    switches.json
    system.json
    troops.json
    variables.json
```

## project.json

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | int | Must equal `1` for Phase 1/2. |
| `title` | string | Window title. |
| `startMapId` | string | Must match an entry in `maps[].id`. |
| `startPosition.x` | int | Tile X. |
| `startPosition.y` | int | Tile Y. |
| `startPosition.direction` | string | `"up" \| "down" \| "left" \| "right"`. |
| `maps` | array | List of `{ id, path }`. |
| `database.items` | string | Path to the items database. |
| `database.animations` | string | Optional path to character animation sets. |

`ProjectLoader` validates the file strictly; any missing or invalid
field returns `std::nullopt` with a descriptive log line.

## maps/*.json

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | int | `1`. |
| `id` | string | Must match the id used in `project.json`. |
| `name` | string | Display name (currently logged only). |
| `width` | int | Tile columns. |
| `height` | int | Tile rows. |
| `tileSize` | int | Pixel size per tile (e.g. `32`). |
| `layers` | array | At minimum `ground` (visual) and `collision`. |
| `events` | array | See below. |

### Layers

```json
{
  "name": "ground",
  "type": "visual",
  "tiles": [ /* width * height ints */ ]
}
```

The `collision` layer uses `0` for walkable and `9` for solid wall.

### Events

```json
{
  "id": "old_man",
  "type": "npc",
  "x": 6,
  "y": 4,
  "solid": true,
  "sprite": "npc_old_man",
  "animationSet": "npc_old_man",
  "displayHeightTiles": 1.5,
  "trigger": "interact",
  "commands": [ /* legacy event commands */ ],
  "pages": [
    {
      "id": "page_1",
      "conditions": {
        "selfSwitches": { "A": true },
        "switches": { "quest_started": true },
        "variables": [{ "variableId": "progress", "op": "gte", "value": 2 }]
      },
      "graphic": { "sprite": "npc_old_man", "animationSet": "npc_old_man" },
      "movement": { "type": "fixed", "speed": "normal" },
      "options": { "walking": true, "stepping": false, "directionFix": false, "through": false },
      "priority": "sameAsCharacters",
      "trigger": "interact",
      "commands": [ /* page commands */ ]
    }
  ]
}
```

Recognized event types (visual hint only): `npc`, `chest`, `transfer`.
Any other value falls back to the generic event color.
`sprite` is a static asset fallback. `animationSet` points at an entry in
`database/animations.json` and enables action/direction clip lookup.
`displayHeightTiles` is optional; when present it overrides the rendered
character height for that event while collision remains one logical tile.
`pages` is optional and backward-compatible. When absent, the editor
normalizes the legacy `trigger` and `commands` into one page. Page 1 mirrors
back to legacy fields while the runtime scheduler work is staged.

See [`EVENT_SYSTEM.md`](EVENT_SYSTEM.md) for the supported command set.

## database/items.json

```json
{
  "items": [
    { "id": "potion", "name": "Pocion", "description": "Restaura vida.", "type": "consumable" }
  ]
}
```

The item database is currently consulted only for metadata lookup. The
inventory itself is keyed by `id` and lives in `GameState`.

## database/animations.json

```json
{
  "schemaVersion": 1,
  "sets": [
    {
      "id": "player_adventurer",
      "display": { "heightTiles": 1.5, "yOffsetPx": 0 },
      "clips": [
        {
          "action": "walk",
          "direction": "down",
          "asset": "player_adventurer_walk_down",
          "frameSize": { "width": 64, "height": 64 },
          "frameCount": 4,
          "fps": 8,
          "loop": true,
          "anchor": { "x": 32, "y": 54 }
        }
      ]
    }
  ]
}
```

Animation assets are horizontal sheets. Runtime BMPs live under
`assets/generated/runtime/`; editor PNGs live under
`src/assets/generated/`.

`display.heightTiles` controls field character scale in both runtime and
editor preview. `widthTiles` is optional and otherwise derived from frame
aspect ratio. `yOffsetPx` adjusts the bottom-center anchor in pixels.

## database/system.json movement/display fields

```json
{
  "playerAnimationSet": "player_adventurer",
  "playerMovementSpeed": "double",
  "defaultCharacterHeightTiles": 1.5
}
```

`playerMovementSpeed` accepts `oneEighth`, `oneQuarter`, `half`,
`normal`, `double`, or `quadruple`. The bundled sample uses `double`
(`125 ms/tile`). `defaultCharacterHeightTiles` is used when an event has
no per-event override and its animation set does not define display
metadata.
