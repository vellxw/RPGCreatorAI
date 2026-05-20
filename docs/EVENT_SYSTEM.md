# Event System

The runtime executes event command lists declared in JSON via
`EventRunner`. Commands run sequentially; some commands block the queue
until an external condition advances them.

## Triggers

An `EventData` belongs to a map and has one of these triggers:

| Trigger | Fires when |
|---------|------------|
| `interact` | The player faces the event's cell and presses the interact key. |
| `touch` | The player steps onto the event's cell. |
| `autorun` | Parsed and valid in data; scheduler execution is deferred until Slice 3C. |
| `parallel` | Parsed and valid in data; scheduler execution is deferred until Slice 3C. |

Legacy solid events block movement onto their cell. Non-solid legacy events
are walkable (e.g. door / transfer tiles) and override the collision-layer
tile underneath. Paged events use the active page's priority, solid, and
`through` options; when no page is active, the event does not render or
override the collision tile.

## Event Pages

Events may declare `pages`. A legacy flat event without pages is treated by the
editor as one `page_1` that mirrors the event-level `trigger` and `commands`.
Each page carries conditions, graphic metadata, movement metadata, options,
priority, trigger, and its own command list.

Self switch conditions use letters `A-D` and are scoped as
`mapId:eventId:letter`. `GameState` and `SaveManager` now persist those self
switches.

At runtime, paged events select the last page whose switch, variable, and
self-switch conditions all match. `Game` uses that active page for interact
and touch triggers, command execution, render graphic/animation metadata,
collision priority, and `through`. `autorun` and `parallel` are still parsed
but require the Slice 3C scheduler before they execute automatically.

## Supported Commands

| Command | Fields | Behavior |
|---------|--------|----------|
| `showText` | `text`, optional `speaker` | Opens the dialogue UI. The runner pauses until the player dismisses the dialogue (Enter / Space / E / Esc). |
| `setFlag` | `flag`, `value` (bool) | Sets a boolean flag in `GameState`. |
| `ifFlag` | `flag`, `equals` (bool), `then` (commands), `else` (commands) | Compares the flag with `equals` and pushes the matching branch onto the queue. |
| `controlSelfSwitch` | `switchId` (`A-D`), `value` (bool) | Sets a self switch scoped to the owning map/event captured when the command list starts. |
| `ifSelfSwitch` | `switchId` (`A-D`), `equals` (bool), `then`, `else` | Reads the owning event self switch and pushes the matching branch. |
| `addItem` | `itemId`, `amount` (int) | Increments the inventory counter for `itemId`. |
| `transferMap` | `mapId`, `x`, `y`, `direction` | Produces a `MapTransferRequest` consumed by `Game`. The new map is loaded and the player is placed at `(x, y)` facing `direction`. |
| `wait` | `ms` (int) | Pauses the queue for the given duration. |
| `playSound` | `soundId` | Audio is not implemented in Phase 2; logs `[INFO] playSound: <id>`. |
| `playAnimation` | `target`, optional `eventId`, `action`, `direction`, `durationMs`, `blocking`, `loop` | Emits an `AnimationRequest`. `Game` applies it to the player, the owning event, or a named event. |

Any command type not listed above is logged as a warning and skipped;
this lets later phases extend the system without breaking existing
projects.

## Pause Semantics

`EventRunner::update(dt)` drains the command queue but yields when it
encounters a blocking effect:

- a `showText` opens the dialogue — `update()` returns until
  `DialogueSystem::isActive()` becomes false again,
- a `wait` arms an internal timer that decrements per frame,
- a `transferMap` sets the transfer request — `Game` consumes it,
  reloads the map, and resumes the queue,
- a blocking `playAnimation` emits an animation request and arms the wait
  timer for `durationMs`.

While the runner is busy, player movement and interact input are
blocked.
