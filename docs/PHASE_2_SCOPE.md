# Phase 2 — Visible Playable RPG Runtime MVP

## Goal

Turn the black-window bootstrap into a minimal visible playable RPG.
Running `rpg_creator_runtime.exe` shows a tile map with a movable player
who can interact with NPCs/chests, transfer between maps, and save/load.

## Scope

### Included
- Visible tilemap rendered from JSON (placeholder colored tiles)
- Player rendered as a colored rectangle, with grid-based movement
- Camera that follows the player
- Tile collision, map-bound collision, solid-event collision
- Interact with NPC (dialogue)
- Visible dialogue UI (box + text via embedded bitmap font)
- Chest with persistent flag state
- `addItem` from chest (inventory in `GameState`)
- Map transfer between two maps
- Round trip: town ↔ house
- Save (F5) / Load (F9) via `SaveManager`
- Tests for non-render logic (ProjectLoader, MapLoader, CollisionSystem,
  EventRunner, GameState, SaveManager)
- Runtime smoke check (process stays alive ~3s with no error logs)

### Explicitly Excluded
Visual editor, AI provider hub, asset/image/3D generation, GitHub
publishing UI, HD-2D, WebGPU, Vulkan, DirectX-specific renderer paths,
OpenGL renderer, combat, party, skills, quests, scripting, plugin
system, multiplayer, marketplace, complex UI.

## Architecture (delta from Phase 1)

The Phase 1 architecture stays. Phase 2 implements concrete behavior in
the seams that were stubs:

- **`EventRunner`**: real command execution for `showText`, `setFlag`,
  `ifFlag`, `addItem`, `transferMap`, `wait`, `playSound`. Dialogue
  blocks the command queue until dismissed.
- **`Game`**: loads maps via `MapLoader`, drives the player tile,
  delegates collision to `CollisionSystem`, dispatches `interact`/`touch`
  events to `EventRunner`, applies `MapTransferRequest`, wires F5/F9 to
  `SaveManager`.
- **`Renderer2D`**: draws ground/wall tiles, events (NPC/chest/transfer),
  player, and dialogue UI. Uses an embedded 5x7 bitmap font
  (`BitmapFont`) — no asset pipeline.
- **`MapScene::isSolidAt`**: events at a cell take precedence over the
  collision layer so non-solid events (e.g. a door inside a wall) are
  walkable.

## Data-Driven Rules

No game data hardcoded in C++. The following live in JSON only:

- map IDs, NPC IDs, chest IDs
- flag names, item IDs, dialogue strings
- transfer destinations, tile layouts

Allowed C++ literals: log messages, command type names (`showText`,
`setFlag`, `ifFlag`, `addItem`, `transferMap`, `wait`, `playSound`),
default project path `data/project.json`, save slot label `slot_1`,
key-binding labels.

## Controls

See [`docs/RUNTIME_CONTROLS.md`](RUNTIME_CONTROLS.md).

## Success Criteria

Identical to the criteria in
`docs/agent_prompts/PHASE_2_AUTONOMOUS_IMPLEMENTATION.md` §Phase 2
Success Criteria.
