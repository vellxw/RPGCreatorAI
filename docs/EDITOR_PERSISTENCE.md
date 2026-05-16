# Editor Persistence

## Overview
The RPGCreatorAI editor uses a ProjectDataAdapter abstraction to read and write project data. This decouples the UI from the storage mechanism, allowing the same editor to work in browser (dev/demo), desktop (Electron/Tauri), or export-only modes.

## Adapter Hierarchy

### ProjectDataAdapter (interface)
All adapters implement this interface:
- `getCapabilities()` — what the adapter can do
- `loadProject()` — load full project state
- `saveProject(data)` — persist project metadata
- `saveMap(mapId, data)` — persist a single map
- `saveItems(data)` — persist item database
- `exportAll()` — export full project as downloadable blob
- `importAll(blob)` — import project from uploaded file

### BrowserMemoryAdapter
- **Environment**: Vite dev server, any browser
- **Storage**: JavaScript memory (seeded from static imports)
- **Save**: Updates in-memory model, offers JSON export/download
- **Backup**: Not applicable (ephemeral)
- **Use case**: Development, demos, quick editing without native tools

### FileSystemAdapter
- **Environment**: Electron, Tauri, or Node-backed server
- **Storage**: Actual files on disk (`data/project.json`, `data/maps/*.json`, etc.)
- **Save**: Writes JSON files directly
- **Backup**: Creates timestamped copy in `.backups/` before overwrite
- **Use case**: Full desktop editing workflow
- **Status**: Seam only in Phase 4 (implementation requires desktop shell)

### JsonImportExportAdapter (utilities)
- **Download**: Serializes project state → triggers browser download
- **Upload**: File input or drag-and-drop → parse → validate → load
- **Format**: Single JSON file or ZIP bundle with directory structure
- **Validation**: Schema check before accepting import

## Data Flow

```
User edits field
  → dispatch action to projectStore
  → store reducer updates state, sets dirty=true
  → UI reflects change immediately

User clicks Save
  → run validation(state)
  → if errors: block, show in panel
  → if valid: adapter.save*(data)
  → on success: dirty=false, show "saved"
  → on failure: show error, keep dirty=true
```

## Dirty Tracking
- Every mutation action sets `dirty = true`
- Save success sets `dirty = false`
- Toolbar indicator: green "All changes saved" / orange "Unsaved changes"
- `beforeunload` warns if dirty

## Backup Strategy (FileSystemAdapter)
- Before overwriting any file, copy it to `.backups/<filename>.<timestamp>.json`
- Keep last 10 backups per file (prune older)
- `.backups/` is gitignored
- BrowserMemoryAdapter does not create backups

## Validation Before Save
Save is blocked if any of these fail:
- Map layer tile count ≠ width × height
- Duplicate event IDs within a map
- Event position out of bounds
- Unknown trigger type
- Unknown command type
- transferMap references non-existent map
- addItem references non-existent item

Warnings (non-blocking):
- NPC without sprite
- Multiple events at same position
- Unused flags

## Security
- Never write malformed JSON (validate serialization)
- Never include API keys in project data
- Adapter errors are caught and surfaced, never silently swallowed
- Import validates structure before accepting


---

## Phase 4 Implementation Status (May 2026)

### Implemented
- `src/adapters/types.ts` — full `ProjectDataAdapter` and `RuntimeLaunchAdapter` interfaces
- `src/adapters/BrowserMemoryAdapter.ts` — in-memory adapter with full save/saveAll/export/import roundtrip
- `src/adapters/JsonImportExportAdapter.ts` — `exportToFile()`, `importFromFile()`, `importFromText()`
- `src/adapters/FileSystemAdapter.ts` — desktop seam (delegates load to memory; save methods return explicit "not available" errors)
- `src/adapters/adapterFactory.ts` — feature-detects `window.runtimeBridge` to choose adapter
- `src/adapters/jsonUtils.ts` — `safeStringify()` round-trips through `JSON.parse` to guarantee never writing malformed JSON

### Persistence Wiring
- `projectStore.ts` is now a `useReducer`-backed store with actions: `LOAD_PROJECT`, `UPDATE_PROJECT_META`, `UPDATE_EVENT`, `RENAME_EVENT`, `UPDATE_COMMAND`, `ADD_COMMAND`, `REMOVE_COMMAND`, `MARK_SAVED`, `VALIDATE`
- Every mutation sets `dirty = true`. `MARK_SAVED` clears it
- The Inspector and the Event Editor both dispatch real mutation actions; field edits update the underlying data model immediately
- Save flow: `performSave()` validates first, blocks on errors, then calls `adapter.saveAll()` and dispatches `MARK_SAVED`
- Toolbar `SaveIndicator` shows green/amber/red based on dirty + validation state
- Browser `beforeunload` warns on unsaved changes
- New "Import" button accepts a JSON file and rehydrates the project state

### Runtime Bridge
- `BrowserRuntimeAdapter`: returns `unavailable` and a real error from `launch()` — never fakes success
- `DesktopRuntimeAdapter`: feature-detects `window.runtimeBridge`; the seam exists for an Electron/Tauri shell to plug into
- The Playtest screen now renders a labeled "Editor Preview (simulated) — not the native runtime" banner and a `RuntimeBridgePanel` that shows status, the unavailable reason, and disables "Open in Runtime" when not applicable

### What Remains a Seam
- Real filesystem writes (would require Electron/Tauri/Node host)
- Backup directory creation (FileSystemAdapter is the documented integration point)
- Process spawning for runtime launch
- Hot-reload of project data into a running runtime
