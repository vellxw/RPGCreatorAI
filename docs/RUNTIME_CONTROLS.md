# Runtime Controls

| Action | Keys |
|--------|------|
| Move up | `W` / `↑` |
| Move down | `S` / `↓` |
| Move left | `A` / `←` |
| Move right | `D` / `→` |
| Interact / Advance dialogue | `E` / `Enter` / `Space` |
| Close dialogue | `Esc` |
| Save (slot_1) | `F5` |
| Load (slot_1) | `F9` |
| Quit | Close window |

## Movement Rules

- Grid-based: one tile per key press (key must be released and pressed
  again to move another tile).
- Direction always updates on a movement key, even when blocked.
- Movement is blocked by:
  - the collision layer (tile value `9`),
  - map bounds,
  - solid events at the target cell.
- Stepping onto an event with `trigger: "touch"` runs its commands.
- Pressing the interact key runs commands of an event with
  `trigger: "interact"` on the cell directly in front of the player.

## Dialogue Rules

- A `showText` command opens a dialogue box and pauses the event queue.
- The player must press an advance key (Enter/Space/E) or close key
  (Esc) to dismiss.
- Movement input is ignored while a dialogue is active.

## Save / Load

- Save is written to `saves/slot_1.json`.
- Save data: current map id, player x/y/direction, flags, variables,
  inventory.
- Loading restores all of the above and reloads the current map.
