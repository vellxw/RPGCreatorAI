# Phase 11 Packaging Integration Gate

CP-016 / FRA-51 closes milestone 01, Release Hardening And Packaging. The
gate verified that the Windows build scripts, local package prototype, runtime
launch path, release docs, and validation evidence are coherent enough for
downstream usability work to depend on them.

Date: 2026-06-01

Validated repository state before this report: `7900e3b`
(`docs: refresh build and packaging workflow`). The CP-016 report commit hash
is recorded in the Linear closure comment because a commit cannot stably
contain its own hash.

## Inputs Reviewed

- `AGENTS.md`
- `docs/GOAL_STACK.md`
- `docs/PHASE_10_MVP_VALIDATION_REPORT.md`
- `docs/BUILD_AND_RUN.md`
- `docs/WINDOWS_BUILD_NOTES.md`
- `docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`
- `docs/FIRST_RUN_APP_DATA_POLICY.md`
- `docs/DIAGNOSTICS.md`
- `.kiro/specs/phase11-complete-product-platform/tasks.md`
- `CMakeLists.txt`
- `tests/CMakeLists.txt`
- `package.json`
- Linear issue `FRA-51`

## Gate Result

Milestone 01 is green for downstream user-flow testing:

- The canonical local Windows gate passed with frontend typecheck, full
  Vitest, frontend build, native C++ configure/build/CTest, Tauri content
  check, Rust desktop tests, runtime smoke, and editor-runtime screenshot
  roundtrip.
- The documented package smoke command passed and produced the unsigned
  Tauri debug no-bundle shell with `rpg_creator_runtime.exe` colocated beside
  it.
- Package and native build outputs remain outside the repository under
  `%LOCALAPPDATA%\RPGCreatorAI`.
- Repo-local generated outputs remain ignored, and no generated binaries,
  app-data files, secrets, signing credentials, package outputs, or build
  artifacts were staged.
- Build/run/package docs match the validated command names, output markers,
  package locations, known non-fatal warnings, and signing/credential
  boundaries.

## Validation Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
npm run desktop:package:windows
```

Additional integration checks:

```powershell
Test-Path "$env:LOCALAPPDATA\RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe"
Test-Path "$env:LOCALAPPDATA\RPGCreatorAI\tauri-target\debug\rpg_creator_runtime.exe"
git status --short --ignored
```

## Validation Result

- `scripts/dev/verify.ps1` — PASS, `=== ALL PASSED ===`.
- Frontend tests inside the gate — PASS, 36 files and 222 tests.
- Native CTest inside the gate — PASS, 1/1 tests.
- Rust desktop tests inside the gate — PASS, 30 tests.
- Runtime smoke inside the gate — PASS, `SMOKE PASSED`.
- Editor/runtime screenshot roundtrip inside the gate — PASS with different
  baseline and edited screenshot hashes.
- `npm run desktop:package:windows` — PASS, `PACKAGED SMOKE PASSED` and
  `=== WINDOWS PACKAGE PROTOTYPE PASSED ===`.
- Package artifact existence checks — PASS for both
  `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe` and
  `%LOCALAPPDATA%\RPGCreatorAI\tauri-target\debug\rpg_creator_runtime.exe`.

Known non-fatal warnings matched the docs: Vite chunk-size warning, CMake
FetchContent CMP0135 developer warnings, dependency `cmake_minimum_required`
deprecation warnings, missing PkgConfig, and optional audio warnings during
runtime smoke.

## Artifact And Staging Check

`git status --short --ignored` showed only the pre-existing untracked
`docs/agent_prompts/LINEAR_MVP_CODEX_GOAL_PROMPT.md` plus ignored local
outputs:

- `.vscode/`
- `build/`
- `dist/`
- `node_modules/`
- `saves/slot_1.json`
- `src-tauri/gen/`

Those outputs were not staged for CP-016.

## Downstream Readiness

CP-017 may begin the end-to-end usability milestone. Future user-flow testing
can rely on:

- `scripts/dev/verify.ps1` as the canonical local green gate.
- `npm run desktop:package:windows` as the current unsigned package prototype
  and packaged-app smoke command.
- App-data and package outputs being kept outside the repo.
- Runtime diagnostics and first-run locations being documented and validated.

Signing, installer creation, store upload, release credentials, and publisher
identity remain outside autonomous repo-local work until a future issue and
explicit user-provided credentials require them.
