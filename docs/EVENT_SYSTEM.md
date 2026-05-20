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

Solid events block movement onto their cell. Non-solid events are
walkable (e.g. door / transfer tiles) — the event's `solid` flag overrides
the collision-layer tile underneath.

## Event Pages

Events may declare `pages`. A legacy flat event without pages is treated by the
editor as one `page_1` that mirrors the event-level `trigger` and `commands`.
Each page carries conditions, graphic metadata, movement metadata, options,
priority, trigger, and its own command list.

Self switch conditions use letters `A-D` and are scoped as
`mapId:eventId:letter`. `GameState` and `SaveManager` now persist those self
switches. Runtime active-page selection and autorun/parallel scheduling are
the next Slice 3 runtime step; this cut establishes the data, editor, loader,
and save foundations.

## Supported Commands

| Command | Fields | Behavior |
|---------|--------|----------|
| `showText` | `text`, optional `speaker` | Opens the dialogue UI. The runner pauses until the player dismisses the dialogue (Enter / Space / E / Esc). |
| `setFlag` | `flag`, `value` (bool) | Sets a boolean flag in `GameState`. |
| `ifFlag` | `flag`, `equals` (bool), `then` (commands), `else` (commands) | Compares the flag with `equals` and pushes the matching branch onto the queue. |
| `controlSelfSwitch` | `switchId` (`A-D`), `value` (bool) | Data/editor command is supported; runtime execution follows with active-page scheduling. |
| `ifSelfSwitch` | `switchId` (`A-D`), `equals` (bool), `then`, `else` | Data/editor command is supported; runtime execution follows with active-page scheduling. |
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
