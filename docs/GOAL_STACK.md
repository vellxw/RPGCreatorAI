# Goal Stack — RPGCreatorAI

## Current Goal

Phase 10 — Professional RPG Maker MZ-style editor adaptation — ACTIVE.

## Active Phase

Phase 10 adapts the creator workflow toward a professional RPG
Maker MZ-style editor while keeping RPGCreatorAI local, deterministic,
data-driven, and legally independent. The active priority is editor
ergonomics and data shape: map tree, map properties, tilesets/layers,
event pages, database editors, runtime validation, playtest, and debug
tooling. `docs/GAME_VISUAL_DESIGN.md` remains the visual source of truth.

## Open subgoals (top of stack first)

- Slice 6 — Playtest and debug tools (FRA-24 through FRA-26): event trace,
  runtime state snapshots, and removal/gating of
  placeholder AI debug UI.
- Integration QA — MVP green gate (FRA-27 through FRA-35): bundled sample
  coverage, editor-runtime roundtrip, runtime smoke expansion, canonical
  verification script, feature integration, docs closeout, final report,
  commit, and push.

## Closed subgoals

- Phase 10 PT-002 (FRA-23) — native runtime launches now capture stdout and
  stderr into app-data runtime log files. The desktop bridge exposes only the
  latest log path, a bounded 256 KiB tail read, and an allowlisted log-folder
  opener. The Playtest bottom panel includes a Runtime Log tab, polls while
  the runtime is running, and browser mode reports native logs as unavailable.
- Phase 10 PT-001 (FRA-22) — desktop playtest launch now builds temporary
  project snapshots for project-start, current-map, and selected-event modes
  under the app data directory. Runtime launch uses the temp root as
  `current_dir` while executable lookup remains rooted at the source project,
  so the source project is not mutated and the bridge stays argument-free.
- Phase 10 RT-007 (FRA-21) — deterministic plugin command v1 adds the
  `pluginCommand` data shape with safe `pluginId`, `command`, and scalar
  `args`, editor key/value controls, map/common-event C++ parsing,
  allowlisted runtime dispatch for `debug.log`, `debug.setSwitch`, and
  `debug.setVariable`, plus non-fatal warnings for unknown commands. This is
  registry dispatch only, not scripting or arbitrary code execution.
- Phase 10 RT-006 (FRA-20) — native runtime audio v1 now routes
  `playSound` through `Game` instead of direct `EventRunner` logging.
  `platform/AudioSystem` owns the SDL audio boundary, exposes an injectable
  backend for tests, resolves deterministic local audio ids from defaults and
  project system data, starts default/map BGM requests, plays local WAVs when
  assets/devices exist, and logs warnings while continuing when optional audio
  is missing or unavailable.
- Phase 10 RT-003 (FRA-17) — native runtime movement routes now target the
  player, `thisEvent`, and named events. `MapScene` stores runtime event
  positions separately from authored map JSON, `Game` uses those positions for
  collision/render/event lookup, routes honor blocking, `through`,
  `skippable`, `wait`, and repeat guard behavior, and map transfers re-seed
  runtime event state from the new map.
- Phase 10 RT-004 (FRA-18) — entity snapshots now carry explicit render
  priority. `Game` derives event priority from active event pages with legacy
  fallback, `Renderer2D` draws below, same, and above buckets deterministically,
  and same-priority events interleave with the player by visual foot Y plus
  stable id tie-breaks.
- Phase 10 RT-005 (FRA-19) — runtime map rendering now uses explicit
  background and foreground passes. `MapScene` selects renderable visual layers
  by role, collision/region layers stay non-rendered gameplay/editor data, and
  `Game` draws background, below/same entities, foreground occluders,
  above-priority entities, then overlays.
- Phase 10 MVP-000 (FRA-5) — repository docs now lock the remaining MVP
  closeout scope against Linear issues FRA-6 through FRA-35, including
  Database V2, Runtime MZ foundation, Playtest/Debug tools, Integration QA,
  validation evidence, commit/push, and final reporting expectations.
- Phase 10 Slice 4B — Database V2 types/terms foundation: project data now
  includes `data/database/types.json` and `data/database/terms.json`; the
  TypeScript schema, browser/export/import adapters, desktop Tauri
  save/load, C++ `ProjectLoader`, and editor validation all preserve the new
  shards. Validation now rejects duplicate or unnamed type entries, missing
  default equipment slots, and missing required term labels.
- Phase 10 Slice 4A — Database V2 separated equipment/state foundation:
  weapons, armors, and states are first-class database tables with sample
  data, browser/Tauri round-trip support, validation for duplicate ids,
  editor CRUD tabs, and legacy item migration for older projects that still
  store equipment as item rows.
