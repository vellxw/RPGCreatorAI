# Implementation Plan: Phase 1 Runtime Bootstrap

## Overview

Sequential implementation of the RPG Creator Runtime bootstrap: hardened CMake build system, dependency management, core types, strict project validation, SDL window wrapper, renderer bootstrap, application lifecycle, game loop, and architectural seams — all driven exclusively from `ProjectData` loaded from JSON.

## Tasks

- [x] 1. Harden root CMakeLists.txt
  - [x] 1.1 Harden CMakeLists.txt with CXX_EXTENSIONS guard
    - Modify `CMakeLists.txt`
    - Add a post-configuration guard that emits `message(FATAL_ERROR ...)` if `CMAKE_CXX_EXTENSIONS` is overridden to a value other than `OFF`
    - Ensure `cmake_minimum_required(VERSION 3.15)`, `CMAKE_CXX_STANDARD 20`, `CMAKE_CXX_STANDARD_REQUIRED True`, `CMAKE_CXX_EXTENSIONS OFF` are present (already are, verify)
    - Acceptance: `cmake -S . -B build` succeeds; setting `-DCMAKE_CXX_EXTENSIONS=ON` externally triggers FATAL_ERROR
    - _Requirements: 1.1, 1.2, 1.2a_

- [x] 2. Add FetchContent dependencies and explicit target validation
  - [x] 2.1 Add target existence checks after FetchContent
    - Modify `CMakeLists.txt`
    - After `FetchContent_MakeAvailable(json)`, `FetchContent_MakeAvailable(doctest)`, and `FetchContent_MakeAvailable(SDL2)`, add explicit `if(NOT TARGET nlohmann_json::nlohmann_json)`, `if(NOT TARGET doctest::doctest)`, `if(NOT TARGET SDL2-static)` checks each followed by `message(FATAL_ERROR "Dependency target <name> not found after FetchContent")`
    - These checks must appear BEFORE the `add_library(RuntimeLib ...)` declaration
    - Acceptance: CMake configure passes normally; if a FetchContent target is missing, configure halts with identifiable error
    - _Requirements: 1.14, 1.15_

- [x] 3. Add RuntimeLib target and test target wiring
  - [x] 3.1 Verify RuntimeLib and test executable configuration
    - Verify in `CMakeLists.txt` that `RuntimeLib` is STATIC, aggregates all `src/` subdirectory `.cpp` files (excluding `main.cpp`), has `src/` as PUBLIC include directory, links PUBLIC against `nlohmann_json::nlohmann_json` and `SDL2-static`
    - Verify `rpg_creator_runtime` links PRIVATE against `RuntimeLib` with `src/main.cpp` as sole source
    - Verify `enable_testing()` and `add_subdirectory(tests)` are present
    - Verify `tests/CMakeLists.txt` defines `rpg_tests` linking against `RuntimeLib` and `doctest::doctest`, registered via `add_test(NAME RPGTests COMMAND rpg_tests)`
    - No changes needed if already correct; fix any discrepancies
    - Acceptance: `cmake --build build` produces both `rpg_creator_runtime` and `rpg_tests` executables
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.13, 8.1, 8.5_

- [x] 4. Implement Logger
  - [x] 4.1 Implement Logger info/warning/error in Logger.cpp
    - Modify `src/core/Logger.cpp`
    - `Logger::info` writes to `stdout` with `[INFO]` prefix
    - `Logger::warning` writes to `stderr` with `[WARN]` prefix
    - `Logger::error` writes to `stderr` with `[ERROR]` prefix
    - Each message is followed by a newline
    - Acceptance: Calling `Logger::info("test")` outputs `[INFO] test\n` to stdout; `Logger::error("fail")` outputs `[ERROR] fail\n` to stderr
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 5. Implement basic types: Vec2i, Direction, ProjectTypes
  - [x] 5.1 Verify and finalize Vec2i, Direction, ProjectTypes headers
    - Verify `src/types/Vec2i.h` has `x`, `y` fields with `==` and `!=` operators (already correct)
    - Verify `src/types/Direction.h` has `Direction` enum with `Up/Down/Left/Right`, `directionToString`, `stringToDirection` (already correct)
    - Verify `src/types/ProjectTypes.h` has `StartPosition`, `MapReference`, `DatabaseReference`, `ProjectData` structs matching design (already correct)
    - No changes expected; fix only if discrepancies found
    - Acceptance: All three headers compile without errors when included in a translation unit
    - _Requirements: 3.2_

