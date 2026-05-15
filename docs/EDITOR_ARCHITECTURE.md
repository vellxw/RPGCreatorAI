# Editor Architecture

## Overview
The RPGCreatorAI editor is a React 19 + Vite + Tailwind CSS 4 single-page application.
It reads the same JSON data model as the C++ runtime.

## Tech Stack
- React 19 (functional components, hooks, context)
- Vite 6 (build tool, dev server)
- Tailwind CSS 4 (utility-first styling)
- TypeScript 5.8 (strict mode)
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
    providerStore.ts    — AI provider configuration
    playtestStore.ts    — Playtest runtime state
  validation/
    validateMap.ts      — Map and event validation logic
  components/
    ui/                 — Design system primitives (Button, Badge, Tabs, Input)
    layout/             — App shell (TopToolbar, Sidebar)
    editor/             — Main editor components (MapCanvas, TilePalette, Inspector, BottomPanel)
  screens/
    MainEditorScreen.tsx
    EventEditorScreen.tsx
    AIToolsScreen.tsx
    PlaytestScreen.tsx
```

## State Management
- ProjectContext: loaded once from JSON imports, provides project/map/item data
- EditorContext: useReducer for UI state (active screen, selection, zoom)
- Local state: provider config, playtest state (useState hooks in screens)

## Data Flow
1. Project data loaded from static JSON imports at app init
2. Stores provide data to screens via React context
3. User interactions dispatch actions to update editor state
4. Selection changes propagate to inspector/properties panels
5. Validation runs against real data model

## Design System
CSS custom properties define tokens (colors, spacing, radius, shadows).
Tailwind utilities compose with token values for consistent styling.
Reusable UI components: Button, Badge, Tabs, Input, Select.

## Navigation
Simple state-based routing via `activeScreen` in EditorContext.
No external router library needed for 4 screens.
