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
| Common events | val | yes | yes | yes | yes | yes | Common events reuse the command-stack editor; CP-046 adds owner-aware `callCommonEvent` target editing, empty-branch append coverage, and TS/native rejection of direct self-calls. Runtime scheduling remains covered. |
| Database V2 shared editor framework | val | n/a | yes | n/a | yes | yes | Reusable database layout, list, field, reference-select, and array editor primitives are integrated with tests. |
| Reference repair tools | val | n/a | yes | n/a | yes | yes | CP-047 adds broken-reference detection, same-table replacement options, source-scoped undoable `REPAIR_REFERENCE`, and Validation-panel repair affordances for database, project/map, and event-command refs. |
| Database/system integration gate | val | yes | yes | yes | yes | yes | CP-048 passed the canonical local gate plus browser Database/System smoke, covering frontend, native loader/validator, desktop persistence, runtime smoke, and editor-runtime roundtrip evidence. |
| Asset catalog | val | yes | yes | no | yes | yes | CP-049 adds `data/assets/catalog.json`, `FullProjectState.assets`, browser/import/export and Tauri preservation, Assets workspace list/filter/detail/preview basics, and validation for missing/duplicate/unsafe asset metadata. Runtime does not consume editor-only catalog metadata. |
| Asset metadata editor | val | yes | yes | no | yes | yes | CP-054 adds editable display name, source, tags, provenance, dimensions, runtime compatibility, runtime notes, protected status, and notes for cataloged assets. Asset ids/kind/path stay immutable in the UI; selected asset references are surfaced from the shared reference index. Runtime remains independent of editor-only metadata. |
| Runtime asset export pipeline | val | yes | n/a | yes | yes | yes | CP-055 adds deterministic catalog-to-runtime export for visual assets into BMP outputs, preserves local WAV runtime audio paths, writes a traceable manifest, validates missing outputs, and warns natively when animation clip BMPs are missing before launch. |
| Image import workflow | val | yes | yes | no | yes | yes | CP-050 adds desktop image import for `.png`, `.jpg`, `.jpeg`, `.bmp`, and `.webp` into `assets/imported/images/`, unique catalog entry generation, duplicate filename/id handling, invalid-file errors, browser unavailable feedback, and reducer/UI/Rust helper coverage. |
| Spritesheet import workflow | val | yes | yes | no | yes | yes | CP-051 adds metadata-first spritesheet import into `assets/imported/spritesheets/`, preview before accept, catalog `spritesheet` entries with frame metadata, linked animation set/clip creation, browser unavailable feedback, preview URL support, and frontend/validator/Rust helper coverage. |
| Audio import workflow | val | yes | yes | yes | yes | yes | CP-052 adds desktop `.wav` import into `assets/imported/audio/`, catalog `audio` entries with BGM/SFX usage tags, automatic `system.audio` registration for authoring selectors, browser unavailable feedback, Rust helper tests, and native mock/validator coverage for imported WAV refs. |
| Tileset import workflow | val | yes | yes | no | yes | yes | CP-053 adds metadata-first tileset import into `assets/imported/tilesets/`, preview before accept, catalog `tileset` entries with generated A/B/Region/Collision tile metadata, browser unavailable feedback, project-database visual tile validation, and frontend/validator/Rust helper coverage. Runtime continues to consume tileset database/map data rather than editor-only catalog metadata. |
| Asset library integration gate | val | yes | yes | yes | yes | yes | CP-056 validated catalog, import, metadata, runtime export, desktop helpers, native validation, runtime smoke, and editor-runtime roundtrip together. Milestone 06 is ready for downstream optional AI asset/provider work. |
| Provider settings UI | val | n/a | yes | no | yes | yes | CP-057 adds an implemented Settings workspace for optional provider availability, capabilities, model labels, and missing-credential states. The provider store no longer models `apiKey` values, generation/live-test actions are not exposed, and the native runtime remains provider-independent. CP-058 adds desktop credential save/forget controls without project-data credential storage. |
| Credential storage policy | val | n/a | yes | no | yes | yes | CP-058 adds Windows DPAPI-backed desktop credential blobs under app data, renderer/Rust redaction helpers, browser-unavailable states, and Settings save/forget controls. Commands return metadata only; project JSON and the native runtime remain credential-free. |
| Items, weapons, armors, states | partial | yes | yes | partial | yes | yes | CP-044 polished item/equipment/state authoring with readable item modifier labels, complete weapon/armor modifier grids, row-based traits, TS trait validation, and native pre-launch checks for runtime-consumed item/equipment data. Separated `weapons`, `armors`, and `states` remain editor/validation data; direct runtime equipment/state simulation is future depth. |
| Actors, classes, skills, enemies, troops | partial | yes | yes | partial | yes | yes | Actor/class/skill and enemy/troop authoring polish is complete for current schema; native pre-launch validation now blocks invalid battle-facing enemy ranges. Richer skill runtime behavior remains future depth. |
| Quests, shops, switches, variables, system | partial | yes | yes | partial | yes | yes | Quests, shops, and system defaults are runtime-consumed; CP-045 added reference-safe starting-party editing plus duplicate/empty-party and missing animation-default validation. Switch/variable ids are validated but non-default initial values are not seeded into runtime state yet. |
| Types and terms | val | yes | yes | partial | yes | yes | CP-045 adds standalone Types and Terms tabs with row-based type table editing, terminology editing, visible missing-label warnings, and UI use of the currency term in system defaults. Native runtime remains independent of editor-only labels. |
| Animations | val | yes | yes | yes | yes | yes | Animation database editor, sprite-sheet preview, runtime data, validation, and tests are integrated. |
| Runtime project validator | val | n/a | n/a | yes | yes | yes | Pre-start validator blocks malformed projects before `Game::initialize` with C++ tests and smoke coverage, including battle-facing enemies and runtime-consumed item/equipment data. |
| Save/load | val | yes | n/a | yes | yes | yes | GameState and save migration coverage exists. |
| Battle system v1 | val | yes | partial | yes | yes | yes | Deterministic runtime is covered; richer database authoring remains DB V2 work. |
| Inventory + gold | val | yes | yes | yes | yes | yes | Runtime/menu paths exist; the item editor covers category, price, HP/MP effects, equipment slots, and all stat modifiers with validation for runtime-consumed equipment data. |
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
