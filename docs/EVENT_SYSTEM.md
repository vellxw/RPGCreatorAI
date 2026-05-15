# Event System

Events are defined inside Map JSONs. They consist of a trigger and an array of commands.

## Triggers
- `interact`: Triggered when the player presses the action bean facing the event.
- `touch`: Triggered when the player steps on the event tile.

## Supported Commands (Phase 1)
- `showText`: Displays dialogue.
- `setFlag`: Modifies a boolean flag.
- `ifFlag`: Conditional branching based on a flag.
- `addItem`: Adds an item to the inventory.
- `transferMap`: Teleports the player to another map.
- `wait`: Pauses event execution.
- `playSound`: Stub for playing audio.

State is kept in `GameState`. The `EventRunner` is responsible for processing these commands sequentially and supporting blocking operations like 'wait' or 'showText'.
