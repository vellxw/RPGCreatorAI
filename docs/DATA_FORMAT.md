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
    items.json
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
  "trigger": "interact",
  "commands": [ /* event commands */ ]
}
```

Recognized event types (visual hint only): `npc`, `chest`, `transfer`.
Any other value falls back to the generic event color.

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
