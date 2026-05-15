# Phase 3 Design — Visual Editor MVP

## Architecture

```
src/
  main.tsx              — React entry point
  App.tsx               — Router shell
  index.css             — Tailwind + design tokens
  components/
    layout/             — AppShell, TopToolbar, Sidebar, BottomPanel
    editor/             — MapCanvas, TilePalette, Inspector
    events/             — EventList, CommandStack, EventProperties
    ai-tools/           — ProviderCard, ProviderRouting, UsageSafety
    playtest/           — PlaytestControls, GamePreview, StateInspector, LogsPanel
    ui/                 — Button, Input, Select, Badge, Card, Tabs (design system)
  screens/
    MainEditorScreen.tsx
    EventEditorScreen.tsx
    AIToolsScreen.tsx
    PlaytestScreen.tsx
  stores/
    projectStore.ts     — Project data (maps, events, items)
    editorStore.ts      — Selection state, active screen, UI state
    validationStore.ts  — Validation results
    providerStore.ts    — AI provider config
    playtestStore.ts    — Playtest runtime state
  adapters/
    ProjectDataAdapter.ts — Load/save project data
  validation/
    validateMap.ts
    validateEvent.ts
  types/
    project.ts          — TypeScript interfaces for data model
```

## State Management
Use React context + useReducer for stores. No external state library needed for MVP.

## Data Flow
1. On app load, ProjectDataAdapter loads project.json, maps, items
2. Data populates projectStore
3. Screens read from stores via hooks
4. User edits update store state
5. Save triggers adapter to export/persist

## Design System
- Tailwind CSS 4 with custom CSS variables for tokens
- Light theme with indigo accent
- Consistent spacing scale (4px base)
- Component library: Button, Input, Select, Badge, Card, Tabs, StatusPill

## Navigation
- Simple state-based routing (no react-router needed for 4 screens)
- Left sidebar nav controls active screen
- Breadcrumb in toolbar reflects current context
