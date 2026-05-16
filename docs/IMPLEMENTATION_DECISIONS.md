# Implementation Decisions — Phase 6

## Schema versioning

- `schemaVersion: 1` is preserved on every existing file. New optional
  fields are added but never required, so old projects keep loading.
- New top-level database files declare `schemaVersion: 1`. Future schema
  changes bump that number; the loader logs a warning and falls back to a
  safe default for unrecognised values.

## Data model topology

- The single `database` field on `project.json` is **extended** with new
  paths instead of being replaced. New paths default to:
  - `actors`        → `data/database/actors.json`
  - `classes`       → `data/database/classes.json`
  - `skills`        → `data/database/skills.json`
  - `enemies`       → `data/database/enemies.json`
  - `troops`        → `data/database/troops.json`
  - `quests`        → `data/database/quests.json`
  - `shops`         → `data/database/shops.json`
  - `system`        → `data/database/system.json`
  - `switches`      → `data/database/switches.json`
  - `variables`     → `data/database/variables.json`
  - `commonEvents`  → `data/database/commonEvents.json`
- Missing paths are tolerated by the loader; a synthetic empty database is
  used in their place so `npm run dev` always starts.
- `items` keeps its existing shape and path.

## Switches and variables

- Switches: `{ "switches": [{ "id": "talked_to_old_man", "name": "...", "initial": false }, ...] }`.
- Variables: `{ "variables": [{ "id": "gold_quest_progress", "name": "...", "initial": 0 }, ...] }`.
- Self switches: stored on the runtime side keyed by `mapId/eventId/A|B|C|D`
  (we use `A` and `B` only in Phase 6).
- The legacy `flags` field in saves is preserved for backward compatibility;
  new switches are merged with it on load.

## Common events

- Stored as a list of `{ id, name, trigger: "manual" | "autorun" | "parallel", commands: [...] }`.
- Phase 6 implements `manual` only; autorun/parallel are validated and stored
  but only execute in a future slice.

## Quests

- A quest is `{ id, title, summary, objectives: [{ id, description }], rewards: { gold, exp, items } }`.
- Runtime tracks `{ quests: { [questId]: { state: "inactive" | "active" | "completed" | "failed", objectives: { [objectiveId]: "open" | "done" } } } }`.

## Battle v1

- Deterministic turn order: party first (in slot order), then enemies (in
  slot order). Each side acts once per round.
- Damage formula: `max(1, attacker.attack * 2 - defender.defense)`.
- Skills use the same formula but multiply by `skill.power / 100`.
- Defeat ends the runtime battle in "defeat" state; the runtime stays at
  the start map (Phase 6 keeps things benign).
- Victory grants gold + exp + items defined on the troop, plus pending
  quest objective updates from the calling event command.

## Shops

- Shops are `{ id, name, listings: [{ itemId, price }] }`.
- Phase 6 implements `openShop(shopId)` as a data-driven stub that logs the
  open event and immediately closes (no persistent shop UI yet). Buying is
  exposed via direct command-level item add + gold subtract until the
  Slice 9 UI lands.

## Path resolution from the renderer

- Database paths are stored in `project.database.<key>` in the renderer
  state but **the on-disk JSON only stores keys, not absolute paths.** The
  Rust shell resolves them relative to the active project root.

## Backward compatibility

- Legacy save slots load: missing fields default to empty maps / 0 gold /
  empty party.
- The C++ runtime keeps using `flags` for boolean state. The renderer
  exposes `switches` to the editor; saving merges them into `flags`.
