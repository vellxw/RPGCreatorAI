# Requirements — Phase 10 Professional MZ-style Editor

## Goal

Adapt RPGCreatorAI into a professional RPG Maker MZ-style creation workflow
without copying proprietary assets, formats, or runtime dependencies.

## Functional Requirements

1. The editor shall expose a persistent map tree backed by project data.
   Map references shall support `parentId`, `order`, and `expanded`.
2. The editor shall support create, duplicate, delete, rename, reorder, and
   child-map operations without corrupting existing maps.
3. Maps shall support professional properties: display name, tileset id,
   scroll type, battleback, encounter step count, encounter list, parallax,
   and layer role/visibility/lock metadata.
4. Tilesets shall be loaded from project/database data, with authored groups,
   tile metadata, passability, terrain tags, flags, and visual priority.
5. Newly created maps shall include authoring layers for ground, decoration,
   foreground, collision, and region.
6. The map editor shall support selecting visible authoring layers, locking
   layers against paint edits, region painting, and passability overlays.
7. Project validation shall detect duplicate map references, missing map data,
   missing parents, cyclic parent chains, and orphan loaded maps.
8. Map validation shall detect missing required authoring layers, unknown
   tileset references, unsupported visual/collision tiles, and invalid region
   ids.
9. Runtime loaders shall parse map tileset ids, display names, layer metadata,
   and database tilesets.
10. Desktop persistence shall round-trip map-tree metadata and tileset database
   shards.
11. Events shall support optional `pages` while preserving legacy top-level
   `trigger` and `commands` for old projects and the current runtime bridge.
12. Event pages shall include conditions, graphic, movement, options, priority,
   trigger, and command lists.
13. The editor shall expose page tabs, page ordering, page settings, self
   switch conditions, and page-scoped command editing.
14. Runtime state shall store self switches scoped by map id, event id, and
   switch letter `A-D`, and save/load shall round-trip them.
15. Runtime map loading shall parse both legacy flat events and editor-authored
   event pages without rejecting old projects.
16. Runtime event dispatch shall select the active page by switch, variable,
   and self-switch conditions before evaluating trigger, collision, graphics,
   or commands.
17. `EventRunner` shall execute `controlSelfSwitch` and `ifSelfSwitch` against
   the owning map/event scope.
18. Toolbar and inspector buttons that imply unimplemented workflows shall be
   removed or disabled until real behavior exists.
19. Runtime scheduling shall execute active-page map events with `autorun` and
    `parallel` triggers through runner contexts separate from the interactive
    event runner.
20. Common events with `autorun` or `parallel` triggers shall require a known
    condition switch and shall run only while that switch is ON.
21. Event command stacks shall support insertion around selected commands,
    movement within the current sibling list, duplication, local cut/copy/paste,
    single/range deletion, and insertion into empty conditional/choice/battle
    branches.
22. Event command data shall support `setMovementRoute` with route target
    metadata, repeat/skippable/wait flags, ordered move/turn/wait steps,
    editor-side validation, C++ map/common-event parsing, and deterministic
    runtime execution for player-target routes.

## Phase 10 MVP Closeout

The Phase 10 MVP closeout is tracked by Linear issues `FRA-5` through
`FRA-35` in the `RPGCreatorAI Usable MVP` project. The following outcomes
are P0 unless explicitly marked otherwise:

1. Database V2 shall expose reusable editor primitives and dedicated editors
   for tilesets, items, weapons, armors, states, actors, classes, skills,
   enemies, troops, quests, shops, switches, variables, system data, common
   events, and animations.
2. Database delete and rename actions shall surface reference safety warnings
   before users can break maps, event commands, runtime references, or sample
   project data.
3. The native runtime shall validate project data before startup and fail
   early with actionable errors instead of launching malformed projects.
4. Runtime choices shall be visible and interactively selectable. Event
   execution shall resume from the selected branch, not from a default-first
   fallback.
5. Movement routes shall support event targets in addition to the player while
   keeping mutable runtime positions separate from authored map JSON.
6. Runtime event rendering shall support below/same/above priority, same-layer
   Y-sort ordering, and foreground layer occlusion.
7. Local audio v1 shall load project-owned BGM/SFX metadata and perform
   deterministic, local playback or explicit logged skips when audio is
   unavailable.
8. Deterministic plugin command v1 shall support allowlisted commands such as
   `debug.log`, `debug.setSwitch`, and `debug.setVariable` without adding a
   scripting VM or arbitrary code execution.
9. Playtest shall support project-start, current-map, and selected-event
   sessions by writing temporary project roots under the app data directory
   without mutating source project files.
10. The editor shall expose bounded native runtime logs, validation output,
    event trace output, and runtime state snapshots from the playtest surface.
11. Placeholder AI/debug UI that advertises unavailable generation or
    explanation features shall be removed or gated before MVP release.
12. The bundled sample shall exercise the MVP runtime/editor feature set:
    choices, event pages/self switches, scheduled common events, event-target
    movement, foreground occlusion, local audio request, plugin command,
    database references, playtest modes, and validation.
13. The MVP green gate shall provide one canonical verification path covering
    frontend typecheck/tests/build, C++ configure/build/tests, Rust tests,
    Tauri content verification, runtime smoke, and editor-runtime roundtrip.
14. MVP documentation shall describe the real local workflow for opening,
    editing, validating, saving, playtesting, launching, debugging, and
    smoke-testing projects.

## Non-Goals

- No RPG Maker proprietary file formats or assets.
- No general scripting VM.
- No AI runtime dependency.
- No AI runtime provider layer.
- No marketplace.
- No network or cloud storage.
- No autotile rules in Slice 2.
- No proprietary RPG Maker compatibility target.
- No installer polish beyond the current Tauri debug/dev build.
- No autonomous event movement outside deterministic event-command movement
  routes in this MVP.
