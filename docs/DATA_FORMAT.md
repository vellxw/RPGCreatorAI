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
| `database.audio` | string | Optional path to an audio registry shard. |

`ProjectLoader` validates the file strictly; any missing or invalid
field returns `std::nullopt` with a descriptive log line.

Before `Game::initialize`, the native runtime also runs
`RuntimeProjectValidator` against `data/project.json`. This startup gate
loads configured map and database JSON files, rejects unsafe relative paths,
checks required map layers and start-map placement, and validates critical
references used by commands (`transferMap`, items, shops, troops, switches,
variables, common events, movement-route targets, and animation actions).
Validation errors are logged and abort startup with a non-zero process exit;
warnings are logged but non-fatal.

## maps/*.json

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | int | `1`. |
| `id` | string | Must match the id used in `project.json`. |
| `name` | string | Display name (currently logged only). |
| `bgm` | string | Optional BGM audio id for this map. Falls back to `database/system.json` `defaultBgm`. |
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
back to legacy fields. The C++ runtime selects the last page whose switch,
variable, and self-switch conditions match, then uses that page's trigger,
commands, graphic metadata, priority, and `through` option. Automatic
`autorun`/`parallel` scheduling runs through independent scheduler runners.

See [`EVENT_SYSTEM.md`](EVENT_SYSTEM.md) for the supported command set.

`pluginCommand` uses a deterministic data-only shape:

```json
{
  "type": "pluginCommand",
  "pluginId": "debug",
  "command": "setVariable",
  "args": {
    "variableId": "score",
    "value": 10
  }
}
```

`pluginId`, `command`, and arg keys must be safe identifiers. `args` may only
contain string, number, boolean, or null values; nested objects, arrays, and
code-like strings are rejected by editor validation and ignored by runtime
parsers if encountered.

## database/commonEvents.json

```json
{
  "schemaVersion": 1,
  "commonEvents": [
    {
      "id": "night_warning",
      "name": "Night Warning",
      "trigger": "parallel",
      "switchId": "night_mode",
      "commands": [{ "type": "showText", "text": "It is getting late." }]
    }
  ]
}
```

`trigger` accepts `manual`, `autorun`, or `parallel`. Manual common events run
through `callCommonEvent`. Autorun and parallel common events require
`switchId` and run only while that switch is ON.

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
  "defaultCharacterHeightTiles": 1.5,
  "defaultBgm": "town_bgm",
  "audio": {
    "confirm": "assets/audio/confirm.wav",
    "cancel": "assets/audio/cancel.wav",
    "chest": "assets/audio/chest.wav",
    "chest_open": "assets/audio/chest.wav",
    "battle": "assets/audio/battle.wav",
    "town_bgm": "assets/audio/town_bgm.wav",
    "town_theme": "assets/audio/town_bgm.wav"
  }
}
```

`playerMovementSpeed` accepts `oneEighth`, `oneQuarter`, `half`,
`normal`, `double`, or `quadruple`. The bundled sample uses `double`
(`125 ms/tile`). `defaultCharacterHeightTiles` is used when an event has
no per-event override and its animation set does not define display
metadata.

`audio` maps deterministic local sound ids to project-relative WAV paths. The
System database editor exposes these pairs directly. Default/map BGM and
`playSound.soundId` must reference one of these ids or a built-in fallback id.
Project data can override or extend the registry in `system.json` or in an
optional `database.audio` shard with `audio`, `sounds[]`, or `bgm[]` entries.
Audio paths must be local project-relative `.wav` paths. Missing WAV files and
unavailable audio devices are logged warnings, not validation errors.
