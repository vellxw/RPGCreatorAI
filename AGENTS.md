# AGENTS.md — Permanent Operational Rules for RPGCreatorAI

## Current Phase: Phase 10 — Professional RPG Maker MZ-style Editor Adaptation

This file is the source of truth for all autonomous agents working on
RPGCreatorAI. It distills the permanent operational rules from the phase
protocols (see `docs/agent_prompts/`).

## Visual Source of Truth

`docs/GAME_VISUAL_DESIGN.md` is the binding source of truth for authored
game visuals: viewport behavior, aspect ratios, camera framing, tile
alignment, scene composition, preview rules, and runtime presentation.
When visual implementation details conflict with older screenshots or
phase notes, follow `docs/GAME_VISUAL_DESIGN.md`.

## Project

**RPGCreatorAI** — a native game creation program that starts as a
professional RPG Maker–style engine/editor, architected to expand into a
broader AI-assisted game creator.

The engine remains simple, local, deterministic, testable, and data-driven.
AI is a future layer above the engine, never a runtime dependency.

## Operating Rule for Agents

The user does not want to run terminal commands manually. Agents must run
all safe repo-local commands themselves.

The user only intervenes for:
- admin/system installs
- credentials/OAuth/login
- destructive actions outside this repo
- unclear product/architecture decisions
- permission/UAC prompts
- remote origin pointing to an unexpected repo
- actions that could delete user data

For normal development the agent: runs commands, validates, fixes,
commits, pushes, and reports. **Do not** ask the user to run commands the
agent can run itself.

## Stop only if

- credentials are required
- admin install is required
- about to delete/overwrite user data outside this repo
- remote origin is wrong or ambiguous
- a product decision materially changes project direction
- a command requires user interaction the agent cannot complete
- a tool/environment limitation cannot be solved from the repo

## Do not stop for

- normal compile errors, linker errors, missing includes
- failing tests, stale tests
- CMake issues
- refactor needs, docs needing updates
- small ambiguous implementation choices

The agent resolves these itself.

## Global Engineering Rules

1. Never claim build/tests pass unless they were actually run.
2. Never claim the runtime opens unless launched or a real smoke check ran.
3. Never fake logs.
4. Never skip validation.
5. Never push broken code.
6. Never expand scope silently.
7. Never implement future-phase features unless the current phase requires them.
8. Never hardcode game content in C++.
9. Engine interprets data. Project contains data.
10. Renderer draws. It does not own gameplay logic.
11. EventRunner executes event commands. It does not render.
12. GameState stores runtime state. It does not load files.
13. SaveManager persists state. It does not decide gameplay rules.
14. MapLoader loads maps. It does not hardcode maps.
15. ProjectLoader loads projects. It does not create demo content in C++.
16. Keep SDL isolated to `platform/Window`, `platform/InputManager`, and
    `renderer/Renderer2D` unless a design explicitly permits otherwise.
17. Prefer small, testable modules over giant classes.
18. Use C++20 cleanly.
19. Use RAII where appropriate.
20. Avoid raw owning pointers.
21. Avoid unnecessary global state.
22. Avoid singletons unless explicitly justified.
23. Keep the build deterministic.
24. Keep docs updated with reality, not wishful thinking.

## Autonomous Loop

1. Read repo state.
2. Read `AGENTS.md`.
3. Read `docs/`.
4. Read `.kiro/specs/`.
5. Read `CMakeLists.txt` and `tests/CMakeLists.txt`.
6. Inspect current source files.
7. Identify the current phase and scope.
8. If requirements/design/tasks are missing, create them.
9. If they exist, validate them against the actual codebase.
10. Implement the next smallest coherent task.
11. Build.
12. Test.
13. Diagnose and fix any failures.
14. Re-run validation.
15. Update docs.
16. Run runtime smoke check where applicable.
17. Check git status.
18. Commit when green.
19. Push to `origin/main` unless explicitly working on a branch.
20. Continue to the next task until the phase is complete.
21. At phase end produce a final report with exact logs, commit hash, and
    next recommended phase.

## Architecture Targets

### Application
- owns Window, InputManager, Renderer2D, Game
- runs the main loop

### Game
- owns GameState, MapScene (current map), DialogueSystem, EventRunner
- uses CollisionSystem
- handles player update via a Player class or simple internal component
- renders via `IRenderer`

### MapScene
- contains MapData and event objects
- exposes width/height/tileSize and collision checks needed by
  CollisionSystem

### Renderer2D
- draws map tiles, events, player, dialogue UI
- contains no gameplay logic

### EventRunner
- executes command lists, can pause/wait for dialogue, can request map
  transfer, updates GameState

### DialogueSystem
- stores active text/speaker, reports active state, advances/closes on
  input, blocks movement while active

### SaveManager
- serializes/deserializes GameState

### MapLoader
- parses map JSON; validates dimensions, layers, events

### ItemDatabase
- loads items if needed for `addItem` validation; minimal is fine

## Code Quality

- Keep classes small.
- Prefer explicit data flow.
- Prefer simple algorithms.
- Avoid overengineering and clever abstractions unless the current phase
  demands them.
- Do not introduce ECS, scripting, editor framework, AI provider layer,
  database/backend, network code, or unnecessary threading.

## Build / CMake

- Repo must build from a clean clone with no manual flags.
- The CMake-policy compatibility flag (`-DCMAKE_POLICY_VERSION_MINIMUM=3.5`)
  must live inside `CMakePresets.json`, build scripts, or
  `CMakeLists.txt` — never relied on from the command line.
- Provide PowerShell scripts under `scripts/dev/` and `.bat` equivalents
  for users with restricted execution policies.

## Git Rules

Before commit:
- run `git status --short`
- ensure `build/`, `.env`, secrets, generated binaries, API keys are not
  staged

Commit only when:
- configure passes
- build passes
- tests pass
- smoke check passes or is honestly documented

After commit:
- push to `origin/main`
- report commit hash
- report final `git status --short`

## Validation Log

Append every major validation run to `docs/VALIDATION_LOG.md`:
- timestamp if available
- command
- result
- key error if failed
- fix applied
- final pass/fail

## Reporting Style

Concise but complete:
- what changed, what passed, what failed, what was fixed
- current commit
- next action

At phase completion, report: implemented features, exact validation
commands and results, runtime smoke result, files changed summary, commit
hash, push result, known limitations, recommended next phase.

## Phase Protocols

Detailed per-phase protocols live under `docs/agent_prompts/` and remain
binding for that phase. The current active implementation direction is
tracked in `docs/GOAL_STACK.md` and visually governed by
`docs/GAME_VISUAL_DESIGN.md`.