- [x] 6. Implement ProjectLoader strict validation
  - [x] 6.1 Implement ProjectLoader::load with full validation pipeline
    - Modify `src/world/ProjectLoader.cpp`
    - Implement the 8-step validation pipeline from design:
      1. Open file → if fails: `Logger::error` with path, return `nullopt`
      2. Parse JSON → if fails: `Logger::error` with parse detail, return `nullopt`
      3. Check required fields (`schemaVersion`, `title`, `startMapId`, `startPosition.x`, `startPosition.y`, `startPosition.direction`, `maps`, `database.items`) → if missing: `Logger::error` identifying field, return `nullopt`
      4. `schemaVersion` must be positive integer → if not: error, `nullopt`
      5. `schemaVersion` must equal `1` → if not: error with supported vs received, `nullopt`
      6. `startPosition.direction` must be one of `"up"`, `"down"`, `"left"`, `"right"` → if not: error citing invalid value, `nullopt`
      7. `maps` non-empty and contains entry with `id == startMapId` → if not: error describing inconsistency, `nullopt`
      8. Build and return populated `ProjectData`
    - Use `nlohmann::json` with `.at()` inside internal try/catch for `json::exception`
    - Never throw exceptions to caller
    - Acceptance: Valid `data/project.json` returns populated `ProjectData`; each invalid case returns `nullopt` with descriptive log
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.6a, 3.7, 3.7a, 3.8, 3.9_

- [x] 7. Add ProjectLoader tests
  - [x] 7.1 Implement ProjectLoader unit tests
    - Modify `tests/test_project_loader.cpp`
    - Test cases using doctest:
      - Valid load of `data/project.json`: verify `schemaVersion == 1`, `title == "Demo RPG"`, `startMapId == "town"`, `startPosition.pos.x == 4`, `startPosition.pos.y == 4`, `startPosition.direction == Direction::Down`, `maps.size() == 2`
      - `schemaVersion` != 1 → returns `nullopt` (use temp JSON string/file)
      - Missing required field → returns `nullopt`
      - `startMapId` not in `maps` → returns `nullopt`
      - Invalid `direction` value → returns `nullopt`
      - Invalid JSON syntax → returns `nullopt`
      - Non-existent file → returns `nullopt`
    - Acceptance: `ctest --test-dir build --output-on-failure` passes all ProjectLoader test cases
    - _Requirements: 8.2, 8.3, 8.4_

- [x] 8. Implement Window SDL wrapper
  - [x] 8.1 Implement Window initialize/shutdown/processEvents
    - Modify `src/platform/Window.cpp`
    - `initialize(width, height, title)`: call `SDL_Init(SDL_INIT_VIDEO)`, `SDL_CreateWindow`, `SDL_CreateRenderer`; if any step fails, free partial resources, `Logger::error` with `SDL_GetError()`, return `false`; on success return `true`
    - `shutdown()`: destroy renderer (if not null), destroy window (if not null), call `SDL_Quit()`. Must be idempotent — safe to call even if `initialize()` was never called or failed partially.
    - `processEvents(quitOut)`: iterate `SDL_PollEvent`; if `SDL_QUIT` detected, set `quitOut = true`
    - `getKeyboardState()`: return `SDL_GetKeyboardState(nullptr)`
    - Acceptance: `Window::initialize(800, 600, "Test")` creates SDL window and renderer; `shutdown()` cleans up without leaks; `processEvents` detects quit
    - _Requirements: 4.4, 4.5, 4.7_

- [x] 9. Implement IRenderer interface and Renderer2D bootstrap
  - [x] 9.1 Implement Renderer2D initialize/beginFrame/endFrame/shutdown
    - Modify `src/renderer/Renderer2D.cpp`
    - `initialize(Window& window)`: store `window.getSDLRenderer()` pointer, store dimensions, return `true` (or `false` if renderer is null)
    - `beginFrame()`: `SDL_SetRenderDrawColor(0,0,0,255)` + `SDL_RenderClear`
    - `endFrame()`: `SDL_RenderPresent`
    - `shutdown()`: set renderer pointer to null (SDL_Renderer lifetime owned by Window). Idempotent — safe to call multiple times or if never initialized.
    - `renderMap`, `renderEntities`, `renderDialogue`: empty stubs (no-op for bootstrap)
    - Acceptance: Renderer initializes from Window, clears screen to black each frame, presents; no crash on stub calls
    - _Requirements: 4.6, 6.4_

