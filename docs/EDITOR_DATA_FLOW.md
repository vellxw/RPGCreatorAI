# Editor Data Flow

## Data Sources
The editor reads from the same JSON files as the C++ runtime:
- `data/project.json` — Project metadata, map references, start position
- `data/maps/town.json` — Town map with layers and events
- `data/maps/house.json` — House map with layers and events
- `data/database/items.json` — Item definitions

## Load Flow
```
App init
  → loadProjectData()
    → imports project.json, town.json, house.json, items.json
    → returns ProjectState { project, maps, items }
  → ProjectContext.Provider wraps app
```

## Read Flow
```
Screen component
  → useProject() hook
  → accesses maps, events, items
  → renders UI from real data
```

## Edit Flow
```
User edits field in Inspector
  → local component state updates
  → dispatch projectStore mutation action
  → projectStore updates the authored JSON model
  → "unsaved changes" indicator shown
```

## Selection Flow
```
User clicks event on MapCanvas
  → dispatch SELECT_EVENT { event, mapId }
  → Inspector re-renders with event properties
  → MapCanvas highlights selected event
```

## Validation Flow
```
User clicks Validate
  → validateProject(full project state)
  → dispatch VALIDATE
  → persistent toolbar feedback summarizes pass/warn/error state
  → BottomPanel / Validation lists recovery details

User clicks Save
  → validateProject(full project state)
  → dispatch VALIDATE
  → if errors: no adapter write, dirty stays true, feedback says Save blocked
  → if valid: adapter.saveAll(full project state)
  → on adapter success: dispatch MARK_SAVED with timestamp
  → on adapter failure: dirty stays true, feedback says Save again after fixing write issue
```

## Persistence
`ProjectDataAdapter` keeps the UI independent from storage:
- `FileSystemAdapter` writes desktop project files through Tauri.
- `BrowserMemoryAdapter` saves to in-memory browser state.
- JSON import/export provides project bundle transfer in browser mode.
