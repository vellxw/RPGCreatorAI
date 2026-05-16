# Phase 6 — Design

## Overview

Phase 6 is delivered as a sequence of vertical slices that each touch
schemas, persistence, editor, runtime, validation, and tests. Each slice
ships a working, tested feature; nothing in this phase is half-wired.

The renderer and the C++ runtime are kept separate, sharing only JSON.
The renderer is the source of truth while editing; the runtime is the
source of truth while playing. The shell makes them meet on disk.

## Architecture

```
+-------------------------------+         +---------------------------+
| React/Vite Editor             |         | C++ Runtime               |
| - projectStore (reducer)      |         | - Game / GameState        |
| - editorStore                 |         | - EventRunner             |
| - screens/{Map,Event,DB,...}  |  IPC    | - SaveManager             |
| - ProjectDataAdapter          | <-----> | - QuestSystem             |
+---------------+---------------+         | - PartySystem             |
                |                         | - InventorySystem         |
                v                         | - BattleSystem            |
+-------------------------------+         | - ShopSystem              |
| Tauri Shell (Rust)            |  files  | - CommonEventSystem       |
| - fs_*: read/write project    | <-----> | - MapLoader / ItemDB      |
| - runtime_*: spawn rt + status|         +---------------------------+
+-------------------------------+
```

### Files

```
data/project.json              -- metadata + database paths
data/maps/<id>.json            -- map data
data/database/items.json       -- existing item DB
data/database/actors.json      -- new
data/database/classes.json     -- new
data/database/skills.json      -- new
data/database/enemies.json     -- new
data/database/troops.json      -- new
data/database/quests.json      -- new
data/database/shops.json       -- new
data/database/system.json      -- new
data/database/switches.json    -- new
data/database/variables.json   -- new
data/database/commonEvents.json -- new
```

## Components and interfaces

### Renderer side

- `types/project.ts` gains: `ActorData`, `ClassData`, `SkillData`,
  `EnemyData`, `TroopData`, `QuestData`, `ObjectiveData`, `ShopData`,
  `ShopListing`, `SystemData`, `SwitchData`, `VariableData`,
  `CommonEventData`, plus expanded `EventCommand` union.
- `validation/validateProject.ts` gains referential checks for the new
  database links.
- `stores/projectStore.ts` reducer gains:
  - `UPDATE_DATABASE_ENTRY` (generic, keyed by db name + id),
  - `ADD_DATABASE_ENTRY`,
  - `REMOVE_DATABASE_ENTRY`,
  - `RENAME_DATABASE_ENTRY`,
  - `UPDATE_SYSTEM_DATA`.
- `adapters/types.ts` `FullProjectState` gains `databases: Record<string, unknown>` so the new shards travel together.
- `adapters/BrowserMemoryAdapter` and the export/import helpers seed
  defaults for every database.
- New screens: `DatabaseScreen` (tabbed), `SwitchesVariablesScreen`.

### Shell side

- `fs_commands.rs` adds an opaque `databases: HashMap<String, serde_json::Value>` slot on `FullProjectState`, persisted alongside `items`.
- The shell never validates the contents — that is the renderer's job.

### Runtime side

- `GameState` gains `int gold` and `std::vector<std::string> party` plus
  `std::unordered_map<std::string, std::unordered_map<std::string, std::string>> questStates`.
- New tiny systems live in `src/runtime/`:
  - `QuestSystem` — `start(id)`, `updateObjective(id, objectiveId)`, `complete(id)`.
  - `BattleSystem` — `runBattle(troopId)` → `BattleOutcome`.
  - `ShopSystem` — `open(shopId)` (stub).
  - `CommonEventSystem` — runs a stored command list by id.
- `EventRunner` is extended to dispatch the new command types and to call
  these systems.
- `MapLoader` parses every new command type into the existing `EventCommand`
  fat-struct via additional optional fields.
- `SaveManager` persists gold, party, quest states, switches, and variables.

## Data models

### Actor

```ts
interface ActorData {
  id: string;
  name: string;
  classId: string;
  level: number;
  hp: number;
  mp: number;
  baseStats: Stats;
  equipment: Partial<Record<EquipmentSlot, string | null>>; // itemId or null
  skills: string[]; // skillId list
}
```

### Class

```ts
interface ClassData {
  id: string;
  name: string;
  growth: Stats; // applied per level
  usableEquipment: EquipmentSlot[]; // unrestricted by default
  learnedSkills: Array<{ level: number; skillId: string }>;
}
```

### Skill

```ts
interface SkillData {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  power: number;       // % multiplier of attacker stat
  target: 'singleEnemy' | 'allEnemies' | 'singleAlly' | 'allAllies' | 'self';
  element?: string;
}
```

### Enemy / Troop

```ts
interface EnemyData {
  id: string;
  name: string;
  stats: Stats;
  exp: number;
  gold: number;
  drops: Array<{ itemId: string; rate: number }>; // 0..1
}
interface TroopData {
  id: string;
  name: string;
  members: string[]; // enemy ids in order
}
```