- Phase 10 Slice 3D command-stack range selection/delete — event command rows
  now have checkbox selection, shift-click range selection within the same
  command-list parent, toolbar and keyboard delete for selected ranges, and
  reducer-level `REMOVE_COMMAND_RANGE` / `REMOVE_PAGE_COMMAND_RANGE` actions
  that preserve page-1 legacy mirroring while no-oping cross-branch endpoints.
- Phase 10 Slice 3D movement-route basics — `setMovementRoute` is now a typed
  event command with editor controls, route-step validation, C++ map/common
  event parsing, `EventRunner` movement-route requests, and deterministic
  player-target execution through existing collision/facing rules. Player
  routes dispatch touch events at destination tiles and `wait: true` blocks
  the issuing runner before tail commands continue. Event-target movement and
  repeat-loop guard behavior were completed later by FRA-17 / RT-003.
- Phase 10 Slice 3D command stack v1 — event command editing now supports
  insert around selection, move up/down, duplicate, local cut/copy/paste,
  delete, and explicit empty branch targets for Then, Else, choice labels,
  Victory, and Defeat. Reducer coverage locks page-1 legacy mirroring and
  nested insertion into conditionals, choices, and battle branches.
- Phase 10 Slice 3C — deterministic scheduled events: `EventScheduler` now
  runs active-page map autorun/parallel events and switch-conditioned
  autorun/parallel common events in separate runner contexts; autorun blocks
  input while parallel waits do not; scheduled runners share runtime
  resolvers; common-event parsing covers self switches and animations; and
  scheduled map transfers preserve the transferring runner until its command
  tail completes.
- Phase 10 Slice 3B — runtime event page activation: C++ runtime now selects
  the active page from last to first by switch, variable, and self-switch
  conditions; `Game` uses active pages for interact/touch triggers, command
  execution, render graphic/animation metadata, collision priority, and
  `through`; inactive paged events do not render or override collision; and
  `EventRunner` executes `controlSelfSwitch` / `ifSelfSwitch` against the
  owning map/event scope captured at command-list start.
- Phase 10 Slice 3A — event page and self-switch foundation: `GameEvent`
  now supports normalized `pages`; the editor can add, update, reorder, and
  edit page-scoped commands; page conditions include self switches A-D; event
  command validation understands `controlSelfSwitch` and `ifSelfSwitch`; the
  C++ map loader accepts both legacy command lists and editor-authored page
  data; `GameState` and saves persist self switches. Runtime page activation
  and self-switch command execution remain the next open slice.
- Phase 10 Slice 2 — map authoring v2: tilesets are data-driven through
  `data/database/tilesets.json`; editor layers cover ground, decoration,
  foreground, collision, region, and events; layer visibility/lock controls
  are available in the palette; locked layers reject paint mutations; region
  painting and region overlays are active; passability overlays read tileset
  metadata; map/project validation detects missing layers, invalid regions,
  unsupported tiles, and unknown tilesets; Tauri and C++ loaders round-trip
  tileset database paths, map tileset ids, display names, and layer metadata.
- Phase 10 Slice 1 — editor shell map tree and professional map properties:
  map references now support `parentId`, `order`, and `expanded`; maps support
  display name, tileset, scroll, encounter, battleback, parallax, and layer
  role metadata; the editor has a visible map tree with create, duplicate,
  delete, reorder, expand/collapse, child map creation, and rename via
  double-click; placeholder controls for unreal AI/debug/event-page flows were
  removed until implemented.
- Phase 9 hotfix validation baseline — recorded validation for commit
  `13f6545` on the Phase 10 branch before starting Phase 10 work.
- Phase 9 hotfix — character sheets now render at `display.heightTiles`
  instead of padded tile interiors; runtime/editor both use bottom-center
  character anchoring; `playerMovementSpeed` and
  `defaultCharacterHeightTiles` are editable system data; event
  `displayHeightTiles` overrides are validated; editor playtest memoizes
  static SVG layers and starts/chains held movement without a dead frame.
- Phase 9 implementation slice — input now uses held movement in the
  native runtime and editor playtest preview; player rendering follows a
  transient interpolated position while GameState remains tile-based;
  animation sets are data-driven through `data/database/animations.json`;
  `playAnimation` commands are validated and applied by `Game`; generated
  player/NPC animation sheets, prompts, manifests, and preview GIFs are
  versioned.
- Slice 11 — end-to-end visual QA closeout with committed editor/runtime
  evidence, full-bleed visual tile regression coverage, corrected runtime
  screenshot tooling, final validation, and phase documentation.
- Slice 10 — runtime UX regression pass under the widescreen visual
  standard; existing inventory, party, quest, save/load, shop, and battle
  reward surfaces verified intact on the upgraded sample.
