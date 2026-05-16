# Phase 6 — Tasks

## Slice 1 — data model

- [ ] 1.1 Add TypeScript types for actors, classes, skills, enemies,
      troops, quests, objectives, shops, system, switches, variables,
      common events in `src/types/project.ts`.
- [ ] 1.2 Extend `EventCommand` union with the v1 commands.
- [ ] 1.3 Extend `ProjectData['database']` with optional paths.
- [ ] 1.4 Create `data/database/{system,actors,classes,skills,enemies,troops,quests,shops,switches,variables,commonEvents}.json` with sample defaults.
- [ ] 1.5 Update `data/project.json` to declare the new database paths.
- [ ] 1.6 Extend `BrowserMemoryAdapter` to seed defaults for every database.
- [ ] 1.7 Extend `FullProjectState` with `databases: Record<string, unknown>`.
- [ ] 1.8 Extend `validateProject` to check the new shapes (duplicate ids,
      referential integrity).
- [ ] 1.9 Extend `projectReducer` with `*_DATABASE_ENTRY` actions and
      `UPDATE_SYSTEM_DATA`.
- [ ] 1.10 Update `adapters/jsonUtils.ts` and `JsonImportExportAdapter` to
      include the new shards.
- [ ] 1.11 Extend `src-tauri/src/fs_commands.rs` to read and write the
      `databases` map.
- [ ] 1.12 New vitest cases covering the reducer, validator, and adapter.
- [ ] 1.13 New cargo test that round-trips a project with `databases`.
- [ ] 1.14 Build, test, commit, push.

## Slice 2 — editor database screens

- [ ] 2.1 Add `DatabaseScreen` with tabs for each database.
- [ ] 2.2 Add `SwitchesVariablesScreen`.
- [ ] 2.3 Wire dirty tracking through reducer + Save toolbar.
- [ ] 2.4 Add `database` to `Screen` enum and Sidebar.
- [ ] 2.5 Vitest snapshot/behaviour tests for the screens.
- [ ] 2.6 Build, test, commit, push.

## Slice 3 — event command system v1

- [ ] 3.1 Editor `CommandEditor` gains cards for each new command.
- [ ] 3.2 `flattenCommands` walks `showChoices` branches.
- [ ] 3.3 `MapLoader` and `EventRunner` (C++) parse and execute the new
      commands.
- [ ] 3.4 New vitest + doctest cases per command.
- [ ] 3.5 Build, test, commit, push.

## Slice 4 — switches/variables/branching

- [ ] 4.1 Runtime stores typed switches/variables alongside legacy flags.
- [ ] 4.2 `controlSwitch`, `controlVariable`, `ifSwitch`, `ifVariable`
      runtime + tests.
- [ ] 4.3 `showChoices` runtime: tests choose branch programmatically.

## Slice 5 — quests

- [ ] 5.1 `QuestSystem` in C++.
- [ ] 5.2 Editor quest tab CRUD + objective editor.
- [ ] 5.3 Save/load includes quest state.

## Slice 6 — inventory/gold/party

- [ ] 6.1 `GameState` gains gold and party.
- [ ] 6.2 `addGold`, `removeGold`, `removeItem` runtime.
- [ ] 6.3 Save/load roundtrip.

## Slice 7 — skills/equipment/classes

- [ ] 7.1 Class definition + stat resolver.
- [ ] 7.2 Equipment slot system.
- [ ] 7.3 Editor support.

## Slice 8 — battle v1

- [ ] 8.1 `BattleSystem::run(troopId)`.
- [ ] 8.2 Damage formula tests.
- [ ] 8.3 Reward distribution.
- [ ] 8.4 Editor exposes startBattle command.

## Slice 9 — shops

- [ ] 9.1 `ShopSystem::open(shopId)` runtime stub.
- [ ] 9.2 Editor exposes openShop command and shop list editor.

## Slice 10 — sample game

- [ ] 10.1 Update `data/maps/town.json` and `data/maps/house.json` to
      exercise quest, gold, switch, variable, choice, shop stub, battle.
- [ ] 10.2 Smoke harness exercises the new sample.

## Slice 11 — final validation

- [ ] 11.1 `npx tsc --noEmit`.
- [ ] 11.2 `npx vite build`.
- [ ] 11.3 `npx vitest run`.
- [ ] 11.4 `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- [ ] 11.5 `cargo build --manifest-path src-tauri/Cargo.toml`.
- [ ] 11.6 `scripts\dev\verify-runtime.bat`.
- [ ] 11.7 Tauri content regression check.
- [ ] 11.8 Screenshots in `docs/screenshots/phase-6/`.
- [ ] 11.9 Final commit + push, final report.
