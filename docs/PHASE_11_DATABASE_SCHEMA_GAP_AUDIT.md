# Phase 11 Database Schema Gap Audit

Issue: CP-041 / FRA-76
Date: 2026-06-02

## Result

The Phase 11 database layer has a concrete support matrix across TypeScript
schema, bundled JSON shards, editor/desktop preservation, TypeScript
validation, native project loading, native runtime validation, and runtime
consumption.

CP-041 also closed two small preservation gaps found during the audit:

- TypeScript now declares the optional `database.audio` path and optional
  `databases.audio` payload used by legacy/separate audio registry shards.
- The Tauri filesystem bridge now reads, writes, and playtest-copies
  optional `database.audio` shards without dropping `audio`, `sounds`, or
  `bgm` entries.
- Native `ProjectLoader` now records optional `database.weapons`,
  `database.armors`, and `database.states` paths. CP-044 resolved this
  boundary by keeping those separated shards as editor/validation data for v1
  while strengthening runtime pre-launch checks for the item/equipment records
  that native gameplay actually consumes.

No new Linear issues were created because the large gaps map to existing
milestone 05 work: CP-042 through CP-048. This audit documents exactly which
future issue owns each gap.

## Audited Sources

- TypeScript schema: `src/types/project.ts`
- Editor defaults and preservation: `src/adapters/defaultDatabases.ts`,
  `src/adapters/projectTemplates.ts`, `src/adapters/BrowserMemoryAdapter.ts`,
  `src-tauri/src/fs_commands.rs`
- Bundled JSON shards: `data/database/*.json`
- Editor validation: `src/validation/validateProject.ts` and
  `src/validation/__tests__/validateDatabases.test.ts`
- Native project/runtime loading: `src/types/ProjectTypes.h`,
  `src/world/ProjectLoader.cpp`, `src/database/RpgDatabases.*`,
  `src/database/AnimationDatabase.*`, `src/runtime/RuntimeProjectValidator.cpp`
- Native tests: `tests/test_tileset_runtime_data.cpp`,
  `tests/test_runtime_project_validator.cpp`, battle/menu/shop/audio tests

## Support Matrix

Legend:

- Full: preserved, validated, and consumed where v1 runtime needs it.
- Editor-only: real schema/editor data, intentionally not consumed by runtime
  v1.
- Partial: support exists but has a known runtime/editor mismatch or depth gap.

| Shard | TS schema | JSON fixture | Editor/desktop preservation | TS validation | Native loader/validator | Runtime consumption | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `items` | Yes | Yes | Yes | Duplicate ids, category/slot/effect/modifier checks | `ProjectLoader`, `ItemDatabase`, `RpgDatabases`, validator refs and CP-044 item/equipment range checks | Inventory, shops, drops, rewards, equipment modifiers | Full | CP-044 |
| `actors` | Yes | Yes | Yes | Stats, class/skill/equipment refs, numeric bounds | `RpgDatabases`, validator refs | Party menu, battle stats, starting party | Full | CP-042 |
| `classes` | Yes | Yes | Yes | Growth, usable equipment refs, learned skill refs | `RpgDatabases` loads id/name/growth; validator checks learned skills | Battle stat growth; learned skills are authoring-only in v1 | Partial | CP-042 |
| `skills` | Yes | Yes | Yes | Cost, power, target, element refs | `RpgDatabases` loads combat fields; validator collects ids | Battle/menu metadata depth remains limited | Partial | CP-042 |
| `weapons` | Yes | Yes | Yes | Type, price, animation, stat param, and trait checks | `ProjectLoader` records path after CP-041; validator does not index directly | Not consumed directly; runtime equipment still comes from item records | Editor-only | CP-044 completed for authoring polish |
| `armors` | Yes | Yes | Yes | Type, slot, price, stat param, and trait checks | `ProjectLoader` records path after CP-041; validator does not index directly | Not consumed directly; runtime equipment still comes from item records | Editor-only | CP-044 completed for authoring polish |
| `states` | Yes | Yes | Yes | Priority, restriction, and trait checks | `ProjectLoader` records path after CP-041; validator does not index directly | No runtime status-effect simulation in v1 | Editor-only | CP-044 completed for authoring polish |
| `types` | Yes | Yes | Yes | Required equipment slots, ids, names | `ProjectLoader` records path; native runtime does not load values | Editor labels/reference option tables only | Editor-only | CP-045 completed for authoring polish |
| `terms` | Yes | Yes | Yes | Required currency/stat/menu/command/battle/save labels | `ProjectLoader` records path; native runtime does not load values | Editor/system terminology only | Editor-only | CP-045 completed for authoring polish |
| `enemies` | Yes | Yes | Yes | Stats, exp/gold/drop rates, drop refs | `RpgDatabases`, validator refs | Battle enemies, rewards | Full | CP-043 |
| `troops` | Yes | Yes | Yes | Members, non-empty, enemy refs | `RpgDatabases`, validator refs | `startBattle` troop selection | Full | CP-043 |
| `quests` | Yes | Yes | Yes | Objective ids, reward values, item refs | `RpgDatabases`, validator refs | Quest state commands and rewards | Full | CP-046/047 |
| `shops` | Yes | Yes | Yes | Non-empty listings, price, item refs | `RpgDatabases`, validator refs | Runtime shop modal | Full | CP-047 |
| `system` | Yes | Yes | Yes | Starting gold, party refs, animation/audio refs | `RpgDatabases`, validator refs | Starting party/gold, BGM/audio, animation defaults | Full | CP-045 |
| `switches` | Yes | Yes | Yes | Duplicate ids, command/page refs | Runtime validator indexes ids | Runtime commands store values dynamically; `initial` is not seeded | Partial | CP-045/046 |
| `variables` | Yes | Yes | Yes | Duplicate ids, finite initial, command/page refs | Runtime validator indexes ids | Runtime commands store values dynamically; `initial` is not seeded | Partial | CP-045/046 |
| `commonEvents` | Yes | Yes | Yes | Trigger/switch/command refs | `RpgDatabases` parses commands; validator walks commands | Scheduler and `callCommonEvent` | Full | CP-046 |
| `animations` | Yes | Yes | Yes | Clip shape, generated asset refs, player coverage warnings | `AnimationDatabase`, validator indexes ids/actions | Player/event animation lookup and rendering | Full | CP-049+ for asset depth |
| `tilesets` | Yes | Yes | Yes | Tile ids, assets, groups, passability, priority | `RpgDatabases`, validator refs | Map rendering/passability metadata | Full | CP-049+ for asset depth |
| `audio` | Yes after CP-041 | Optional legacy/separate shard | Rust bridge preserves after CP-041 | Paths covered through system/audio registry rules when merged by authoring flow | `ProjectLoader`, `RpgDatabases`, runtime validator | Optional local audio registry | Partial | CP-052 for import workflow |

