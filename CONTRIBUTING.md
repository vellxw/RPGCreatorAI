# Contributing

Thanks for considering a contribution to RPGCreatorAI.

This project is still in alpha, so the most valuable contributions are focused, small, and easy to verify.

## Development Setup

```bash
npm install
npm run dev
```

Run editor checks before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
```

On Windows, run the C++ runtime validation when touching runtime code, CMake, data files consumed by the runtime, or generated runtime assets:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1 -SkipSmoke
```

## Pull Request Guidelines

- Keep pull requests scoped to one feature, fix, or documentation update.
- Add or update tests for behavior changes.
- Update docs when changing data format, architecture, commands, or setup steps.
- Do not commit `dist/`, `build/`, `node_modules/`, `.env`, local saves, or generated binaries.
- Include screenshots for visible editor/runtime changes when practical.

## Architecture Rules

- Keep the runtime data-driven.
- Do not hardcode sample game content in C++.
- Keep rendering separate from gameplay logic.
- Keep editor state changes deterministic and testable.
- Treat AI features as authoring tools above the project format, not runtime dependencies.

## Reporting Bugs

Please include:

- operating system
- Node/npm versions
- whether you used browser, Vite dev server, or Tauri desktop
- reproduction steps
- expected result
- actual result
- relevant logs or screenshots

## Feature Requests

Feature requests are welcome, but the project favors core editor/runtime stability before broad AI-provider integrations or plugin systems.
