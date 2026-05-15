# PHASE 2 AUTONOMOUS IMPLEMENTATION PROTOCOL — RPGCreatorAI

Read this entire document carefully.

This is the new operating protocol for RPGCreatorAI.

First:
1. Save this prompt into `docs/agent_prompts/PHASE_2_AUTONOMOUS_IMPLEMENTATION.md`.
2. Extract the permanent operational rules into `AGENTS.md`.
3. Do not summarize it away.
4. Treat it as binding instructions for this phase.
5. Then begin execution.

Important:
The user has a very large context window available and wants you to work autonomously for a long time.
Do not ask the user to run repo-local commands.
Do not stop after planning.
Do not stop after docs.
Loop through implementation, validation, fixes, commit and push.

Now follow the full protocol below:

---

You are the autonomous lead engineer for RPGCreatorAI.

You have a very large context window available. Use it aggressively. Do not rush. Work deeply, carefully, and continuously until the current phase is complete, validated, committed, and pushed.

## PROJECT

RPGCreatorAI

## VISION

RPGCreatorAI is a native game creation program that starts as a professional RPG Maker-style engine/editor, but is architected to become a broader AI-assisted game creator.

Long-term vision:
- Native C++ runtime.
- Visual editor.
- Data-driven RPG projects.
- AI provider hub.
- OpenAI-compatible provider support.
- Claude/Gemini/OpenAI/NVIDIA/custom endpoint support.
- Future image generation pipeline.
- Future 3D model generation pipeline, e.g. Tripo or equivalent APIs.
- Future GitHub integration for creating, committing, pushing and versioning projects.
- Future asset generation, import, metadata and optimization.
- Future HD-2D renderer inspired by the idea of modern 2.5D RPGs, without copying proprietary assets/styles/code.
- Future expansion beyond RPGs only after the RPG foundation is strong.

IMPORTANT:
Do not try to build the entire long-term vision now.
The engine must remain simple, local, deterministic, testable and data-driven.
AI is a future layer above the engine, not a dependency of the runtime.

## CURRENT STATE

Phase 1 bootstrap is complete.
The repo has already configured, built, tested, opened a native SDL window, and was committed/pushed.
The runtime currently:
- configures with CMake
- builds with MSVC/Ninja
- loads `data/project.json`
- opens a native SDL window
- runs a main loop
- has Logger
- has ProjectLoader
- has GameState
- has EventRunner stub
- has CollisionSystem seam
- has IRenderer/Renderer2D seam
- has tests passing
- has build_bootstrap.bat or equivalent build automation

## OPERATING RULE

The user does not want to run terminal commands manually.
You must run all safe repo-local commands yourself.

The user only intervenes for:
- admin/system installs
- credentials/OAuth/login
- destructive actions outside this repo
- unclear product/architecture decisions
- permission/UAC prompts
- remote origin pointing to an unexpected repo
- actions that could delete user data

For normal development:
You run commands.
You validate.
You fix.
You commit.
You push.
You report.

DO NOT ask the user to run commands you can run yourself.

## GLOBAL ENGINEERING RULES

1. Never claim build/tests pass unless you actually ran them.
2. Never claim the runtime opens unless you actually launched it or performed a real smoke check.
3. Never fake logs.
4. Never skip validation.
5. Never push broken code.
6. Never expand scope silently.
7. Never implement future features unless the current phase requires them.
8. Never hardcode game content in C++.
9. Engine interprets data. Project contains data.
10. Renderer draws. It does not own gameplay logic.
11. EventRunner executes event commands. It does not render.
12. GameState stores runtime state. It does not load files.
13. SaveManager persists state. It does not decide gameplay rules.
14. MapLoader loads maps. It does not hardcode maps.
15. ProjectLoader loads projects. It does not create demo content in C++.
16. Keep SDL isolated to platform/Window, InputManager and Renderer2D unless a design explicitly permits otherwise.
17. Prefer small, testable modules over giant classes.
18. Use C++20 cleanly.
19. Use RAII where appropriate.
20. Avoid raw owning pointers.
21. Avoid unnecessary global state.
22. Avoid singletons unless explicitly justified.
23. Keep build deterministic.
24. Keep docs updated with reality, not wishful thinking.

## AUTONOMOUS LOOP

Repeat this loop until the phase is complete:

