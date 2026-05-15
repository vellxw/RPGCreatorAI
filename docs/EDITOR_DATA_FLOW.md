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

## Edit Flow (MVP)
```
User edits field in Inspector
  → local component state updates
  → dispatch MARK_DIRTY to editor store
  → "unsaved changes" indicator shown
  → Save button → MARK_SAVED (state only for MVP)
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
validateMap(map, allMapIds)
  → checks layer dimensions
  → validates each event:
    → has id
    → position within bounds
    → valid trigger type
    → known command types
    → transfer targets exist
  → returns ValidationMessage[]
  → displayed in BottomPanel / ValidationPanel
```

## Persistence (Future)
Current MVP: data is read-only from static imports.
Future: ProjectDataAdapter with:
- FileSystemAdapter (Electron/Tauri)
- BrowserMemoryAdapter (dev/demo)
- JsonExportAdapter (download as file)