- [x] 10. Implement Application lifecycle
  - [x] 10.1 Implement Application::initialize with ordered pipeline
    - Modify `src/core/Application.cpp`
    - `initialize()`:
      1. `ProjectLoader::load("data/project.json")` → if `nullopt`: `Logger::error`, return `false`
      2. `Logger::info` indicating project loaded successfully with title
      3. `window.initialize(800, 600, projectData.title.c_str())` → if `false`: return `false`
      4. `renderer.initialize(window)` → if `false`: return `false`
      5. `game = make_unique<Game>(); game->initialize(window, projectData)` → if `false`: return `false`
      6. `isRunning = true; return true`
    - `shutdown()`: idempotent/no-op safe — call `renderer.shutdown()` then `window.shutdown()`. Each subsystem checks internally if it was initialized before releasing resources. Safe to call even if `initialize()` failed partially.
    - Acceptance: With valid `data/project.json`, `initialize()` returns `true` and window opens; with invalid project, returns `false` without opening window; calling `shutdown()` after failed `initialize()` does not crash
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.8, 7.4, 7.5_

  - [x] 10.2 Implement Application::run with game loop
    - Modify `src/core/Application.cpp`
    - `run()`: loop while `isRunning`:
      1. `window.processEvents(quit)` → if quit: `isRunning = false`, break (skip render)
      2. `inputManager.update(window)`
      3. Calculate `dt` from `SDL_GetTicks()`
      4. `game->update(inputManager, dt)`
      5. `renderer.beginFrame()`
      6. `game->render(renderer)`
      7. `renderer.endFrame()`
      8. `SDL_Delay(frameDelay)` where frameDelay ≈ 16ms
    - Acceptance: Loop runs at ~60fps; closing window exits cleanly
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 11. Implement main.cpp
  - [x] 11.1 Implement main entry point with Application delegation
    - Modify `src/main.cpp`
    - `int main(int argc, char* argv[])`:
      1. `Logger::info("RPG Creator Runtime starting...")`
      2. Wrap in try/catch(std::exception& e):
         - Instantiate `Application app`
         - `if (!app.initialize())`: `app.shutdown()`, return 1 (do NOT log shutdown-complete message)
         - `app.run()`
         - `app.shutdown()`
         - `Logger::info("RPG Creator Runtime shut down.")` (only after successful run+shutdown)
         - return 0
      3. In catch: `Logger::error(e.what())`, return 1
    - Acceptance: Running executable with valid project opens window; with invalid project exits with code != 0 and error logged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 12. Implement GameState/EventRunner/CollisionSystem stubs connected by composition
  - [x] 12.1 Implement GameState core methods
    - Modify `src/events/GameState.cpp`
    - Implement constructor initializing `playerX=0`, `playerY=0`, `playerDirection=Direction::Down`, empty maps
    - Implement `getFlag`, `setFlag`, `getVariable`, `setVariable`, `addItem`, `hasItem`
    - Acceptance: GameState stores and retrieves flags, variables, inventory, position correctly
    - _Requirements: 6.1_

  - [x] 12.2 Implement EventRunner with warning on unsupported commands
    - Modify `src/events/EventRunner.cpp`
    - Constructor stores references to `GameState` and `DialogueSystem`
    - `runCommandList`: stores command list, sets `executing = true`
    - `update(dt)`: processes commands sequentially; for ANY command type, call `Logger::warning` with the unknown/unsupported type and continue to next command. Do NOT implement showText, transferMap, setFlag, addItem, or any concrete command logic — bootstrap only.
    - `consumeTransferRequest`: returns and resets `transferRequest`
    - Acceptance: All command types produce `[WARN]` log and execution continues; no crash; no concrete command implementations
    - _Requirements: 6.2, 6.7, 6.8_

  - [x] 12.3 Implement CollisionSystem::canMoveTo
    - Modify `src/world/CollisionSystem.cpp`
    - `canMoveTo(scene, targetX, targetY)`: check bounds against `scene.getWidth()`/`scene.getHeight()` and collision layer; return `true` if passable, `false` otherwise
    - Acceptance: Returns `false` for out-of-bounds; returns collision check result for in-bounds positions
    - _Requirements: 6.3_

- [x] 13. Implement Game bootstrap using ProjectData only
  - [x] 13.1 Implement Game::initialize from ProjectData
    - Modify `src/core/Game.cpp`
    - `initialize(window, projectData)`:
      - Store `projectData` in member
      - `state.setCurrentMap(projectData.startMapId)`
      - `state.setPlayerPosition(projectData.startPosition.pos.x, projectData.startPosition.pos.y, projectData.startPosition.direction)`
      - Construct `eventRunner = make_unique<EventRunner>(state, dialogue)`
      - No hardcoded map IDs, event IDs, item IDs, or flag names
      - Return `true`
    - Acceptance: After `initialize`, `state.getCurrentMapId()` equals `startMapId`, player position matches `startPosition`; no string literals for game data in source
    - _Requirements: 6.5, 6.9_

  - [x] 13.2 Implement Game::update and Game::render stubs
    - Modify `src/core/Game.cpp`
    - `update(input, dt)`: delegate to `eventRunner->update(dt)` (movement/input handling is future phase, leave as stub comment)
    - `render(IRenderer& renderer)`: Only calls renderer render methods — `renderer.renderMap(currentScene, camera)`, `renderer.renderEntities(currentScene, state, camera)`, `renderer.renderDialogue(dialogue)`. Does NOT call `renderer.beginFrame()` or `renderer.endFrame()` (Application owns frame boundaries). These are no-op stubs in Renderer2D.
    - Acceptance: `Game::render` receives `IRenderer&` (abstract interface), not concrete SDL type; does NOT call beginFrame/endFrame; compiles and runs without crash
    - _Requirements: 6.4, 6.6_

