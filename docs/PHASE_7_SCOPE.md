# Phase 7 — Runtime UX & Map Creation Workflow

## Goal

Make every existing RPG system from Phase 6 visible and usable to a real
creator and a real player, without expanding the engine horizontally.

After Phase 6 the data layer is complete: maps, events, dialogue,
choices, switches/variables, quests, items, gold, party, classes,
skills, equipment, enemies, troops, shops, deterministic battles, and
save/load all work and are tested. What is missing is the **UX surface**
that lets a player see and act on those systems, and the **authoring
surface** that lets a creator build a map without writing JSON by hand.

Phase 7 is the bridge between "all the systems exist" and "a creator
can build, run, and feel a small RPG".

## What Phase 7 delivers

Two parallel tracks plus a closing E2E proof.

### Runtime UX track

- **Pause / main menu** — opens on `Escape`, pauses everything, lists
  Inventory, Party, Quests, Save, Load, Close.
- **Inventory UI** — every owned item with name, amount, and
  description. Deterministic ordering. Safe on missing metadata.
- **Party / status UI** — actor name, class, level, HP/MP, equipment,
  resolved stats. Matches the `BattleSystem` resolver.
- **Quest journal UI** — Active / Completed / Failed groups, per-objective
  bullets, joined against the quests database.
- **Shop UI** — replaces the Phase 6 dialogue stub. Real listings, real
  buy flow with insufficient-gold handling, atomic gold + inventory
  updates, resumes the EventRunner cleanly.
- **Battle UI improvements** — combatants with HP bars, turn log,
  outcome banner, rewards summary. Driven by a deterministic resolver
  that pre-computes turns from the existing math.
- **Save / load slot picker** — at least 3 slots, human-readable
  metadata (`map · gold · party · timestamp`), overwrite confirm,
  empty-slot disable on Load.

### Map creation workflow track

- **Tile painting** — palette entries bind to integer tile ids; click
  and drag paints; eraser clears.
- **Collision painting** — separate edit mode that toggles the
  `collision` layer between `0` and `9`.
- **Event placement / move / duplicate / delete** — full lifecycle on
  the canvas, with `Ctrl+D` and `Delete` shortcuts and a confirm prompt
  for delete.
- **Editor undo / redo** — `Ctrl+Z` and `Ctrl+Y` / `Ctrl+Shift+Z`,
  bounded to 100 entries, with stroke coalescing for paint drags.

### E2E proof

- A documented, reproducible flow: edit map in the editor → save → launch
  runtime → see the change.
- A scripted vitest harness that exercises the round-trip in memory.
- Manual screenshots from a real session under `docs/screenshots/phase-7/`,
  with any environment limitations documented honestly.

## Out of scope

- New RPG systems (no self-switches runtime, no autorun/parallel common
  events runtime, no new event commands).
- AI providers, prompt UIs, generation tooling.
- Asset pipeline (sprites, audio, tilesets stay at colored-rectangle
  level).
- HD-2D renderer, WebGPU, scripting language, modding API.
- Online publishing, marketplaces, cloud sync, multiplayer.
- Editor-side battle previewer or troop simulator.
- Animated tile transitions, lighting, weather.
- "Use item from menu" — selecting an inventory item only shows its
  description in v1.
- Per-actor skill selection in battle — combatants still auto-attack.

## Success criteria

- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npx vite build` exits 0.
- [ ] `npx vitest run` passes; new tests cover paint reducer, history
      middleware, event lifecycle reducer, slot metadata builder, shop
      buy paths.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --lib` passes.
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` passes.
- [ ] `scripts\dev\verify-runtime.bat` passes; new doctests cover
      `MenuSystem`, `ShopMenuSystem`, `BattleUI`, and `SaveManager
      ::listSlots`.
- [ ] `scripts\dev\smoke-runtime.bat` passes against the bundled
      sample.
- [ ] The pause menu opens, navigates through every sub-screen, and
      saves/loads via the slot picker.
- [ ] The shop UI replaces the Phase 6 dialogue stub.
- [ ] A real creator can paint terrain, toggle collisions, place / move
      / duplicate / delete events, and undo / redo their work.
- [ ] `docs/EDITOR_RUNTIME_E2E_QA.md` documents the round-trip and the
      vitest harness reproduces the data round-trip in CI.
- [ ] `docs/PHASE_7_VALIDATION_REPORT.md` summarises the run.
- [ ] `docs/RPG_SYSTEMS_MATRIX.md` updated.
- [ ] `docs/GOAL_STACK.md` updated.

## Non-negotiables

The architecture rules from `AGENTS.md` continue to apply unchanged:

- The C++ runtime owns no game content. It loads JSON.
- The renderer draws; gameplay logic stays in `Game` and the new menu
  state machines (`MenuSystem`, `ShopMenuSystem`, `BattleUI`).
- The editor edits project data only; nothing is hardcoded except sane
  defaults.
- The shell sandboxes file I/O.

## Slice plan

The phase is delivered as 10 vertical slices (see
`.kiro/specs/phase7-runtime-ux-map-workflow/tasks.md`):

1. Pause / main menu skeleton.
2. Inventory + Party + Quests views.
3. Save / load slot picker.
4. Shop UI.
5. Battle UI.
6. Editor undo / redo + history middleware.
7. Tile painting + collision painting.
8. Event place / move / duplicate / delete.
9. End-to-end editor → runtime QA.
10. Final validation + report.

## Why this phase

Phase 6 closed with a working RPG creation system, but a creator using
the editor today still hits walls: there is no in-game menu, the tile
palette doesn't paint, events can only be re-arranged through JSON or
the inspector, and undo doesn't exist. A player launching the runtime
sees dialogue and movement but no inventory, no quest journal, and a
debug-line shop.

Phase 7 fills exactly those gaps and nothing else. After it, the engine
is ready for a creator-to-player loop demo, and the foundation is in
place for later phases to layer richer authoring tools, real assets,
and (eventually) the AI provider hub above the engine — never inside
it.
