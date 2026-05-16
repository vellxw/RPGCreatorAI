# Phase 4 Tasks — Editor Persistence & Runtime Bridge

## T1: Adapter Interfaces & Types
- [ ] Create `src/adapters/types.ts` with ProjectDataAdapter, RuntimeLaunchAdapter, AdapterCapabilities, SaveResult interfaces
- [ ] Define all method signatures and return types
- [ ] Export types for use across the app

## T2: BrowserMemoryAdapter
- [ ] Implement `BrowserMemoryAdapter` that holds project state in memory
- [ ] `loadProject()` seeds from static JSON imports (current behavior)
- [ ] `saveProject/saveMap/saveItems` update in-memory state
- [ ] `exportAll()` serializes full project as downloadable JSON blob
- [ ] `importAll()` parses uploaded JSON and returns ProjectState

## T3: JsonImportExportAdapter Utilities
- [ ] Implement download helper (create Blob, trigger download)
- [ ] Implement upload helper (file input, parse JSON, validate structure)
- [ ] Implement drag-and-drop import support
- [ ] Validate imported data against schema before accepting

## T4: FileSystemAdapter (Seam Only)
- [ ] Create `FileSystemAdapter` class with full interface
- [ ] All methods throw "Not available in browser environment" or return appropriate errors
- [ ] Document where Electron/Tauri/Node integration would plug in
- [ ] Implement backup logic (create `.backups/` dir, copy file with timestamp)

## T5: Adapter Factory
- [ ] Create `adapterFactory.ts` that detects environment
- [ ] Returns BrowserMemoryAdapter for web/Vite dev
- [ ] Returns FileSystemAdapter if desktop APIs detected (future)
- [ ] Expose `useAdapter()` hook or context for components

## T6: Project Store Refactor
- [ ] Refactor `projectStore.ts` to use useReducer with full action set
- [ ] Add actions: UPDATE_EVENT, ADD_COMMAND, REMOVE_COMMAND, UPDATE_COMMAND, REORDER_COMMANDS, UPDATE_PROJECT_META
- [ ] Add dirty tracking (set true on any mutation, false on MARK_SAVED)
- [ ] Add lastSaved timestamp
- [ ] Integrate adapter: load on init, save on SAVE action
- [ ] Add VALIDATE action that runs full validation and stores results

## T7: Wire Inspector to Real Mutations
- [ ] Inspector field changes dispatch UPDATE_EVENT with actual changes
- [ ] Position X/Y changes update event.x / event.y in store
- [ ] Trigger/Solid/Type changes update corresponding fields
- [ ] Name changes update event.id (with uniqueness check)
- [ ] Changes mark store as dirty

## T8: Wire Command Editor to Real Mutations
- [ ] Add Command button dispatches ADD_COMMAND with a default command
- [ ] Command card edits dispatch UPDATE_COMMAND
- [ ] Delete command dispatches REMOVE_COMMAND
- [ ] Command parameter changes (text, flag, mapId, etc.) persist to store

## T9: Extended Validation
- [ ] Create `validateProject.ts` — validates cross-map references, start map exists, start position valid
- [ ] Create `validateCommands.ts` — validates addItem references items DB, transferMap references valid map
- [ ] Extend `validateMap.ts` — check unique event IDs within map
- [ ] Wire validation to run before save (block on errors)
- [ ] Wire validation to run on-demand (Validate button)
- [ ] Show live validation in bottom panel as user edits

## T10: Save Flow
- [ ] Save button calls adapter.saveProject + saveMap for dirty maps + saveItems if changed
- [ ] Validate before save; show errors if invalid
- [ ] On success: dispatch MARK_SAVED, update toolbar indicator
- [ ] On failure: show error in output panel
- [ ] BrowserMemoryAdapter: offer "Export as JSON" after save

## T11: Dirty State & UX
- [ ] Toolbar shows "Unsaved changes" (orange) vs "All changes saved" (green)
- [ ] Save button visually indicates when there are unsaved changes
- [ ] `beforeunload` event warns if dirty state exists
- [ ] Navigating between screens preserves dirty state

## T12: Runtime Bridge
- [ ] Create `RuntimeLaunchAdapter` interface in `src/adapters/types.ts`
- [ ] Implement `BrowserRuntimeAdapter` (canLaunch=false, status=unavailable)
- [ ] Implement `DesktopRuntimeAdapter` placeholder (documents where native launch would go)
- [ ] Playtest screen: "Open in Runtime" button uses adapter
- [ ] If unavailable: show clear message "Native runtime not available in browser mode"
- [ ] SVG preview labeled "Editor Preview (simulated)" — not "Runtime"

## T13: Backup System
- [ ] Add `.backups/` to `.gitignore`
- [ ] FileSystemAdapter creates backup before overwrite (timestamped copy)
- [ ] BrowserMemoryAdapter skips backups (ephemeral)
- [ ] Document backup behavior in `docs/EDITOR_PERSISTENCE.md`

## T14: Safety & Gitignore
- [ ] Verify `.backups/` in `.gitignore`
- [ ] Verify no API keys in committed files
- [ ] Verify adapter never writes malformed JSON (JSON.stringify + validate before write)
- [ ] Verify error boundaries catch adapter failures gracefully

## T15: Validation & Build
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vite build` passes
- [ ] Runtime build still passes (no C++ changes expected)
- [ ] Manual test: edit event in inspector → save → export JSON → verify changes present
- [ ] Update docs: PHASE_4_SCOPE, EDITOR_PERSISTENCE, RUNTIME_BRIDGE, VALIDATION_LOG
- [ ] Commit and push
