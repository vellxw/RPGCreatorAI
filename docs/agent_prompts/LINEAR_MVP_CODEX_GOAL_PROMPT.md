# Codex Goal Prompt - Linear MVP Execution

Use this prompt to start a fresh Codex goal/thread that executes the
RPGCreatorAI MVP Linear backlog from beginning to end.

```text
You are Codex working in the local repository:

C:\Users\franc\OneDrive\Escritorio\RPGCreatorAI

Create or use a Codex goal with this objective:

Complete every issue in the Linear project "RPGCreatorAI Usable MVP"
from FRA-5 through FRA-35, one issue at a time, with real repo-local
implementation, validation, documentation updates, commits, pushes, and
Linear updates, until the MVP is fully usable and the final green gate is
complete.

Linear context:
- Team: Franco Company
- Team ID: 4ce2f3f6-3c39-4b6a-8dc0-4db95a3e503f
- Project: RPGCreatorAI Usable MVP
- Project ID: 069eb326-7867-4a94-807f-45a244447eb6
- Project URL: https://linear.app/franco-company/project/rpgcreatorai-usable-mvp-985bf50e66d3
- Statuses available:
  - Backlog: d01c14a2-1049-4cc5-88b5-4a7ff541e978
  - Todo: 8fc5328c-f139-49cb-84ff-409167ecec2d
  - In Progress: ac006149-8259-43e5-aa63-df530f2298d6
  - In Review: 004426b1-3c0c-42e8-a0a9-b4410cffa3f0
  - Done: fe794f4e-1a4d-416c-a466-49c3ac860d3d

Primary sources of truth:
- AGENTS.md
- docs/GOAL_STACK.md
- docs/GAME_VISUAL_DESIGN.md
- docs/superpowers/plans/2026-06-01-rpgcreatorai-mvp-linear-backlog.md
- .kiro/specs/
- CMakeLists.txt
- tests/CMakeLists.txt
- The current Linear issue description and comments for the issue being executed

Non-negotiable operating rules:
- Do not ask the user to run commands that you can run yourself.
- Run safe repo-local commands yourself.
- Stop only for credentials, admin installs, destructive actions outside
  this repo, an unexpected remote origin, material product direction
  changes, unavoidable interactive commands, or an environment/tool
  limitation that cannot be solved from the repo.
- Never claim build/tests/smoke checks pass unless they were actually run.
- Never fake logs.
- Never push broken code.
- Never silently expand scope beyond the active Linear issue.
- Never implement future-phase features unless the active issue explicitly
  requires them.
- Keep the engine local, deterministic, testable, data-driven, and free of
  runtime AI dependencies.
- Do not hardcode game content in C++.
- Keep SDL isolated to platform/Window, platform/InputManager, and
  renderer/Renderer2D unless an existing design explicitly permits more.
- Preserve unrelated user changes. Do not revert files you did not change.

Skills/tools to use when available:
- Use the Linear plugin/app to read issues, update issue status, and post
  progress comments.
- Use superpowers:using-superpowers at the start if available.
- Use superpowers:test-driven-development for feature/bug implementation
  when practical.
- Use superpowers:systematic-debugging before fixing unexpected failures.
- Use superpowers:verification-before-completion before claiming an issue is
  complete.
- Use rg before slower search tools.

Execution mode:
- Work sequentially by default: complete one Linear issue fully before
  starting the next one.
- Do not dispatch parallel subagents unless the user explicitly asks for
  parallel execution in that session.
- If parallel execution is explicitly requested later, only dispatch issues
  marked parallel-safe and keep integration gate issues sequential.
- Integration issues INT-001 through INT-005 must remain sequential even in
  parallel mode.

Issue execution order:
1. FRA-5  - MVP-000 - Lock MVP Scope And Linear Tracking Metadata
2. FRA-6  - DB-001 - Extract Database V2 Editor Framework
3. FRA-7  - DB-002 - Add Types And Terms Database Shards
4. FRA-8  - DB-003 - Build Dedicated Tileset Database Editor
5. FRA-9  - DB-004 - Build Items, Weapons, Armors, And States V2 Editors
6. FRA-10 - DB-005 - Build Actors, Classes, Skills, Enemies, And Troops V2 Editors
7. FRA-11 - DB-006 - Build Quests, Shops, Switches, Variables, And System V2 Editors
8. FRA-12 - DB-007 - Add Common Event Command Editing
9. FRA-13 - DB-008 - Build Animation Database V2 Editor With Preview
10. FRA-14 - DB-009 - Database Delete/Rename Reference Safety
11. FRA-15 - RT-001 - Add Runtime Project Validator Seam
12. FRA-16 - RT-002 - Implement Interactive Runtime Choices UI
13. FRA-17 - RT-003 - Implement Event Target Movement Routes
14. FRA-18 - RT-004 - Implement Event Priority, Y-Sort, And Above/Below Rendering
15. FRA-19 - RT-005 - Render Foreground Layer As Occlusion
16. FRA-20 - RT-006 - Add Local Audio V1
17. FRA-21 - RT-007 - Add Deterministic Plugin Command V1
18. FRA-22 - PT-001 - Add Playtest Session Builder For Current Map And Selected Event
19. FRA-23 - PT-002 - Add Runtime Log Viewer And Bounded Log Reading
20. FRA-24 - PT-003 - Add Event Trace Output
21. FRA-25 - PT-004 - Add Runtime State Snapshot Inspector
22. FRA-26 - PT-005 - Remove Or Gate Placeholder AI Debug UI
23. FRA-27 - QA-001 - Expand Bundled Sample To Exercise MVP Features
24. FRA-28 - QA-002 - Add Editor Runtime Roundtrip For MVP Playtest Modes
25. FRA-29 - QA-003 - Add Runtime Smoke Coverage For Choices, Movement, Audio, And Foreground
26. FRA-30 - QA-004 - Full Verification Script For MVP Green Gate
27. FRA-31 - INT-001 - Integrate Database V2 Branches
28. FRA-32 - INT-002 - Integrate Runtime MZ Foundation Branches
29. FRA-33 - INT-003 - Integrate Playtest And Debug Tooling Branches
30. FRA-34 - INT-004 - MVP Documentation And User Workflow Closeout
31. FRA-35 - INT-005 - Final MVP Green Gate, Commit, Push, And Report

Startup checklist:
1. Read AGENTS.md completely.
2. Read docs/GOAL_STACK.md and docs/GAME_VISUAL_DESIGN.md.
3. Read docs/superpowers/plans/2026-06-01-rpgcreatorai-mvp-linear-backlog.md.
4. Inspect .kiro/specs/, CMakeLists.txt, tests/CMakeLists.txt, and the
   source areas relevant to the first incomplete issue.
5. Run git status --short and identify any existing user changes.
6. Verify git remote -v. If origin is missing or points to an unexpected
   repository, stop and ask the user.
7. Fetch/list the Linear issues in the MVP project and determine the first
   issue in the order above that is not Done.
8. Continue from that issue. If an issue is already Done, verify the repo
   state enough to avoid duplicating work, then skip it.

Per-issue loop:
1. Fetch the current Linear issue, including description, labels,
   milestone, and comments.
2. Move the issue to In Progress.
3. Post a short Linear comment:
   - starting issue identifier/title
   - implementation scope
   - validation commands expected for the issue
   - any known repo/user changes that must be preserved
4. Read the relevant code and tests before editing.
5. Implement the smallest coherent change that fully satisfies the issue
   acceptance criteria.
6. Add or update tests at the correct level for the risk:
   - unit tests for pure logic/schema/validation
   - reducer/component tests for editor behavior
   - C++ tests for runtime loaders/systems/event behavior
   - smoke/e2e scripts for editor-runtime flows
7. Update docs when behavior, data formats, workflows, validation, or
   phase status changed. Always append major validation runs to
   docs/VALIDATION_LOG.md with command, result, key error if failed, fix
   applied, and final pass/fail.
8. Run focused validation first. If it fails, diagnose and fix it yourself.
9. Run the issue's required validation from the Linear description and the
   local MVP plan.
10. Run broader regression validation when the issue touches shared data,
    runtime behavior, serialization, CMake, Tauri/Rust commands, sample
    project data, or build scripts.
11. Run runtime smoke checks when the issue affects runtime rendering,
    playtest, input, audio, logs, event execution, or sample project flows.
12. Run git status --short and inspect the diff.
13. Ensure build/, .env, secrets, generated binaries, API keys, and
    unrelated user changes are not staged.
14. Commit only after required validation is green or an allowed smoke
    limitation is documented honestly in the issue and validation log.
15. Push according to AGENTS.md: push to origin/main unless this session is
    explicitly working on an issue branch.
16. Post a Linear completion comment with:
    - files/areas changed
    - exact validation commands and results
    - commit hash
    - push result
    - known limitations, if any
17. Move the issue to Done only after implementation, validation, commit,
    and push are complete.
18. Continue immediately to the next issue in the ordered list.

Git policy:
- Default to the repo policy in AGENTS.md: commit and push to origin/main
  after each green issue.
- If the current session or user explicitly chooses branch-per-issue work,
  use branch names with the codex/ prefix, for example:
  codex/FRA-16-runtime-choices-ui
- Never use git reset --hard or checkout to discard changes unless the
  user explicitly requested that exact destructive operation.
- Do not revert unrelated user changes.
- Before each commit run:
  git status --short
- After each commit and push, report the commit hash in Linear.

Validation policy:
- Never claim validation passed without running commands.
- Prefer the repository's existing validation scripts.
- If a validation command is missing or broken, fix the repo-local script
  when that is in scope; otherwise document the limitation and run the
  closest meaningful validation.
- For every major validation run, append to docs/VALIDATION_LOG.md.
- A failed validation is not a blocker by itself. Debug and fix it.
- Do not move a Linear issue to Done until validation evidence exists.

Documentation policy:
- Keep docs synchronized with reality, not intent.
- Update docs/GOAL_STACK.md at slice boundaries or when a subgoal is
  actually completed.
- Update data-format/runtime/editor docs when schemas, commands, project
  structure, validation rules, or workflows change.
- Do not create wish-list documentation for future phases inside the MVP
  unless the active issue requires a documented limitation.

Architecture constraints:
- Application owns Window, InputManager, Renderer2D, and Game.
- Game owns GameState, current MapScene, DialogueSystem, EventRunner, and
  uses CollisionSystem.
- Renderer2D draws only; it does not own gameplay logic.
- EventRunner executes commands only; it does not render.
- GameState stores runtime state; it does not load files.
- SaveManager persists state; it does not decide gameplay rules.
- MapLoader loads and validates map JSON; it does not hardcode maps.
- ProjectLoader loads projects; it does not create demo content in C++.
- Use C++20 cleanly, RAII where appropriate, and avoid raw owning pointers.
- Avoid ECS, scripting engines, provider layers, database/backend, network
  code, or unnecessary threading for this MVP.

MVP definition of done:
- All FRA-5 through FRA-35 are Done in Linear.
- Database V2 editors are usable for the MVP data shards.
- Runtime supports the required MZ-style foundation behavior.
- Playtest/debug tooling is usable from the editor.
- Bundled sample exercises the MVP feature set.
- Full verification script exists and passes.
- Runtime smoke coverage is run and documented.
- docs/VALIDATION_LOG.md contains the validation evidence.
- docs/GOAL_STACK.md and relevant docs reflect completed work.
- Final git status is clean except for explicitly documented user-owned
  changes.
- Final commit hash and push result are reported.
- Final Linear project status update summarizes completed scope, validation,
  known limitations, and recommended next phase.

Final report format:
- Completed Linear range and project URL.
- Implemented feature summary.
- Exact validation commands and pass/fail results.
- Runtime smoke result.
- Files/areas changed summary.
- Commit hash or hashes.
- Push result.
- Final git status --short.
- Known limitations.
- Recommended next phase.

Start now with the startup checklist, then execute the first incomplete
issue in the ordered list. Keep going issue by issue until the goal is
complete or until one of the explicit stop conditions is reached.
```
