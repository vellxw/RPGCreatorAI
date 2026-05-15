# Phase 3 Requirements — Visual Editor MVP

## R1: App Shell & Navigation
The editor must have a top toolbar, left sidebar navigation, and support routing between 4 screens: Main Editor, Event Editor, AI Tools, Playtest.

## R2: Main Editor Dashboard
Display project map with grid, tile palette, inspector panel for selected objects, bottom panel with validation/output/AI suggestions.

## R3: Event Editor
Show event list grouped by map, command stack cards, event properties panel, map preview with event highlight, validation.

## R4: AI Tools / Provider Connections
Provider cards with status, model selectors, API key fields (masked), test connection (mock), provider routing, usage & safety settings.

## R5: Playtest / Preview Mode
Game preview area, playtest controls, runtime state inspector, logs panel, AI debug assist cards.

## R6: Data Integration
Editor reads from the same JSON data model as the C++ runtime (project.json, maps/*.json, database/items.json). Changes update editor state.

## R7: Validation Engine
Real validation checks: event has id, position within bounds, trigger is valid, command types are known, transfer targets exist.

## R8: Persistence
Save button persists data through adapter. JSON export fallback if filesystem not available.

## R9: No Secrets Committed
API keys stored in .env only, never in committed files.

## R10: Build & Type Safety
Project builds without errors. TypeScript strict checking passes.