- [x] 14. Implement main loop ordering
  - [x] 14.1 Verify and fix frame ordering in Application::run
    - Verify `src/core/Application.cpp` `run()` method follows exact order: processEvents → input update → dt calculation → game update → beginFrame → game render → endFrame → delay
    - Verify quit detection skips render phase and breaks loop
    - Verify `shutdown()` is called after loop exits (in `main.cpp`)
    - Fix any ordering discrepancies
    - Acceptance: Frame order matches design spec exactly; SDL_QUIT causes clean exit without rendering partial frame
    - _Requirements: 5.2, 5.4, 5.5_

- [x] 15. Checkpoint - Ensure all code compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Add tests required by the bootstrap spec
  - [x] 16.1 Add/verify all required ProjectLoader test cases
    - Verify `tests/test_project_loader.cpp` contains all 7 test cases from task 7.1
    - Add any missing edge-case tests: empty `maps` array, `startMapId` not matching any map entry
    - Ensure tests do NOT require SDL (pure logic tests)
    - Acceptance: `ctest --test-dir build --output-on-failure` passes all test cases; no SDL dependency in test execution
    - _Requirements: 8.2, 8.3, 8.4_

- [x] 17. Run cmake configure/build/ctest
  - [x] 17.1 Execute full build pipeline
    - Run `cmake -S . -B build` — must complete without errors
    - Run `cmake --build build` — must compile all targets without errors
    - Run `ctest --test-dir build --output-on-failure` — all tests must pass
    - Acceptance: Zero errors in configure, build, and test phases
    - _Requirements: 1.12, 1.13_

- [x] 18. Final checkpoint - Produce validation report
  - [x] 18.1 Produce final validation report
    - Verify all requirements are covered:
      - Req 1: CMake hardened with guards and target checks ✓
      - Req 2: main.cpp delegates to Application with try/catch ✓
      - Req 3: ProjectLoader validates all fields strictly ✓
      - Req 4: Window opens only after valid project load ✓
      - Req 5: Game loop with correct phase ordering ✓
      - Req 6: Architectural seams connected by composition, no hardcoded data ✓
      - Req 7: Logger with info/warning/error to stdout/stderr ✓
      - Req 8: Unit tests for ProjectLoader pass via ctest ✓
    - Verify no forbidden content: no tile rendering, no player movement logic, no event command execution beyond stubs/warnings, no save/load, no visual dialogue, no item database implementation, no combat, no editor, no React/Vite/web
    - Acceptance: All 8 requirements satisfied; bootstrap-only scope maintained
    - _Requirements: All_

## Notes

- All tasks use C++20 with nlohmann/json, doctest, and SDL2 via FetchContent
- No tasks implement behavior beyond bootstrap stubs (rendering, movement, event execution, save/load are future phases)
- `EventRunner` only logs warnings for ALL command types; it does not execute `showText`, `transferMap`, `setFlag`, `addItem`, or any concrete command — bootstrap only
- `Renderer2D` render methods are no-op stubs; only `beginFrame`/`endFrame`/`initialize`/`shutdown` have real implementation
- `Game::render` does NOT call `beginFrame()`/`endFrame()` — Application owns frame boundaries
- `Game::update` is a minimal stub delegating to `eventRunner->update(dt)` only
- `Application::shutdown()` is idempotent/no-op safe — can be called after failed `initialize()`
- The "RPG Creator Runtime shut down." log message is only emitted after successful `run()` + `shutdown()`, never after init failure
- Tests are SDL-free (ProjectLoader is pure logic)
- The only hardcoded path allowed is `"data/project.json"` in Application

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "8.1"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "12.1", "12.2", "12.3"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["13.2", "11.1"] },
    { "id": 11, "tasks": ["14.1"] },
    { "id": 12, "tasks": ["16.1"] },
    { "id": 13, "tasks": ["17.1"] },
    { "id": 14, "tasks": ["18.1"] }
  ]
}
```
