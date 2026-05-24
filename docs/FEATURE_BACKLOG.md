# Feature Backlog

Phase 6 backlog. Items leave this list only when the matching slice is
merged and validated.

## Slice 1 — data model — DONE

- [x] `data/database/system.json` with starting party, gold, font, BGM defaults.
- [x] `data/database/actors.json` with at least one default actor.
- [x] `data/database/classes.json` with one starting class.
- [x] `data/database/skills.json` with one starting attack skill.
- [x] `data/database/enemies.json` with one slime/goblin enemy.
- [x] `data/database/troops.json` with one starter troop.
- [x] `data/database/quests.json` with one starter quest.
- [x] `data/database/shops.json` with one shop.
- [x] `data/database/switches.json` with the existing flags promoted.
- [x] `data/database/variables.json`.
- [x] `data/database/commonEvents.json`.
- [x] TypeScript types for all of the above.
- [x] Validators for each (referential integrity).
- [x] BrowserMemoryAdapter loads everything.
- [x] Rust shell preserves all database files round-trip.
- [x] `projectReducer` accepts updates to each database.
- [x] Vitest coverage for adapter + reducer + validators.

## Slice 2 — editor — DONE

- [x] Database screen with tabs.
- [x] Switches & Variables panel.
- [x] CRUD (add/duplicate/delete/edit) for each database.
- [x] Dirty tracking flows through the existing top toolbar Save button.

## Slice 3 — commands v1 — DONE

- [x] showChoices, controlSwitch, controlVariable, removeItem, addGold,
      removeGold, comment, callCommonEvent, startQuest, completeQuest,
      updateQuestObjective, openShop, startBattle, changeActorHp — schemas,
      editor cards, runtime execution.

## Slice 4 — branching — DONE

- [x] showChoices runtime + tests.
- [x] If-variable / if-switch.

## Slice 5 — quests — DONE

- [x] Quest journal data structure.
- [x] Quest event command runtime.

## Slice 6 — inventory / gold / party — DONE

- [x] Gold in GameState + save/load.
- [x] Party in GameState + save/load.
- [x] Per-item count and type (consumable / weapon / armor / key).

## Slice 7 — skills / equipment / classes — DONE

- [x] Equipment slot system (stat modifiers via item.modifiers consumed in battle).
- [x] Skill list per actor (database side; battle skill use deferred to Phase 7).

## Slice 8 — battle v1 — DONE

- [x] Battle data flow (turn order, deterministic damage formula).
- [x] Reward distribution.
- [x] Tests for damage and reward math.

## Slice 9 — shops — DONE

- [x] openShop event command runtime.
- [x] Buy flow (data layer round-trip; UI menu lands Phase 7).

## Slice 10 — sample game — DONE

- [x] Town -> NPC quest giver -> chest reward -> shop -> first battle -> back to town.

## Slice 11 — validation — DONE

- [x] Frontend tests pass.
- [x] Rust tests pass.
- [x] C++ tests pass.
- [x] Tauri content regression check passes.
- [x] Runtime smoke pass.
- [x] Screenshots captured for the completed runtime/editor phases.
- [x] Final commit + push.

## Phase 7 — polished creator-to-player loop — DONE

- [x] Original asset pipeline replacing production emoji placeholders and
      rectangle-only runtime sprites.
- [x] Runtime pause menu, inventory UI, party/status UI, quest journal.
- [x] Shop menu UI with gold checks.
- [x] Battle result / reward screen.
- [x] Save/load slot picker.
- [x] Tile painting, collision painting, event placement/move/duplicate/delete.
- [x] Undo/redo, save-to-disk path, runtime launch, and round-trip proof.

## Phase 8 candidates

- Skill use in battle (currently each combatant attacks).
- [x] Autorun and parallel common events with switch conditions.
- [x] Self switches (per-event A/B/C/D).
- Real audio playback / BGM / SFX asset management.
- Richer battle presentation if a later polish pass wants it.
