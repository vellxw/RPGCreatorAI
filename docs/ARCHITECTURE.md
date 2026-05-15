# Architecture

The RPG Creator Runtime is a data-driven engine. It separates logic, rendering, and data.

## Core Principles
- **Engine interprets data.** The engine itself has no hardcoded games.
- **Projects contain data.** Everything from maps to events is defined in JSON.
- **Renderer is abstracted.** `IRenderer` interface separates the logic from the rendering API.
- **EventSystem controls flow.** Commands are executed sequentially by `EventRunner`.
- **State lives in GameState.** All mutable data resides here, making saves trivial.

## What is Engine vs Project
**Engine:**
- File parsing (JSON)
- Collision detection
- Event running (showText, transferMap, etc.)
- Render loop
- Input handling

**Project:**
- `project.json` (Entry point)
- Maps (`town.json`, `house.json`)
- Entities and their events
- Items Database

## Future Extensions
- **HD-2D:** Because rendering is abstracted via `IRenderer`, a new `HD2DRenderer` can be implemented using Vulkan/OpenGL without touching `EventRunner` or `GameState`.
- **Editor:** The data-driven nature means an editor can just generate the JSON files and spawn the runtime process.
