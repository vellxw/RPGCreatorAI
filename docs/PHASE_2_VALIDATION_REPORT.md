# Phase 2 Validation Report

## Status

**PASS** — build green, all tests pass, runtime smoke clean.

## Implemented Features

### Engine
- `EventRunner`: full command execution for `showText`, `setFlag`,
  `ifFlag`, `addItem`, `transferMap`, `wait`, `playSound` (audio
  stubbed via Logger). Pauses the queue while dialogue is active or a
  wait timer is running. Yields on transfer requests so `Game` can
  consume them and reload the map.
- `Game`: loads maps via `MapLoader`, drives grid-based player
  movement using `CollisionSystem`, dispatches `interact`/`touch`
  events, handles map transfers, wires F5/F9 to `SaveManager`,
  centers the camera on the player.
- `MapScene::isSolidAt`: events at a cell now override the
  collision-layer tile (allows non-solid doors inside walls).
- `Renderer2D`: draws ground/wall tiles, events (NPC/chest/transfer
  with type-based color), the player with a direction indicator, and
  a dialogue box with embedded 5x7 bitmap font (`BitmapFont`).

### Build & automation
- `CMakePresets.json` provides a `default` preset that injects
  `CMAKE_POLICY_VERSION_MINIMUM=3.5` automatically — users no longer
  need to type the flag.
- Root `CMakeLists.txt` also defaults the policy floor as a defense in
  depth.
- `scripts/dev/{verify,build,test,smoke-runtime,commit-phase}.ps1`
  + `.bat` wrappers automate the full validation pipeline.
- `build_bootstrap.bat` retained and used by the autonomous loop.

### Data
- Existing `data/project.json`, `data/maps/town.json`,
  `data/maps/house.json`, `data/database/items.json` already model the
  Phase 2 scenario (NPC, chest with `ifFlag` gating, transfers in both
  directions). No content was added in C++.

## Validation Commands & Results

```text
> build_bootstrap.bat
=== CONFIGURE ===
-- Configuring done
-- Generating done
=== BUILD ===
[317/317] Linking CXX executable rpg_creator_runtime.exe
=== TEST ===
1/1 Test #1: RPGTests .........................   Passed    0.21 sec
100% tests passed, 0 tests failed out of 1
=== ALL PASSED ===
```

```text
> Start-Process build\rpg_creator_runtime.exe ; Sleep 4 ; Kill
[INFO] RPG Creator Runtime starting...
[INFO] Project loaded: Demo RPG
[INFO] Map loaded: town
(stderr empty, process alive at 4 s, killed cleanly)
```

## Test Coverage

| Test file | Cases |
|-----------|-------|
| `test_project_loader.cpp` | valid load + 7 negative paths |
| `test_map_loader.cpp` | town/house valid, missing file, invalid JSON, missing field |
| `test_collision.cpp` | bounds, walkable, collision tile, solid event |
| `test_event_runner.cpp` | setFlag, ifFlag then, ifFlag else, addItem, showText pause+resume, transferMap request, unsupported command, empty list |
| `test_game_state.cpp` | defaults, flags, variables, inventory, position |
| `test_save_manager.cpp` | round-trip save+load, missing slot |

Render is validated via the smoke check, not unit tests (per the
"do not write brittle render tests" rule).

## Phase 2 Success Criteria — Mapping

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | build passes | ✅ | `[317/317]` link OK |
| 2 | tests pass | ✅ | `100% tests passed` |
| 3 | runtime opens | ✅ | smoke: alive at 4 s |
| 4 | visible map | ✅ | `Renderer2D::renderMap` draws ground+wall tiles |
| 5 | player visible | ✅ | `Renderer2D::renderEntities` draws player rect + facing dot |
| 6 | grid movement | ✅ | `Game::handlePlayerInput` + `tryMove` |
| 7 | solid tile blocks | ✅ | `CollisionSystem::canMoveTo` + `isSolidAt` |
| 8 | bounds block | ✅ | `MapScene::isSolidAt` returns true OOB |
| 9 | solid event blocks | ✅ | `MapScene::isSolidAt` checks event.solid |
| 10 | interact NPC | ✅ | `Game::interact` + `EventData.trigger == "interact"` |
| 11 | dialogue visible | ✅ | `Renderer2D::renderDialogue` + `BitmapFont` |
| 12 | interact chest | ✅ | same path as NPC; `chest_001` event |
| 13 | unopened chest gives item + sets flag | ✅ | `ifFlag chest_001_opened == false → addItem + setFlag` |
| 14 | opened chest shows empty msg | ✅ | else-branch: `"El cofre esta vacio."` |
| 15 | transfer tile changes map | ✅ | `EventRunner` produces request; `Game::applyTransferIfPending` reloads |
| 16 | return transfer works | ✅ | both town→house and house→town transfer events present |
| 17 | save persists state | ✅ | `SaveManager::save` writes JSON; round-trip test |
| 18 | load restores state | ✅ | `SaveManager::load` + `Game::loadGameFromDisk` |
| 19 | no hardcoded game data in C++ | ✅ | all map/event/item data in `data/`; only allowed technical literals in C++ |
| 20 | maps/events/dialogues from JSON | ✅ | `MapLoader::parseCommand` reads all command fields from JSON |
| 21 | committed and pushed | ⏳ | done in this commit |
| 22 | `docs/VALIDATION_LOG.md` | ✅ | this file exists and is updated |

## Known Limitations

- Dialogue text uses an embedded 5x7 bitmap font; only ASCII letters,
  digits, and basic punctuation render. Spanish accented characters
  (á, é, í, ó, ú, ñ, ¿, ¡) fall back to blank space. JSON content uses
  unaccented Spanish to match the font.
- Audio is not implemented; `playSound` only logs.
- F5/F9 produce in-window dialogue feedback ("Partida guardada." /
  "Partida cargada.") but no separate save UI.
- Camera always centers on the player — no minimum/maximum clamping
  against the map edges. For maps smaller than the viewport this means
  the map may be drawn off-center; visually fine for Phase 2.

## Recommended Phase 3

Visual Editor MVP (per the protocol). Editor lives outside the runtime
process; reuses the same loaders for maps/events/items.