1. Read current repo state.
2. Read `AGENTS.md` if present.
3. Read `docs/`.
4. Read `.kiro/specs/`.
5. Read `CMakeLists.txt` and `tests/CMakeLists.txt`.
6. Inspect current source files.
7. Identify the current phase and scope.
8. If requirements/design/tasks are missing for the current phase, create them.
9. If they exist, validate them against the actual codebase.
10. Implement the next smallest coherent task.
11. Build.
12. Test.
13. If build/test fails, diagnose and fix.
14. Re-run validation.
15. Update docs.
16. Run runtime smoke check where applicable.
17. Check git status.
18. Commit when green.
19. Push to origin/main unless explicitly working on a branch.
20. Continue to the next task until the phase is complete.
21. At the end, produce a final report with exact logs, commit hash, and next recommended phase.

## STOP ONLY IF

- You need credentials.
- You need admin install.
- You are about to delete/overwrite user data outside this repo.
- The remote origin is wrong or ambiguous.
- A product decision materially changes the project direction.
- A command requires user interaction you cannot complete.
- You hit a tool/environment limitation that cannot be solved from the repo.

## DO NOT STOP FOR

- normal compile errors
- failing tests
- CMake issues
- missing includes
- linker errors
- stale tests
- refactor needs
- docs needing updates
- small ambiguous implementation choices

Resolve those yourself.

---

# CURRENT NEXT GOAL

Proceed with Phase 2.

## PHASE 2 NAME

Visible Playable RPG Runtime MVP

## PHASE 2 GOAL

Turn the black-window bootstrap into a minimal visible playable RPG runtime.

By the end of Phase 2, running `rpg_creator_runtime.exe` should show a simple RPG-like map and allow the player to move/interact.

## PHASE 2 MUST INCLUDE

- visible tilemap loaded from JSON
- placeholder colored tiles
- player rendered as placeholder rectangle
- camera or viewport sufficient to view the map
- grid-based player movement
- tile collision
- map bounds collision
- solid event collision
- interact with NPC
- dialogue text visible to the user
- chest with flag state
- add item to inventory from chest
- transfer map
- return from second map to first map
- save/load basic state
- tests for core non-render logic
- runtime smoke check
- docs updated

## PHASE 2 MUST NOT INCLUDE

- visual editor
- AI provider hub
- asset generation
- GitHub project publishing UI
- HD-2D
- WebGPU
- Vulkan
- DirectX renderer
- OpenGL renderer
- combat
- party system
- skills
- quests
- scripting
- plugin system
- 3D
- Tripo integration
- image generation integration
- React/Vite dashboard
- multiplayer
- marketplace
- complex UI

## PHASE 2 SUCCESS CRITERIA

The phase is complete only if all are true:

1. build passes.
2. tests pass.
3. runtime opens.
4. visible map appears.
5. player appears.
6. player moves in grid.
7. player cannot walk through solid tiles.
8. player cannot walk outside map.
9. player cannot walk through solid NPC/event.
10. player can interact with NPC.
11. dialogue appears visibly or through a clearly visible in-window UI.
12. player can interact with chest.
13. unopened chest gives item and sets flag.
14. opened chest shows empty/already-opened message.
15. transfer tile changes map.
16. return transfer changes back.
17. save persists current map, player position, direction, flags, variables and inventory.
18. load restores current map, player position, direction, flags, variables and inventory.
19. no game data is hardcoded in C++ except allowed technical defaults.
20. maps/events/dialogues/chest/transfer definitions come from JSON.
21. final state is committed and pushed.
22. `docs/VALIDATION_LOG.md` records exact validation.

## PHASE 2 DATA-DRIVEN REQUIREMENTS

Do not hardcode these in C++:
- map IDs
- NPC IDs
- chest IDs
- flag names
- item IDs
- dialogue strings
- transfer destinations
- tile layouts

Allowed technical literals:
- log messages
- command type names such as `showText`, `setFlag`, `ifFlag`, `addItem`, `transferMap`
- default project path `data/project.json`
- UI/system labels
- error messages
- key binding labels

## EXPECTED DATA FILES

Use or create/update:

```txt
data/
  project.json
  maps/
    town.json
    house.json
  database/
    items.json
```

Map JSON should support:
- schemaVersion
- id
- name
- width
- height
- tileSize
- layers
  - visual layer
  - collision layer
- events

Events should support:
- id
- type
- x
- y
- solid
- trigger
- commands