### Quest

```ts
interface ObjectiveData { id: string; description: string }
interface QuestData {
  id: string;
  title: string;
  summary: string;
  objectives: ObjectiveData[];
  rewards: { gold: number; exp: number; items: Array<{ itemId: string; amount: number }> };
}
```

### Shop

```ts
interface ShopListing { itemId: string; price: number }
interface ShopData { id: string; name: string; listings: ShopListing[] }
```

### System

```ts
interface SystemData {
  startingParty: string[]; // actor ids
  startingGold: number;
  defaultBgm?: string;
  windowTint?: string;
  battleBackground?: string;
}
```

### Switches / Variables / Common events

```ts
interface SwitchData    { id: string; name: string; initial: boolean }
interface VariableData  { id: string; name: string; initial: number }
interface CommonEventData {
  id: string;
  name: string;
  trigger: 'manual' | 'autorun' | 'parallel';
  commands: EventCommand[];
}
```

### Event command union (v1 superset)

The existing 6 commands stay. The new commands extend the union, each
with a unique `type` discriminator:

- `showChoices` `{ prompt: string; choices: Array<{ label: string; commands: EventCommand[] }> }`
- `controlSwitch` `{ id: string; value: boolean }`
- `controlVariable` `{ id: string; op: 'set'|'add'|'sub'|'mul'|'div'|'mod'; value: number; sourceVariableId?: string }`
- `removeItem` `{ itemId: string; amount: number }`
- `addGold` `{ amount: number }`
- `removeGold` `{ amount: number }`
- `comment` `{ text: string }`
- `callCommonEvent` `{ commonEventId: string }`
- `startQuest` `{ questId: string }`
- `updateQuestObjective` `{ questId: string; objectiveId: string; state: 'open'|'done' }`
- `completeQuest` `{ questId: string }`
- `openShop` `{ shopId: string }`
- `startBattle` `{ troopId: string; canEscape: boolean; defeatBranch?: EventCommand[]; victoryBranch?: EventCommand[] }`
- `changeActorHp` `{ actorId: string; delta: number }`
- `setPlayerPosition` `{ mapId: string; x: number; y: number; direction: Direction }`
- `wait` `{ ms: number }`

`ifFlag` is preserved. `ifSwitch` (for the new typed switches table) and
`ifVariable` are added with the same shape as `ifFlag` but referencing
the new id space.

## Validation

`validateProject` is extended to chase every cross-reference: switch ids,
variable ids, common event ids, item ids, actor ids, class ids, enemy
ids, troop ids, quest ids, objective ids, shop ids. Each failed reference
becomes an error with a precise source string (`<map>/<event>/<command>`).

Duplicate ids inside any database are surfaced as errors; missing
required fields produce errors; invalid enum values produce errors;
non-finite numbers produce errors.

## Save / load shape (Phase 6)

```json
{
  "schemaVersion": 2,
  "currentMapId": "town",
  "player": { "x": 4, "y": 4, "direction": "down" },
  "flags": { "...": true },
  "switches": { "talked_to_old_man": true },
  "variables": { "gold_quest_progress": 1 },
  "inventory": { "potion": 2 },
  "gold": 50,
  "party": ["arc"],
  "actors": { "arc": { "hp": 18, "mp": 5, "level": 1, "exp": 12 } },
  "quests": {
    "lost_chest": {
      "state": "active",
      "objectives": { "open_chest": "done", "talk_back": "open" }
    }
  }
}
```

Loaders accept v1 saves and migrate them: missing fields default to empty
collections; gold defaults to `system.startingGold`; party defaults to
`system.startingParty`.

## Testing strategy

- **Vitest:** new validators, reducer actions for every database, adapter
  roundtrip including new files, command parsing for every new command,
  battle damage formula (computed in TS for parity with C++).
- **Doctest (C++):** EventRunner for each new command, GameState save/
  load roundtrip with gold/party/quests, BattleSystem deterministic
  outcome, QuestSystem idempotency.
- **Cargo:** existing safe-path/atomic-write tests still pass; add a new
  test that round-trips a `databases` map.
- **Smoke:** runtime exits cleanly; the smoke harness exercises a quest
  start → variable change → battle stub → save → load round-trip.

## Risk areas

- **C++ struct fat union (`EventCommand`).** Adding fields keeps it
  source-compatible but extends the struct size. Acceptable for Phase 6.
- **Save migration.** v1 saves must keep loading. Tested via legacy
  fixture in `tests/test_save_manager.cpp`.
- **Renderer state shape.** The new `databases` field on FullProjectState
  must be optional in the wire format so older Rust shells (none in
  practice, but defensive) won't choke.

## Migration path

1. Land Slice 1 → schemas exist, but no editor screen yet. Adapter writes
   them through. Existing tests pass.
2. Land Slice 2 → editor has Database screen and dirty save flow.
3. Slice 3 onwards expand event commands and runtime systems on top of
   the data model already in place.
