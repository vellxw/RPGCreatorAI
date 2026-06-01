# RPGCreatorAI

RPGCreatorAI is an experimental open source RPG creation toolkit: a React/Tauri editor paired with a native C++ runtime. The project starts from a professional RPG Maker-style workflow and is being built toward AI-assisted game creation while keeping the engine local, deterministic, and data-driven.

![RPGCreatorAI editor screenshot](docs/screenshots/game-visual-design/01-editor-16x9-map.png)

## Why This Exists

Most RPG creation tools are either closed, plugin-heavy, or hard to automate. RPGCreatorAI is designed as a hackable editor/runtime stack where game data stays in JSON, the runtime interprets data instead of hardcoding content, and future AI features can generate or edit projects without becoming a runtime dependency.

The project is useful for:

- developers exploring data-driven RPG engines
- creators who want a local-first RPG editor
- contributors interested in AI-assisted authoring workflows
- maintainers experimenting with Codex-assisted development loops

## Current Status

RPGCreatorAI is in active alpha development.

Implemented foundations include:

- React 19 + Vite editor UI
- Tauri 2 desktop shell integration
- native C++20 runtime built with CMake
- data-driven maps, events, switches, variables, common events, shops, battles, and save state
- shared JSON project format between editor and runtime
- generated runtime/editor visual assets
- C++ runtime tests, Vitest editor tests, and validation scripts

AI is not required to run the editor or runtime today. The AI layer is planned as an authoring assistant above the deterministic project format.

## Screenshots

| Editor map view | Runtime view |
| --- | --- |
| ![Editor map view](docs/screenshots/game-visual-design/01-editor-16x9-map.png) | ![Runtime map view](docs/screenshots/game-visual-design/02-runtime-16x9-map.png) |

| Scene template | Playtest preview |
| --- | --- |
| ![Town scene template](docs/screenshots/game-visual-design/06-scene-template-town.png) | ![Playtest preview](docs/screenshots/phase-9-animation-hotfix/editor-preview-playtest.png) |

## Repository Layout

```text
src/                 React editor, adapters, stores, validation, and C++ runtime source
src-tauri/           Tauri desktop shell
data/                sample RPG project JSON consumed by editor and runtime
assets/generated/    generated visual assets for editor and runtime
tests/               C++ runtime tests
docs/                architecture, data format, validation logs, screenshots, roadmap
scripts/dev/         Windows build, verify, smoke, and asset scripts
.kiro/specs/         implementation specs used during agent-driven development
```

## Requirements

Frontend/editor:

- Node.js 22 recommended
- npm 10+

Runtime on Windows:

- Visual Studio 2022 Build Tools or Visual Studio with the C++ workload
- CMake
- Ninja

Desktop shell:

- Rust stable toolchain
- Tauri 2 dependencies

See [Windows Build Notes](docs/WINDOWS_BUILD_NOTES.md) for the current tested runtime setup.

## Quick Start

```bash
npm install
npm run dev
```

Open the printed Vite URL in your browser.

## Verify The Project

Frontend and editor checks:

```bash
npm run typecheck
npm test
npm run build
```

Windows runtime build and C++ tests:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke
```

Full Windows runtime smoke check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1
```

Desktop content check:

```bash
npm run desktop:verify-content
```

## Data Model

Projects are plain JSON under `data/`. The editor reads and writes the same format the C++ runtime consumes.

Start with:

- [Data Format](docs/DATA_FORMAT.md)
- [Event System](docs/EVENT_SYSTEM.md)
- [Editor Data Flow](docs/EDITOR_DATA_FLOW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Open Source Maintenance](docs/OPEN_SOURCE_MAINTENANCE.md)

## Roadmap

Current direction is tracked in [GOAL_STACK.md](docs/GOAL_STACK.md) and [ROADMAP.md](docs/ROADMAP.md).

Near-term focus:

- finish the professional RPG Maker MZ-style editor adaptation
- harden database editing and project validation
- keep editor/runtime parity tight
- improve release packaging and onboarding
- introduce AI-assisted authoring only after the deterministic editor/runtime path is stable

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Good first contribution areas:

- documentation improvements
- validation rules for project JSON
- small editor UX fixes
- C++ runtime test coverage
- screenshot and visual QA improvements

## Security

Please do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

RPGCreatorAI is released under the MIT License. See [LICENSE](LICENSE).
