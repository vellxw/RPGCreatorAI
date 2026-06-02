# Phase 11 CP-038 — Save/Load UX And Runtime Slot Polish

CP-038 improves runtime save/load recoverability without moving gameplay rules
into persistence. `SaveManager` still serializes/deserializes `GameState` only;
`Game` remains responsible for applying a loaded state, loading the referenced
map, and updating runtime presentation.

## Runtime Slot States

The runtime supports three menu slots:

| State | Menu behavior | Load behavior |
|-------|---------------|---------------|
| Empty | Displayed as `Slot N   Empty`; disabled on Load | No load action is emitted; feedback says the slot is empty. |
| Loadable | Displays map id, gold, party ids, and date | `Game` applies the loaded `GameState` and reloads the saved map. |
| Corrupt/unsupported | Displayed as `Slot N   Corrupt`; disabled on Load | No load action is emitted; feedback explains the save-file problem. |

Corrupt includes invalid JSON, missing required save envelope fields, invalid
player direction, or unsupported future `schemaVersion` values.

## Persistence API

- `SaveManager::saveDetailed` returns a path and write error while the existing
  `save` bool remains available for older callers.
- `SaveManager::loadDetailed` returns `Loaded`, `Missing`, `Invalid`, or
  `UnsupportedVersion` plus an actionable message. The existing optional
  `load` wrapper remains available for older callers.
- `SaveManager::listSlots` reports `exists`, `loadable`, `corrupt`, `detail`,
  map id, gold, party ids, and modified time for menu rendering.

## Validation

Coverage locks:

- legacy v1 saves still migrate with sane defaults,
- malformed JSON and future schemas fail with explicit statuses,
- corrupt slots are visible but not loadable,
- the runtime menu does not emit a load action for empty or corrupt slots,
- runtime smoke still exercises save/load through the native menu path.
