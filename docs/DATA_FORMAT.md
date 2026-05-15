# Data Format

## project.json
Defines the entry point of the game.
- `schemaVersion`: Version number.
- `title`: Game title.
- `startMapId`: ID of the initial map.
- `startPosition`: {x, y, direction}.
- `maps`: Array of map references.
- `database`: References to database files.

## maps/*.json
Defines a specific area.
- `id`: Map identifier.
- `width`, `height`: Dimensions.
- `layers`: Visual and collision data. `tiles` is a flat array.
- `events`: Entities present in the map, including NPCs, chests, and doors.

## database/items.json
Defines available items.
Contains an array of items with `id`, `name`, `description`, etc.
