# Runtime Controls

| Action | Keys |
|--------|------|
| Move up | `W` / `↑` |
| Move down | `S` / `↓` |
| Move left | `A` / `←` |
| Move right | `D` / `→` |
| Interact / Advance dialogue | `E` / `Enter` / `Space` |
| Close dialogue | `Esc` |
| Navigate choice/menu rows | `W` / `S` / `↑` / `↓` |
| Confirm choice/menu row | `E` / `Enter` / `Space` |
| Cancel choice/menu/dialogue | `Esc` / `Backspace` |
| Save (slot_1) | `F5` |
| Load (slot_1) | `F9` |
| Quit | Close window |

## Movement Rules

- Grid-based logic with smooth visual movement: hold a movement key to
  keep walking tile by tile. The bundled sample defaults to
  `playerMovementSpeed: "double"` (`8 tiles/s`, `125 ms/tile`) so input
  feels immediate; `"normal"` remains available as `4 tiles/s`.
- Movement speed is data-driven through `data/database/system.json`.
  Supported tiers are `oneEighth`, `oneQuarter`, `half`, `normal`,
  `double`, and `quadruple`.
- Saves, collision, touch events, and transfers still use logical tile
  coordinates. The transient interpolated pixel position is render-only.
- Diagonal movement is not supported; the first active direction in the
  input priority order is used.
- Direction always updates on a movement key, even when blocked.
- Movement is blocked by:
  - the collision layer (tile value `9`),
  - map bounds,
  - solid events at the target cell.
- Stepping onto an event with `trigger: "touch"` runs its commands.
- Pressing the interact key runs commands of an event with
  `trigger: "interact"` on the cell directly in front of the player.
- `isPressed` / held state drives movement. `isJustPressed` remains for
  interactions, menu commands, save/load, and dialogue advancement.

## Dialogue Rules

- A `showText` command opens a dialogue box and pauses the event queue.
- The player must press an advance key (Enter/Space/E) or close key
  (Esc) to dismiss.
- A `showChoices` command opens a selectable prompt and pauses the event
  queue until the player confirms or cancels.
- Movement input is ignored while a dialogue or choice prompt is active.

## Event-Driven Runtime Actions

- Movement routes, audio requests, foreground occlusion, and plugin commands
  are triggered by project event data. They do not add separate player
  controls.
- The MVP runtime smoke path verifies choice confirmation, event-target
  movement, a local `chest_open` audio request, foreground occlusion, and
  `pluginCommand debug.log` output together.

## Save / Load

- Save is written to `saves/slot_1.json`.
- Save data: current map id, player x/y/direction, flags, variables,
  inventory.
- Loading restores all of the above and reloads the current map.
