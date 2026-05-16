# Phase 6 — Complete RPG Creation System Foundation

## Goal

Make RPGCreatorAI capable of authoring a small but **complete** RPG end-to-end.
The user must be able to:

1. Open or create a project.
2. Edit maps, events, dialogue, items, actors, classes, skills, enemies,
   troops, quests, shops, switches, variables, common events, and system
   settings — all from the editor.
3. Save edits to disk via the desktop shell.
4. Run the C++ runtime and play the project, including dialogue, choices,
   transfers, switches/variables, inventory, gold, party, quests, shops,
   and a turn-based battle.
5. Save and load the runtime state.

Phase 6 is **not** an "everything" phase. It is the first complete vertical
of every RPG-Maker-style subsystem: each system has a schema, an editor
surface, a runtime behaviour, validation, and tests. Polish and content are
deferred to a later phase.

## Out of scope

- Real AI providers (OpenAI / Gemini / NVIDIA) — still mocked.
- Asset pipeline (sprites, audio, tilesets) — placeholder colours stay.
- HD-2D renderer, WebGPU, scripting language, modding API.
- Online publishing, marketplaces, cloud sync, multiplayer.
- GitHub OAuth or any network code.

## Success criteria

- [ ] `npx tsc --noEmit` — exit 0
- [ ] `npx vite build` — exit 0
- [ ] `npx vitest run` — all tests pass; new tests for every new system.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --lib` — pass.
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` — pass.
- [ ] `scripts\dev\verify-runtime.bat` — runtime build + ctest pass.
- [ ] Sample project at `data/` exercises: dialogue, choices, switch, variable,
      quest start/objective/complete, inventory + gold change, shop open
      stub, battle start with rewards, transfer, save/load.
- [ ] Editor screens render: Database (Items, Actors, Classes, Skills,
      Enemies, Troops, Quests, Shops, Switches, Variables, Common Events,
      System), expanded Event Editor, expanded Inspector, and the existing
      Map / Playtest screens unchanged.
- [ ] Documentation updated in `docs/` and `.kiro/specs/phase6-*`.

## Non-negotiables

The architecture rules from `AGENTS.md` still apply:

- The C++ runtime owns no game content. It loads JSON.
- The renderer draws; gameplay logic stays in Game / EventRunner / new systems.
- The editor edits project data only; nothing is hardcoded except sane
  default sample content.
- The shell sandboxes all file I/O.

## Slice plan

The phase is delivered as small recursive slices, each of which is built,
tested, committed, and pushed:

1. **Slice 1 — Data model expansion.** New JSON schemas (actors, classes,
   skills, enemies, troops, quests, shops, system, switches, variables,
   common events). TS types, validators, adapter, Rust shell, reducer.
2. **Slice 2 — Editor database screens.** Tabbed Database screen for the
   new data, Switches/Variables screen, dirty tracking + save.
3. **Slice 3 — Event command system v1.** New commands (showChoices,
   controlSwitch, controlVariable, removeItem, addGold, removeGold,
   wait, comment, callCommonEvent, completeQuest, startQuest,
   updateQuestObjective, openShop, startBattle, changeActorHp,
   setPlayerPosition). Schemas + editor cards + runtime execution.
4. **Slice 4 — Switches, variables, choices, branching.** Branching by
   variable comparison; runtime side; tests.
5. **Slice 5 — Quest system.** Editor + runtime + journal data.
6. **Slice 6 — Inventory, gold, party.** Editor + runtime + save/load
   roundtrip including gold and party state.
7. **Slice 7 — Skills, equipment, classes.** Database editor + runtime
   data; equipment stat modifiers; tests.
8. **Slice 8 — Battle v1.** Enemy / troop database, deterministic damage
   formula, victory/defeat resolution, reward distribution, tests. UI
   placeholder.
9. **Slice 9 — Shops.** openShop runtime stub + buy data layer + tests.
10. **Slice 10 — Sample game.** Mini RPG that exercises the systems.
11. **Slice 11 — End-to-end validation.** All commands run, screenshots
    captured, commit + push.

Slices 4–9 each touch editor, runtime, and tests. None of them should ship
half-implemented.
