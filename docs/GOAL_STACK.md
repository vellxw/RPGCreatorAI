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

- Slice 3 — Event Editor V2: event pages, page conditions, self switches,
  autorun/parallel scheduler, and command stack editing.
- Slice 4 — Database V2: dedicated tilesets/items/weapons/armors/states/
  types/terms/animations editors and common-event command editing.
- Slice 5 — Runtime MZ foundation: runtime project validator, interactive
  choices, movement routes, event priority/Y-sort, foreground occlusion, and
  local audio v1.
- Slice 6 — Playtest and programmer tools: current map/event playtest,
  integrated logs, event trace, runtime state inspector, and deterministic
  plugin-command v1.

## Closed subgoals

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
