# Phase 11 Runtime Command Gap Audit

Issue: CP-033 / FRA-68
Date: 2026-06-02

## Result

The authored event command surface is horizontally aligned across the
TypeScript schema, Events editor, editor validation, native parser structs,
MapLoader parsing, common-event parsing, EventRunner dispatch, and focused
tests. No v1 command is completely missing from the native EventRunner.

The remaining gaps are product-depth gaps, not parser/schema holes:

- battle commands run through the deterministic battle runner and summary, but
  do not yet expose full authored battle flow such as escape handling policy
  or richer battle event outcomes;
- audio commands cover local sound-effect dispatch, but not full BGM/BGS/ME
  authoring controls;
- plugin commands are intentionally limited to deterministic debug built-ins;
- movement routes cover deterministic move, turn, and wait steps, but not the
  wider RPG Maker route-command catalog;
- the native runtime project validator checks references for known commands,
  but does not yet reject unknown command types with an explicit allowlist.

No new Linear issues were created. The gaps map to existing milestone 04 work:
CP-034 menu flow polish, CP-035 battle runtime closure, CP-036 audio runtime
v1, CP-037 deterministic plugin command registry v2, CP-039 diagnostics, and
CP-040 runtime feature completeness gate.

## Audited Sources

- Schema: `src/types/project.ts`
- Command add/edit UI: `src/components/events/CommandStackEditor.tsx`,
  `src/components/events/CommandEditor.tsx`
- Editor validation: `src/validation/validateProject.ts`,
  `src/validation/validateMap.ts`
- Native command shape and parsers: `src/types/EventTypes.h`,
  `src/world/MapLoader.cpp`, `src/database/RpgDatabases.cpp`
- Runtime execution and dispatch: `src/events/EventRunner.cpp`,
  `src/events/EventRunner.h`, `src/core/Game.cpp`
- Runtime project validation: `src/runtime/RuntimeProjectValidator.cpp`
- Tests: `src/components/events/__tests__/CommandStackEditor.test.tsx`,
  `src/validation/__tests__/validateProject.test.ts`,
  `src/validation/__tests__/validateMap.test.ts`,
  `tests/test_event_runner.cpp`, `tests/test_map_loader.cpp`,
  `tests/test_game_movement_route.cpp`,
  `tests/test_runtime_project_validator.cpp`

## Command Support Matrix

Legend:

- Full: command has schema, editor UI, validation/parser support, runtime
  behavior, and focused tests for the current v1 scope.
- Partial: command is supported end-to-end, but the authored behavior is a
  constrained v1 subset of expected RPG authoring needs.
- Intentional no-op: runtime behavior is deliberately inert.

