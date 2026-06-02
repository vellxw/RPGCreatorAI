# Architecture

The RPG Creator Runtime is a data-driven engine. It separates logic, rendering, and data.

## Core Principles
- **Engine interprets data.** The engine itself has no hardcoded games.
- **Projects contain data.** Everything from maps to events is defined in JSON.
- **Renderer is abstracted.** `IRenderer` interface separates the logic from the rendering API.
- **EventSystem controls flow.** Commands are executed sequentially by `EventRunner`.
- **State lives in GameState.** All mutable data resides here, making saves trivial.
- **Audio is isolated.** `platform/AudioSystem` is the explicit SDL audio
  boundary; `EventRunner` emits requests and `Game` dispatches them.
- **Plugin commands are deterministic dispatch.** `pluginCommand` data is
  matched against typed allowlisted registry keys such as `debug.log`; it is
  not a scripting VM and never evaluates project-authored code. Unknown safe
  keys are non-fatal extension points, not executable hooks.
- **AI is editor/tooling-only.** The native runtime does not depend on AI
  providers, network access, cloud services, or provider credentials.

## Editor, Desktop Shell, And Runtime Boundary

RPGCreatorAI currently has three runtime contexts:

- Browser editor (`npm run dev`): React/Vite UI only. It can edit through the
  browser adapter, but it cannot spawn native processes, create desktop
  playtest sessions, or read native runtime diagnostics.
- Desktop shell (`npm run desktop:dev`): Tauri hosts the same React editor and
  exposes a narrow IPC surface for project filesystem access, temporary
  playtest session creation, runtime launch/kill/status, runtime diagnostics,
  and recent-project config.
- Native C++ runtime (`rpg_creator_runtime.exe`): reads project JSON from its
  current directory, executes deterministic engine systems, and writes local
  stdout/stderr diagnostics when launched by the desktop shell.

Desktop playtest writes temporary session roots under the app-data directory
and launches the native runtime with that session as `current_dir`; source
project files are not mutated by playtest launch. Runtime logs and snapshots
live under the shared diagnostics folder documented in `docs/DIAGNOSTICS.md`.

The current Windows packaged prototype is an unsigned Tauri debug no-bundle
build with `rpg_creator_runtime.exe` copied beside the produced shell
executable. Packaging policy and commands are documented in
`docs/PHASE_11_RELEASE_ARTIFACT_POLICY.md`, `docs/BUILD_AND_RUN.md`, and
`docs/WINDOWS_BUILD_NOTES.md`.

## What is Engine vs Project
**Engine:**
- File parsing (JSON)
- Collision detection
- Event running (showText, transferMap, etc.)
- Deterministic allowlisted plugin-command dispatch
- Render loop
- Input handling
- Local WAV audio playback when project-owned assets and an audio device exist

**Project:**
- `project.json` (Entry point)
- Maps (`town.json`, `house.json`)
- Entities and their events
- Items Database

## Future Extensions
- **HD-2D:** Because rendering is abstracted via `IRenderer`, a new `HD2DRenderer` can be implemented using Vulkan/OpenGL without touching `EventRunner` or `GameState`.
- **Editor:** The data-driven nature means an editor can just generate the JSON files and spawn the runtime process.