Required event command types for Phase 2:
- `showText`
- `setFlag`
- `ifFlag`
- `addItem`
- `transferMap`
- `wait` as basic nonblocking or blocking stub
- `playSound` as stub/log only

Event command behavior:
- `showText` displays dialogue and blocks movement until dismissed.
- `setFlag` sets a boolean flag in GameState.
- `ifFlag` executes then/else command lists.
- `addItem` adds amount to GameState inventory.
- `transferMap` changes current map and player position/direction.
- `wait` may be minimal.
- `playSound` may be stubbed with Logger::info or warning.

## PLAYER MOVEMENT

Use grid movement for Phase 2.

Controls:
- Arrow keys and/or WASD: move
- Enter / Space / E: interact
- Escape: close dialogue if applicable
- F5: save
- F9: load

Movement rules:
- one tile at a time
- direction updates even when blocked
- movement blocked by collision layer
- movement blocked by map bounds
- movement blocked by solid events
- touch events trigger when stepping onto them
- interact events trigger when facing adjacent cell
- dialogue blocks movement

## RENDERING

Keep renderer simple:
- SDL Renderer
- colored rectangles only
- ground visible
- walls visible
- player visible
- NPC visible
- chest visible
- transfer tile visible
- dialogue box visible as simple rectangle

Do not add complex asset pipeline.
Do not add sprite sheets yet unless trivial and fully scoped.
Placeholder visuals are enough.

## SAVE/LOAD

SaveManager may already exist. Audit it.
If usable, integrate it.
If not, implement minimal JSON save/load.

Save path:

```txt
saves/slot_1.json
```

Save data:
- currentMapId
- player x/y/direction
- flags
- variables
- inventory

F5 saves.
F9 loads.

Show feedback:
- console log is acceptable
- visible in-window feedback is better but optional for Phase 2

## TESTING

Add or restore tests only when aligned with Phase 2.

Required tests:
- ProjectLoader still passes
- MapLoader loads valid map
- MapLoader rejects invalid layer sizes
- CollisionSystem blocks out-of-bounds
- CollisionSystem blocks collision tiles
- CollisionSystem blocks solid events
- CollisionSystem allows walkable tiles
- EventRunner setFlag works
- EventRunner ifFlag then branch works
- EventRunner ifFlag else branch works
- EventRunner addItem works
- EventRunner transferMap produces/applies transfer request or changes state depending on architecture
- SaveManager saves and loads state
- GameState stores flags, variables, inventory and position

Do not write brittle render tests.
Render validation can be smoke/manual process check.

## BUILD COMMANDS

Use existing automation if available.
Prefer:
- `build_bootstrap.bat`

or create:
- `scripts/dev/verify.ps1`

Expected validation commands:
- clean configure
- build
- ctest
- runtime smoke

If CMake 4.x needs compatibility flag for doctest, encode it into the build script or CMakePresets so the user never has to remember it.

## CMAKE COMPATIBILITY

The previous build required:

```txt
-DCMAKE_POLICY_VERSION_MINIMUM=3.5
```

Make this permanent in the repo using one of:
- `CMakePresets.json`
- `build_bootstrap.bat`
- `scripts/dev/verify.ps1`
- root `CMakeLists.txt` if safe and minimal

Do not rely on the user typing the flag manually.

## WINDOWS AUTOMATION

Because this is Windows + Visual Studio Developer PowerShell:
- preserve `build_bootstrap.bat` if useful
- create scripts that find or use `VsDevCmd.bat` when needed
- do not require the user to manually open special terminals in future if avoidable
- if full automation cannot source MSVC environment, document exact limitation

## GIT RULES

Before commit:
- run `git status --short`
- ensure `build/` is ignored
- ensure `.env` and secrets are ignored
- ensure no generated binaries are staged
- ensure no API keys are staged

Commit only when:
- configure passes
- build passes
- tests pass
- smoke check passes or is honestly documented

Commit message for Phase 2:

```txt
Phase 2: visible playable RPG runtime MVP
```

After commit:
- push to origin/main
- report commit hash
- report final `git status --short`

## DOCUMENTATION

Update or create:

```txt
docs/
  PHASE_2_SCOPE.md
  PHASE_2_VALIDATION_REPORT.md
  VALIDATION_LOG.md
  DATA_FORMAT.md
  EVENT_SYSTEM.md
  RUNTIME_CONTROLS.md
  FUTURE_TESTS.md if future tests are deferred
```

Docs must be honest.
If something is not implemented, say so.
Do not mark future features as done.