| Command | Schema | Editor | Validation | Parser | Runtime behavior | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `showText` | Yes | Yes | Basic type/path coverage | Yes | Opens dialogue and pauses until closed. | `test_event_runner.cpp`, command UI tests | Full |
| `showChoices` | Yes | Yes | Nested command walk | Yes | Opens choice UI or test picker, then runs selected branch. | `test_event_runner.cpp`, dialogue choice tests | Full |
| `setFlag` | Yes | Yes | Known type | Yes | Sets legacy boolean flag in `GameState`. | `test_event_runner.cpp`, scheduler tests | Full |
| `ifFlag` | Yes | Yes | Nested branch walk | Yes | Branches on legacy flag equality. | `test_event_runner.cpp`, trace tests | Full |
| `ifSwitch` | Yes | Yes | Switch reference | Yes | Branches on typed switch equality. | `test_event_runner.cpp` | Full |
| `ifSelfSwitch` | Yes | Yes | Self-switch id | Yes | Branches on owner event self switch. | `test_event_runner.cpp`, page evaluator tests | Full |
| `ifVariable` | Yes | Yes | Variable reference | Yes | Branches on literal integer comparison. | `test_event_runner.cpp` | Full |
| `controlSwitch` | Yes | Yes | Switch reference | Yes | Sets typed switch. | `test_event_runner.cpp` | Full |
| `controlSelfSwitch` | Yes | Yes | Self-switch id | Yes | Sets owner event self switch, warning-traced without owner. | `test_event_runner.cpp` | Full |
| `controlVariable` | Yes | Yes | Variable/source refs and div-zero guard | Yes | Applies set/add/sub/mul/div/mod using literal or source variable. | `test_event_runner.cpp` | Full |
| `addItem` | Yes | Yes | Item reference | Yes | Adds inventory quantity. | `test_event_runner.cpp`, `test_game_state.cpp` | Full |
| `removeItem` | Yes | Yes | Item reference | Yes | Removes inventory quantity with zero clamp. | `test_event_runner.cpp`, `test_game_state.cpp` | Full |
| `addGold` | Yes | Yes | Amount validation | Yes | Adds gold through `GameState`. | `test_event_runner.cpp`, `test_game_state.cpp` | Full |
| `removeGold` | Yes | Yes | Amount validation | Yes | Removes gold with non-negative invariant. | `test_event_runner.cpp`, `test_game_state.cpp` | Full |
| `transferMap` | Yes | Yes | Map, bounds, direction refs | Yes | Emits transfer request; `Game` loads map and positions player. | `test_event_runner.cpp`, scheduler tests | Full |
| `setPlayerPosition` | Yes | Yes | Map, bounds, direction refs | Yes | Uses same transfer request path as `transferMap`. | Parser and validator coverage | Partial |
| `wait` | Yes | Yes | Non-negative finite ms | Yes | Pauses command runner for duration. | `test_event_runner.cpp`, scheduler/trace tests | Full |
| `playSound` | Yes | Yes | Known type | Yes | Emits sound request; `Game` dispatches to local audio registry. | `test_event_runner.cpp`, audio tests | Partial |
| `pluginCommand` | Yes | Yes | Safe identifiers and scalar args | Yes | Runs deterministic `debug.*` built-ins; unknown commands warn and continue. | `test_event_runner.cpp`, validator tests | Partial |
| `comment` | Yes | Yes | Known type | Yes | Ignored by runtime by design. | Page evaluator/parser coverage | Intentional no-op |
| `callCommonEvent` | Yes | Yes | Common event reference | Yes | Resolves and queues common-event commands through injected resolver. | `test_event_runner.cpp`, scheduler tests | Full |
| `startQuest` | Yes | Yes | Quest reference | Yes | Starts quest state and initializes objectives from resolver. | `test_event_runner.cpp`, state tests | Full |
| `updateQuestObjective` | Yes | Yes | Quest/objective refs | Yes | Updates quest objective state. | `test_event_runner.cpp`, state tests | Full |
| `completeQuest` | Yes | Yes | Quest reference | Yes | Marks quest completed. | `test_event_runner.cpp`, state tests | Full |
| `openShop` | Yes | Yes | Shop reference | Yes | Emits shop request; `Game` opens local shop system when id exists. | `test_event_runner.cpp`, shop tests | Full |
| `startBattle` | Yes | Yes | Troop reference and branches | Yes | Runs deterministic battle runner, applies victory rewards, opens summary, queues victory/defeat branches. | `test_event_runner.cpp`, battle tests | Partial |
| `changeActorHp` | Yes | Yes | Actor reference | Yes | Applies actor HP delta with zero clamp in `GameState`. | `test_event_runner.cpp` | Partial |
| `playAnimation` | Yes | Yes | Target, event, action, direction, duration refs | Yes | Emits animation request; `Game` applies manual player/event animation state and optional blocking wait. | `test_event_runner.cpp`, validator tests | Partial |
| `setMovementRoute` | Yes | Yes | Target, event, step shape | Yes | Emits route request; `Game` applies deterministic move/turn/wait steps to player or event. | `test_event_runner.cpp`, movement-route tests | Partial |

## Ranked Gaps

1. Battle authoring depth (`startBattle`) - high user impact, medium risk.
   Existing runtime supports deterministic battle execution, reward application,
   summary display, and victory/defeat branches. CP-035 should decide and
   implement the v1 policy for escape/canEscape, game-over or defeat handling,
   and which authored battle outcomes are in scope.

2. Audio command breadth (`playSound`) - high user impact, low/medium risk.
   The current command is SFX-only. CP-036 should define local-first BGM/BGS/ME
   support, volume/pitch/pan/fade scope, and offline validation without live
   provider or network dependencies.

3. Deterministic plugin registry (`pluginCommand`) - high risk if expanded
   casually. CP-037 should keep plugin commands registry-based, local,
   deterministic, allowlisted, and serializable. Unknown commands should remain
   non-fatal but diagnosable.

4. Movement route breadth (`setMovementRoute`) - medium/high user impact,
   medium risk. The current route step set is deterministic and tested but
   intentionally small. Future work should only add data-only route steps that
   can be validated and replayed deterministically.

5. Runtime project validator unknown-command allowlist - medium impact, low
   risk. TypeScript validators reject unknown commands, and `EventRunner`
   warning-traces unsupported commands, but the native runtime validator should
   also reject unknown `type` values before launch. CP-040 is the integration
   gate to close this if no earlier runtime issue touches the validator.

6. Rich presentation commands - medium impact, medium risk. `showText`,
   `showChoices`, `playAnimation`, and `changeActorHp` are functional v1
   commands, but future phases may add face graphics, cancel/default choice
   handling, battle animation effects, and party/stat integration. These are
   not required to complete milestone 04 unless pulled into CP-034 or CP-035.

## Roadmap

- CP-034 / FRA-69: polish menu/runtime flow around modal systems so battle
  summaries, shops, dialogue, saves, and event runner blocking states are
  predictable.
- CP-035 / FRA-70: close battle authoring runtime gaps for `startBattle`,
  battle outcomes, rewards, escape policy, and defeat handling.
- CP-036 / FRA-71: expand local audio authoring/runtime from SFX dispatch to
  the agreed v1 audio command set.
- CP-037 / FRA-72: replace ad hoc debug plugin handling with a deterministic
  plugin command registry contract.
- CP-039 / FRA-74: expose command-level diagnostics for unsupported,
  unhandled, or degraded runtime command paths.
- CP-040 / FRA-75: run the runtime feature completeness gate and close any
  remaining validator parity issue, especially unknown native command types.