## Ranked Gaps

1. Separated equipment/state runtime depth - high impact, medium risk.
   `weapons`, `armors`, and `states` are first-class editor shards, but native
   battle/equipment behavior still uses item records for v1 equipment
   modifiers and has no runtime state/status-effect simulation. CP-044 closed
   the immediate authoring/validation polish and kept direct separated-shard
   runtime consumption deferred until a future slice defines migration or
   composition rules.

2. Switch/variable initial values - medium/high impact, low/medium risk.
   Runtime validation indexes switch/variable ids, but `GameState` currently
   defaults switches to false and variables to 0 instead of seeding
   `switches[].initial` and `variables[].initial`. CP-046 should decide and
   implement startup seeding if non-default initial values are required for
   complete authored projects.

3. Types and terms runtime/editor boundary - closed for v1 by CP-045.
   Types and terms now have standalone editors, visible missing-label
   warnings, TypeScript validation, and system-default terminology usage.
   Native runtime intentionally does not consume labels or typed category
   tables.

4. Skill/class depth - medium impact, medium risk. Classes load growth into
   runtime battle stats, and CP-042 now covers editor-side actor skill,
   learned-skill, usable-equipment, and label polish. Richer native gameplay
   consumption for learned skills, equipment rules, and skill behavior remains
   future product depth unless a later issue expands the runtime contract.

5. Asset/audio catalog split - medium impact, medium risk. `system.audio` is
   the current editor-owned registry and optional `database.audio` is now
   preserved, but a first-class project asset catalog belongs to milestone 06
   CP-049 through CP-052.

## Follow-Up Ownership

- CP-042 / FRA-77: actor, class, and skill editor polish completed; runtime
  data shape unchanged.
- CP-043 / FRA-78: enemy and troop battle data polish completed; runtime data
  shape unchanged and native battle-facing range validation strengthened.
- CP-044 / FRA-79: item, equipment, and state shard polish completed.
  Items remain the runtime-consumed equipment records; `weapons`, `armors`,
  and `states` remain editor/validation shards for v1.
- CP-045 / FRA-80: system, types, and terms polish completed. Types and terms
  remain editor/validation data; system default validation now covers duplicate
  starting-party actors, empty party-with-actors, and missing animation-set
  defaults.
- CP-046 / FRA-81: common-event authoring parity and scheduler validation.
- CP-047 / FRA-82: reference repair tools for broken database/map/event refs.
- CP-048 / FRA-83: database/system completeness integration gate.
- CP-049 through CP-052: asset catalog/import ownership for richer animation,
  tileset, and audio asset metadata.

## Validation

CP-041 validation is recorded in `docs/VALIDATION_LOG.md`.