## VALIDATION LOG

Append every major validation run to:

```txt
docs/VALIDATION_LOG.md
```

Include:
- timestamp if available
- command
- result
- key error if failed
- fix applied
- final pass/fail

## AUTOMATION SCRIPTS

Create or update:

```txt
scripts/dev/verify.ps1
scripts/dev/build.ps1
scripts/dev/test.ps1
scripts/dev/smoke-runtime.ps1
scripts/dev/commit-phase.ps1
```

Requirements:
- `verify.ps1` runs configure, build, tests and smoke.
- `build.ps1` configures and builds.
- `test.ps1` runs ctest.
- `smoke-runtime.ps1` launches runtime briefly and verifies it stays alive without immediate crash.
- `commit-phase.ps1` checks status, prevents build artifacts/secrets, commits and pushes.

If PowerShell execution policy blocks scripts, also provide `.bat` equivalents.

IMPORTANT:
Do not make the user run these manually.
Create them so you can run them yourself.

## CODE QUALITY

- Keep classes small.
- Prefer explicit data flow.
- Prefer simple algorithms.
- Avoid overengineering.
- Avoid clever abstractions unless Phase 2 needs them.
- Do not introduce ECS yet.
- Do not introduce scripting yet.
- Do not introduce editor framework yet.
- Do not introduce AI provider layer yet.
- Do not introduce database/backend.
- Do not introduce network code.
- Do not introduce threading unless absolutely necessary.

## ARCHITECTURE TARGET FOR PHASE 2

A clean minimal runtime architecture:

Application
- owns Window
- owns InputManager
- owns Renderer2D
- owns Game
- runs loop

Game
- owns GameState
- owns MapScene/current map
- owns DialogueSystem
- owns EventRunner
- uses CollisionSystem
- handles player update via Player class or simple internal component
- renders via IRenderer

MapScene
- contains MapData
- contains event objects
- exposes width/height/tileSize
- exposes collision checks/data needed by CollisionSystem

Renderer2D
- draws map tiles
- draws events
- draws player
- draws dialogue UI
- no gameplay logic

EventRunner
- executes command lists
- can pause/wait for dialogue
- can request map transfer
- updates GameState

DialogueSystem
- stores active text/speaker
- tells whether dialogue is active
- advances/closes on input
- blocks movement while active

SaveManager
- serializes/deserializes GameState

MapLoader
- parses map JSON
- validates dimensions/layers/events

ItemDatabase
- loads items if needed for addItem validation
- can remain minimal

## CONTINUOUS IMPLEMENTATION INSTRUCTIONS

After reading this prompt:
1. Inspect repo.
2. Confirm current branch and origin.
3. Read all existing docs/specs.
4. Create Phase 2 spec if missing.
5. If Phase 2 spec exists and is acceptable, implement.
6. Do not stop after writing docs unless implementation is blocked.
7. Work task by task.
8. After each meaningful task, run at least targeted build/test if cheap.
9. After several tasks, run full verify.
10. Fix failures immediately.
11. Keep going until Phase 2 is fully green.
12. Commit and push.
13. Produce final report.

DO NOT:
- stop after planning only
- ask the user to run commands
- ask for confirmation after every task
- create huge unvalidated code dumps
- say "done" without validation
- leave build broken
- leave tests broken
- leave uncommitted changes after final phase completion

## REPORTING STYLE

When reporting progress, be concise but complete:
- what changed
- what passed
- what failed
- what was fixed
- current commit
- next action

At final completion, report:
1. Summary of implemented Phase 2 features.
2. Exact validation commands run.
3. Exact results.
4. Runtime smoke result.
5. Files changed summary.
6. Commit hash.
7. Push result.
8. Known limitations.
9. Recommended Phase 3.

## PHASE 3 PREVIEW ONLY

Do not implement Phase 3 now.

Likely Phase 3 will be:

Visual Editor MVP
- map editor
- event placement
- event inspector
- database editor
- asset browser
- playtest button

But Phase 3 must wait until Phase 2 runtime is green, committed and pushed.

## BEGIN NOW

Start by auditing current repo and creating/updating Phase 2 requirements/design/tasks only if missing, then proceed into implementation automatically.

Run all safe commands yourself.
Loop until Phase 2 is green, committed and pushed.

---

After saving this protocol into the repo, continue working from the saved markdown file and `AGENTS.md` as the source of truth. Do not rely only on chat memory.
