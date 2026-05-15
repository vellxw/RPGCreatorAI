# Phase 3 Scope — Visual Editor MVP

## Goal
Build a functional desktop/editor interface for RPGCreatorAI with 4 screens:
1. Main Editor Dashboard
2. Event Editor / Event Inspector
3. AI Tools / Provider Connections
4. Playtest / Preview Mode

## What Is Implemented
- Full React/Vite/Tailwind editor UI
- Design system with tokens, components, consistent styling
- Real data integration (reads project.json, maps/*.json, items.json)
- Navigation between all 4 screens
- Map canvas with grid, event markers, selection
- Inspector panel with editable fields
- Tile palette with categories
- Event editor with command stack cards
- AI Tools with provider cards, routing, safety settings
- Playtest with controls, game preview, state inspector, logs
- Validation engine with real checks
- Bottom panel with validation results and AI suggestions

## What Is Mock/Placeholder
- Tile palette uses colored squares (no real tile images)
- Map canvas uses simplified rendering (no real tileset)
- AI provider connections are mock (no real API calls)
- Playtest game preview is SVG-based (not embedded native runtime)
- Save persists to editor state only (no filesystem write yet)

## What Is NOT In Scope
- Real AI API calls
- Real image/3D generation
- GitHub OAuth
- Cloud sync
- Plugin system
- Native packaging
- Full export pipeline
