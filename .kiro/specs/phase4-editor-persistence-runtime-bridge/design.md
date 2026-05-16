# Phase 4 Design — Editor Persistence & Runtime Bridge

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   React UI Layer                      │
│  (screens, components, inspector, command editor)    │
└──────────────────────┬──────────────────────────────┘
                       │ dispatch actions
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Project Store                        │
│  (single source of truth for project data model)     │
│  - project, maps, items                              │
│  - dirty tracking                                    │
│  - undo history (future)                             │
└──────────────────────┬──────────────────────────────┘
                       │ read/write via adapter
                       ▼
┌─────────────────────────────────────────────────────┐
│              ProjectDataAdapter (interface)           │
│  - loadProject(): ProjectState                       │
│  - saveProject(state): SaveResult                    │
│  - saveMap(mapId, data): SaveResult                  │
│  - saveItems(data): SaveResult                       │
│  - createBackup(filePath): void                      │
│  - getCapabilities(): AdapterCapabilities            │
└──────────┬──────────────┬───────────────┬───────────┘
           │              │               │
           ▼              ▼               ▼
┌──────────────┐ ┌────────────────┐ ┌──────────────────┐
│ BrowserMemory│ │ FileSystem     │ │ JsonImportExport │
│ Adapter      │ │ Adapter        │ │ Adapter          │
│              │ │                │ │                  │
│ - in-memory  │ │ - reads/writes │ │ - download JSON  │
│ - JSON import│ │   actual files │ │ - upload JSON    │
│ - export     │ │ - backups      │ │ - drag & drop    │
│ - dev/demo   │ │ - Electron/    │ │ - clipboard      │
│              │ │   Tauri/Node   │ │                  │
└──────────────┘ └────────────────┘ └──────────────────┘
```

## ProjectDataAdapter Interface

```typescript
interface AdapterCapabilities {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canLaunchRuntime: boolean;
  canCreateBackups: boolean;
  adapterName: string;
}

interface SaveResult {
  success: boolean;
  error?: string;
  backupPath?: string;
}

interface ProjectDataAdapter {
  getCapabilities(): AdapterCapabilities;
  loadProject(): Promise<ProjectState>;
  saveProject(data: ProjectData): Promise<SaveResult>;
  saveMap(mapId: string, data: MapData): Promise<SaveResult>;
  saveItems(data: ItemDatabase): Promise<SaveResult>;
  exportAll(): Promise<Blob>;  // full project as downloadable JSON bundle
  importAll(blob: Blob): Promise<ProjectState>;
}
```

## Store Redesign

The current `projectStore.ts` uses static imports and a context. Phase 4 refactors it to:

```typescript
interface ProjectStoreState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  dirty: boolean;
  lastSaved: string | null;
  validationErrors: ValidationMessage[];
}

type ProjectAction =
  | { type: 'LOAD_PROJECT'; payload: ProjectState }
  | { type: 'UPDATE_EVENT'; mapId: string; eventId: string; changes: Partial<GameEvent> }
  | { type: 'ADD_COMMAND'; mapId: string; eventId: string; command: EventCommand }
  | { type: 'REMOVE_COMMAND'; mapId: string; eventId: string; index: number }
  | { type: 'UPDATE_COMMAND'; mapId: string; eventId: string; index: number; command: EventCommand }
  | { type: 'REORDER_COMMANDS'; mapId: string; eventId: string; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_PROJECT_META'; changes: Partial<ProjectData> }
  | { type: 'MARK_SAVED' }
  | { type: 'VALIDATE' };
```

Every mutation action sets `dirty = true`. Save resets it.

## Validation Integration

Validation runs:
1. On demand (Validate button)
2. Before save (blocks if errors)
3. On event edit (live feedback in bottom panel)

The existing `validateMap.ts` is extended with:
- `validateProject(state: ProjectState): ValidationMessage[]` — cross-map checks
- `validateItemReferences(commands, items): ValidationMessage[]` — addItem checks

## Runtime Bridge

```typescript
interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(projectPath: string): Promise<{ success: boolean; error?: string }>;
  getStatus(): 'unavailable' | 'ready' | 'running';
}

class BrowserRuntimeAdapter implements RuntimeLaunchAdapter {
  canLaunch() { return false; }
  getExecutablePath() { return null; }
  async launch() { return { success: false, error: 'Not available in browser' }; }
  getStatus() { return 'unavailable' as const; }
}

class DesktopRuntimeAdapter implements RuntimeLaunchAdapter {
  canLaunch() { return true; }
  getExecutablePath() { return 'build/rpg_creator_runtime'; }
  async launch(projectPath: string) { /* spawn process */ }
  getStatus() { /* check process */ }
}
```

## File Structure (new/modified)

```
src/
  adapters/
    types.ts                    — adapter interfaces
    BrowserMemoryAdapter.ts     — in-memory + import/export
    FileSystemAdapter.ts        — placeholder for desktop
    JsonImportExportAdapter.ts  — download/upload helpers
    RuntimeLaunchAdapter.ts     — runtime bridge interface + impls
    adapterFactory.ts           — selects adapter based on environment
  stores/
    projectStore.ts             — refactored with reducer, dirty tracking, adapter integration
  validation/
    validateMap.ts              — extended
    validateProject.ts          — new: cross-project validation
    validateCommands.ts         — new: command-specific checks
  components/
    editor/
      Inspector.tsx             — wired to dispatch real mutations
      BottomPanel.tsx           — shows live validation
    events/
      CommandEditor.tsx         — edit command parameters inline
    layout/
      TopToolbar.tsx            — dirty indicator, save wired to adapter
      SaveIndicator.tsx         — new: shows save state
```

## Save Flow

```
User clicks Save
  → validate(currentState)
  → if errors: show in panel, block save
  → if clean:
    → adapter.saveProject(state.project)
    → for each dirty map: adapter.saveMap(mapId, mapData)
    → adapter.saveItems(state.items) if changed
    → dispatch MARK_SAVED
    → show success toast/indicator
```

## Import/Export Flow (BrowserMemoryAdapter)

```
Export:
  → adapter.exportAll()
  → creates Blob with { project.json, maps/*, database/* }
  → triggers browser download as .zip or .json bundle

Import:
  → user selects file or drags
  → adapter.importAll(blob)
  → parses and validates
  → dispatch LOAD_PROJECT
```

## Dirty Tracking

Each mutation action in the reducer sets `dirty = true`. The toolbar shows:
- Green checkmark + "All changes saved" when `dirty === false`
- Orange dot + "Unsaved changes" when `dirty === true`

Browser `beforeunload` event warns if dirty.

## Error Handling

All adapter operations are wrapped in try/catch. Errors surface as:
- Toast notification for transient errors
- Validation panel entry for data errors
- Console log for debug

Never silently swallow errors. Never write partial/corrupt data.
