# Editor Architecture

## Overview
The RPGCreatorAI editor is a React 19 + Vite + Tailwind CSS 4 single-page application.
It reads the same JSON data model as the C++ runtime.

## Tech Stack
- React 19 (functional components, hooks, context)
- Vite 6 (build tool, dev server)
- Tailwind CSS 4 (utility-first styling)
- TypeScript 5.9 (strict mode)
- Lucide React (icons)

## Directory Structure
```
src/
  main.tsx              — Entry point
  App.tsx               — Root component with providers and routing
  index.css             — Tailwind imports + design tokens
  types/
    project.ts          — TypeScript interfaces for data model
  stores/
    projectStore.ts     — Project data context (maps, events, items)
    editorStore.ts      — Editor UI state (selection, screen, zoom)
    playtestStore.ts    — Simulated editor-preview playtest state
  adapters/
    adapterFactory.ts   — Browser/Tauri adapter selection
    PlaytestSessionAdapter.ts
    RuntimeLaunchAdapter.ts
  validation/
    validateProject.ts  — Project, database, map, and command validation
    validateMap.ts      — Map and event validation logic
  components/
    ui/                 — Design system primitives (Button, Badge, Tabs, Input)
    layout/             — App shell (TopToolbar, Sidebar)
    editor/             — Main editor components (MapCanvas, TilePalette, Inspector, BottomPanel)
    database/           — Database V2 editor components
    playtest/           — Runtime log, event trace, and runtime state panels
  screens/
    MainEditorScreen.tsx
    EventEditorScreen.tsx
    DatabaseScreen.tsx
    PlaytestScreen.tsx
```

## State Management
- ProjectContext: project, map, item, and Database V2 shards with reducer
  actions for authoring and reference-safe edits.
- EditorContext: UI state for active screen, selected map/event, zoom,
  active authoring layer, brush, tool, and playtest mode.
- Browser adapters: in-memory/demo persistence and honest unavailable
  runtime/playtest session results.
- Desktop adapters: Tauri filesystem bridge, temp playtest session builder,
  native runtime launch, bounded log tail, event trace, and state snapshot
  access.

## Data Flow
1. The editor loads the bundled JSON project or a desktop-selected project.
2. Stores provide project and editor state to screens via React context.
3. User interactions dispatch reducer actions for maps, layers, events,
   command stacks, common events, and database shards.
4. Validation runs against the real project data model before save and before
   native runtime launch.
5. Desktop Save writes through the Tauri filesystem bridge with backups.
6. Desktop Playtest writes a temporary session root and launches the native
   C++ runtime from that temp root.

## Design System
CSS custom properties define tokens (colors, spacing, radius, shadows).
Tailwind utilities compose with token values for consistent styling.
Reusable UI components: Button, Badge, Tabs, Input, Select.

## Navigation
Simple state-based routing via `activeScreen` in EditorContext.
Primary screens are Map Editor, Events, Database, and Playtest. The future AI
workspace is not exposed in primary MVP navigation; if reached directly it is
read-only and does not advertise runnable AI actions.
