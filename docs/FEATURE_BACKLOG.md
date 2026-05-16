# Feature Backlog

Phase 6 backlog. Items leave this list only when the matching slice is
merged and validated.

## Slice 1 — data model

- [ ] `data/database/system.json` with starting party, gold, font, BGM defaults.
- [ ] `data/database/actors.json` with at least one default actor.
- [ ] `data/database/classes.json` with one starting class.
- [ ] `data/database/skills.json` with one starting attack skill.
- [ ] `data/database/enemies.json` with one slime/goblin enemy.
- [ ] `data/database/troops.json` with one starter troop.
- [ ] `data/database/quests.json` with one starter quest.
- [ ] `data/database/shops.json` with one shop.
- [ ] `data/database/switches.json` with the existing flags promoted.
- [ ] `data/database/variables.json`.
- [ ] `data/database/commonEvents.json`.
- [ ] TypeScript types for all of the above.
- [ ] Validators for each (referential integrity).
- [ ] BrowserMemoryAdapter loads everything.
- [ ] Rust shell preserves all database files round-trip.
- [ ] `projectReducer` accepts updates to each database.
- [ ] Vitest coverage for adapter + reducer + validators.

## Slice 2 — editor

- [ ] Database screen with tabs.
- [ ] Switches & Variables panel.
- [ ] CRUD (add/duplicate/delete/edit) for each database.
- [ ] Dirty tracking flows through the existing top toolbar Save button.

## Slice 3 — commands v1

- [ ] showChoices, controlSwitch, controlVariable, removeItem, addGold,
      removeGold, comment, callCommonEvent, startQuest, completeQuest,
      updateQuestObjective, openShop, startBattle, changeActorHp,
      setPlayerPosition — schemas, editor cards, runtime execution.

## Slice 4 — branching

- [ ] showChoices runtime + tests.
- [ ] If-variable / if-switch.

## Slice 5 — quests

- [ ] Quest journal data structure.
- [ ] Quest event command runtime.

## Slice 6 — inventory / gold / party

- [ ] Gold in GameState + save/load.
- [ ] Party in GameState + save/load.
- [ ] Per-item count and type (consumable / weapon / armor / key).

## Slice 7 — skills / equipment / classes

- [ ] Equipment slot system.
- [ ] Skill list per actor.

## Slice 8 — battle v1

- [ ] Battle data flow (turn order, deterministic damage formula).
- [ ] Reward distribution.
- [ ] Tests for damage and reward math.

## Slice 9 — shops

- [ ] openShop event command runtime.
- [ ] Buy flow (data layer).

## Slice 10 — sample game

- [ ] Town -> NPC quest giver -> chest reward -> shop -> first battle -> back to town.

## Slice 11 — validation

- [ ] Frontend tests pass.
- [ ] Rust tests pass.
- [ ] C++ tests pass.
- [ ] Tauri content regression check passes.
- [ ] Runtime smoke pass.
- [ ] Screenshots in `docs/screenshots/phase-6/`.
- [ ] Final commit + push.
