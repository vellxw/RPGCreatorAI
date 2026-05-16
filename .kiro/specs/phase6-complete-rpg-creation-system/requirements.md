# Phase 6 — Requirements

## Introduction

RPGCreatorAI evolves into a complete RPG creation system. The user can
build a small but full RPG end-to-end: maps, events, dialogue, choices,
switches/variables, quests, items, party, stats, battles, shops, and
save/load — all data-driven and validated.

## Requirements

### R1 — Project data model expansion

**User story:** As a creator, I want my project to support all the data
needed for a complete RPG, so I can edit it without writing C++.

#### Acceptance Criteria

1. WHEN the user opens the editor THEN the project bundle SHALL include
   schemas for actors, classes, skills, enemies, troops, quests, shops,
   system settings, switches, variables, and common events.
2. WHEN any database file is missing on disk THEN the loader SHALL provide
   a safe empty default and continue without crashing.
3. WHEN the user saves THEN every database SHALL be persisted with valid
   JSON; pre-existing files SHALL be backed up first.
4. The renderer adapter, the Rust shell, and the C++ runtime SHALL agree
   on file paths declared in `project.database`.

### R2 — Editor surface for the new databases

**User story:** As a creator, I want a UI to edit each database, so I can
manage all RPG content without touching JSON.

#### Acceptance Criteria

1. WHEN the user opens the Database screen THEN the editor SHALL show one
   tab per database (Items, Actors, Classes, Skills, Enemies, Troops,
   Quests, Shops, System, Common Events).
2. WHEN the user edits any field THEN the project SHALL be marked dirty
   and the existing top-toolbar Save SHALL persist the change.
3. WHEN the user adds, duplicates, or deletes an entry THEN the change
   SHALL be reflected in the in-memory store and pass validation before
   save.
4. The Switches and Variables panel SHALL allow renaming and changing the
   initial value of each entry.

### R3 — Event command system v1

**User story:** As a creator, I want a richer set of event commands, so I
can express dialogue, branching, quest progression, gold, and battles.

#### Acceptance Criteria

1. The editor SHALL expose command cards and inline editors for:
   showText, showChoices, ifFlag, ifSwitch, ifVariable, controlSwitch,
   controlVariable, addItem, removeItem, addGold, removeGold, transferMap,
   setPlayerPosition, wait, playSound, callCommonEvent, comment,
   startQuest, updateQuestObjective, completeQuest, openShop, startBattle,
   changeActorHp.
2. The runtime SHALL execute every command above; commands without visual
   chrome (battle, shop) SHALL still update game state and log clearly.
3. Validation SHALL reject command instances with unknown referenced ids.

### R4 — Switches, variables, choices, branching

**User story:** As a creator, I want named switches and integer variables
referenced from event conditions, so I can wire up game logic.

#### Acceptance Criteria

1. The runtime SHALL preserve switches and variables across save/load.
2. `controlVariable` SHALL support set, add, sub, mul, div, mod against a
   constant or another variable, never panicking on divide-by-zero.
3. `showChoices` SHALL pause execution and route the chosen branch when
   the user picks an option (in tests we choose programmatically).

### R5 — Quest system

**User story:** As a creator, I want to start, advance, and complete a
quest from event commands.

#### Acceptance Criteria

1. The runtime SHALL track quest state per quest id with objective-level
   progress.
2. `startQuest`, `updateQuestObjective`, and `completeQuest` SHALL be
   idempotent (re-running them does not corrupt state).
3. Quest state SHALL be saved and restored.

### R6 — Inventory, gold, party

**User story:** As a creator, I want gold and party state to live next to
inventory in the runtime, so save/load captures everything.

#### Acceptance Criteria

1. The runtime SHALL persist gold (>=0) and the party (ordered list of
   actor ids) in saves alongside inventory, switches, and variables.
2. `addGold` and `removeGold` SHALL clamp to 0 and never go negative.
3. `removeItem` SHALL only remove items the player owns, clamping to 0.

### R7 — Skills, equipment, classes

**User story:** As a creator, I want actors to have classes, equipment
slots, and learnable skills, so combat means something.

#### Acceptance Criteria

1. Actors SHALL declare `class`, `level`, and `equipment` per slot.
2. Equipment items SHALL define stat modifiers (atk/def/mag/mdf/agi/luk).
3. Class definitions SHALL provide stat curves used by the runtime stats
   resolver.

### R8 — Battle v1

**User story:** As a creator, I want my events to start a turn-based
battle that resolves deterministically.

#### Acceptance Criteria

1. `startBattle(troopId)` SHALL load the named troop, resolve a
   deterministic battle (party-first turn order, formula-driven damage),
   and emit one of `victory | defeat | escape` to the runtime.
2. Victory SHALL grant gold, exp, and item rewards declared on the troop.
3. Battle math SHALL be unit-tested.

### R9 — Shops

**User story:** As a creator, I want event commands to open a shop and
let the player buy at advertised prices.

#### Acceptance Criteria

1. `openShop(shopId)` SHALL log the open and provide read access to the
   shop data via the existing inventory state.
2. Buying is implemented as a `removeGold` + `addItem` pair until the UI
   lands; the data layer itself is validated and tested.

### R10 — Sample game

**User story:** As a creator, I want a working sample that exercises
every system so I can validate the engine end-to-end.

#### Acceptance Criteria

1. The bundled sample SHALL transfer between maps, run dialogue, run a
   choice that branches, start and complete a quest, change a variable,
   add gold, open a shop (stub), trigger a battle, and save/load.
2. The runtime smoke harness SHALL pass against the sample.

### R11 — Validation and reporting

**User story:** As a maintainer, I want strong validation so the editor
never silently corrupts a project.

#### Acceptance Criteria

1. The validator SHALL reject:
   - unknown item / actor / class / skill / enemy / troop / quest / shop ids,
   - duplicate ids within any database,
   - unknown switch / variable / common event ids,
   - actors with class ids that do not exist,
   - troops with enemy ids that do not exist,
   - battle commands with troop ids that do not exist.
2. Save SHALL be blocked if validation finds errors.
