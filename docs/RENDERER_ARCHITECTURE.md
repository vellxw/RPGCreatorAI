# Renderer Architecture

The rendering system is completely abstracted from the game logic.

## Interface: IRenderer
All renderers must implement `IRenderer`. This ensures that changing the underlying graphics API (SDL, OpenGL, Vulkan) does not affect game logic.

## Phase 1: SDL2DRenderer
In Phase 1, we use a simple 2D renderer based on SDL Renderer.
- Renders colored rectangles for tiles, entities, and UI.
- Follows the camera (which tracks the player).

## Separating Logic and Rendering
- Entities do not draw themselves. They expose properties (position, sprite/color).
- `RenderContext` and `IRenderer::renderEntities` handle the drawing.
- Dialogues provide state to the renderer; the renderer draws the UI.

This separation is crucial for swapping out the renderer later.
