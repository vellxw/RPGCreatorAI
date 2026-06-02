# RPG Systems Matrix

Status snapshot of every system targeted by the Phase 10 MVP closeout. The
matrix is conservative: a row only graduates from `partial` to `impl` when
schema, editor, and runtime support are real, and only graduates to `val`
when the relevant validation and automated tests exist.

Legend:

- `n/s` - not started
- `partial` - schema exists, partial editor or runtime
- `impl` - schema, editor, and runtime in place
- `val` - also covered by automated tests

| System | Status | Schema | Editor | Runtime | Validation | Tests | Notes |
|--------|--------|--------|--------|---------|------------|-------|-------|
| Project metadata | val | yes | yes | yes | yes | yes | Visual profiles, map references, and desktop persistence are covered. |
| Maps + map tree | val | yes | yes | yes | yes | yes | Phase 10 Slice 1 map tree and map properties are implemented. |
| Tilesets / sprites | val | yes | yes | yes | yes | yes | Dedicated tileset database editor, tile metadata, map reference validation, and tests are integrated. |
| Visual layers / foreground | val | yes | yes | yes | yes | yes | Runtime renders background visual roles, below/same entities, foreground occluders, above entities, then overlays; collision/region stay non-rendered. |
| Events, pages, and self switches | val | yes | yes | yes | yes | yes | Active-page selection, self switches, and scheduled events are implemented. |
| Event commands baseline | partial | yes | yes | partial | yes | partial | FRA-32 validates the integrated runtime command surface for choices, movement routes, audio requests, and plugin commands; remaining gaps are richer authoring/debug integration. |
| Runtime choices UI | val | yes | yes | yes | yes | yes | `showChoices` now renders selectable runtime options and waits for confirm/cancel results. |
| Movement routes | val | yes | yes | yes | yes | yes | Player, `thisEvent`, and named event routes execute against runtime-only event positions with wait/skippable/repeat guard coverage. |
| Event priority / Y-sort | val | yes | yes | yes | yes | yes | Below/same/above render priority is data-driven from active pages; same-priority entities interleave with the player by foot Y and stable id tie-breaks. |
| Common events | val | yes | yes | yes | yes | yes | Common events reuse the command-stack editor and runtime scheduling remains covered. |
| Database V2 shared editor framework | val | n/a | yes | n/a | yes | yes | Reusable database layout, list, field, reference-select, and array editor primitives are integrated with tests. |
| Items, weapons, armors, states | val | yes | yes | yes | yes | yes | Dedicated V2 forms, type references, numeric validation, and separated equipment shard compatibility are integrated. |
| Actors, classes, skills, enemies, troops | val | yes | yes | yes | yes | yes | Dedicated party/combat V2 forms, reference validation, and tests are integrated. |
| Quests, shops, switches, variables, system | val | yes | yes | yes | yes | yes | Dedicated setup/progression V2 forms, usage warnings, system defaults, and reference validation are integrated. |
| Types and terms | val | yes | yes | partial | yes | yes | Shards persist, validate, and are consumed by V2 editors for typed references and default labels. |
| Animations | val | yes | yes | yes | yes | yes | Animation database editor, sprite-sheet preview, runtime data, validation, and tests are integrated. |
| Runtime project validator | val | n/a | n/a | yes | yes | yes | Pre-start validator blocks malformed projects before `Game::initialize` with C++ tests and smoke coverage. |
| Save/load | val | yes | n/a | yes | yes | yes | GameState and save migration coverage exists. |
| Battle system v1 | val | yes | partial | yes | yes | yes | Deterministic runtime is covered; richer database authoring remains DB V2 work. |
| Inventory + gold | val | yes | partial | yes | yes | yes | Runtime/menu paths exist; dedicated item/system editors remain DB V2 work. |
| Local audio v1 | val | yes | yes | yes | yes | yes | `system.audio` ids/paths, Default BGM, map BGM, and `playSound` references are editable and validated; runtime local WAV dispatch warns and continues when optional files/devices are missing. |
| Deterministic plugin commands | val | yes | yes | yes | yes | yes | `pluginCommand` supports scalar args, typed editor discovery/defaults, map/common-event parsing, registered `debug.log`, `debug.setSwitch`, and `debug.setVariable` validation/dispatch, plus non-fatal unknown-command warnings. |
| Playtest session modes | val | yes | yes | yes | yes | yes | Desktop playtest builds temp project roots for project-start, current-map, and selected-event modes, launches with the temp root as `current_dir`, and preserves source files. |
| Runtime logs, trace, and state snapshots | val | n/a | yes | yes | yes | yes | Bounded native runtime logs, deterministic `[TRACE]` event rows, and local runtime state snapshots are implemented, tested, and exposed in Playtest without runtime-editor IPC. |
| Placeholder AI/debug UI gating | val | n/a | yes | n/a | yes | yes | Bottom-panel generation prompts are removed, primary navigation no longer exposes `AI Tools`, the future workspace is read-only, and automated UI gating coverage locks the MVP surface to validation, logs, traces, and state. |
| Bundled sample MVP coverage | val | yes | n/a | yes | yes | yes | Sample covers choices, self-switch pages, a switch-gated common event, event-target movement, `playSound`, `pluginCommand debug.log`, foreground occlusion, and validation/loader tests. |
| Green-gate scripts and smoke | val | n/a | n/a | yes | yes | yes | Final FRA-35 gate passed with frontend, native, desktop, runtime smoke, and editor-runtime roundtrip validation through canonical `verify.ps1`. |

Rows marked `partial` are intentionally not promoted based on planned work.
They should only move after the corresponding Linear issue is implemented,
validated, documented, committed, pushed, and moved to Done.