- Slice 9 — layer-aware map authoring with brush sizing, fill, rectangle,
  eraser, selected-tile preview, map resizing, and viewport preset controls.
- Slice 8 — runtime-like playtest framing, project-seeded preview state,
  and editor collision overlays that expose truth without replacing the
  authored visual layer.
- Slice 7 — runtime authored-blocker rendering, widened smoke traversal,
  and validated native widescreen scene playback on the upgraded sample.
- Slice 6 — reusable authored starter scenes, in-editor template application,
  and a bundled widescreen sample project replacing the old tiny-board
  default.
- Slice 5 — deterministic supplementary visual assets for authored scenes:
  snow, tree, interior surfaces, collision/void overlays, and shop/battle
  markers shared by editor and runtime.
- Slice 4 — explicit visual/collision tile validation, editor-side void
  treatment, and runtime nearest-neighbor tile rendering defaults.
- Slice 3 — editor scene-stage sizing, fit/100% controls, map bounds,
  camera rail, and viewport-frame overlays.
- Slice 2 — shared viewport helpers, project-driven runtime resolution,
  and clamped camera model.
- Slice 1 — visual source of truth, QA rubric, phase reset, and
  backward-compatible project visual profile. Commits `38926b9`,
  `2135017`.
- Phase 7 — Polished creator-to-player loop — DONE (`f951dd6`).
- Phase 6 — Complete RPG Creation System Foundation — DONE (`a12efa8`).
- Slice 0 — original asset foundation (generated atlases, editor assets,
  runtime sprites, emoji replacement). Commit `0012eca`.
- Slice 1 — runtime pause / main menu skeleton (menu state machine wired
  into `Game`, HUD/menu rendering, keyboard navigation tests). Commit
  `0012eca`.
- Slice 2 — runtime inventory / party / quest views (real item
  descriptions plus render-ready menu snapshots). Commit `19c1c6c`.
- Slice 3 — save/load slot picker metadata (centralized `SaveManager`
  slot listing consumed by the runtime menu). Commit `19c1c6c`.
- Slice 4 — shop UI (modal buy flow, gold checks, owned counts, runtime
  rendering). Commit `0681487`.
- Slice 5 — battle result UI (summary handoff, paused event continuation,
  reward screen). Commit `0681487`.
- Slice 6 — undo / redo history (toolbar buttons + keyboard shortcuts,
  paint / drag stroke coalescing). Commits `332a73f`, `98a31a8`.
- Slice 7 — map tile and collision painting (palette-driven brush workflow).
  Commit `332a73f`.
- Slice 8 — event placement, drag/move, duplicate, delete, `Ctrl+D`,
  and confirmation prompts. Commits `332a73f`, `98a31a8`.
- Slice 9 — editor → save → runtime round-trip QA, native screenshots,
  and live browser verification. Commit `98a31a8`.
- Slice 10 — final validation, docs, phase report, and clean handoff.
  Closed by the phase-completion commit.
- Slice 1 — data model expansion (schemas, types, JSON files, validators,
  Rust shell round-trip, vitest + cargo coverage). Commit `7936b8f`.
- Slice 2 — Database editor screen with tabs, CRUD, dirty tracking.
  Commit `7936b8f`.
- Slice 3 — runtime event command system v1 (24 commands). Commit
  `46d2726`.
- Slice 4 — typed switches/variables, ifSwitch/ifVariable, showChoices.
  Commit `46d2726`.
- Slice 5 — quest system runtime + save/load + idempotency. Commit
  `46d2726`.
- Slice 6 — gold + party + actor HP + inventory remove. Commit `46d2726`.
- Slice 7 — runtime DB loader, equipment stat modifiers in battle.
  Commit `d4fec32`.
- Slice 8 — battle system v1 (deterministic, formula tested, rewards).
  Commit `d4fec32`.
- Slice 9 — shops (data round-trip + dialogue-stub runtime). Commit
  `d4fec32`.
- Slice 10 — sample town/house exercising every v1 command. Commit
  `6c27308`.
- Slice 11 — Phase 6 final validation + reporting. Commit `a12efa8`.

## Closed subgoals from previous phases

- Phase 5: Desktop shell + filesystem + runtime bridge — DONE (`6665220`).
- Phase 4.1: Validation hardening — DONE (`3303cab`).
- Phase 4: Editor persistence + runtime bridge — DONE (`da0b7bc`).
- Phase 3: Visual editor MVP — DONE (`4493309`).
- Phase 2: Visible playable RPG runtime — DONE (`148dc13`).
- Phase 1: Bootstrap — DONE (`41273a8`).

## Persistence rule

This file is the source of truth for the active phase. It is updated at
each slice boundary, **not** based on chat memory.
