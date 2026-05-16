# Phase 4 Scope — Editor Persistence & Runtime Bridge

## Goal
Make the editor stop being mostly visual/state-only and start editing real project files used by the C++ runtime.

## In Scope

### Persistence
- ProjectDataAdapter interface with multiple implementations
- BrowserMemoryAdapter (in-memory + JSON export/import)
- FileSystemAdapter seam (placeholder for Electron/Tauri/Node)
- JsonImportExportAdapter (download/upload via browser file APIs)
- Real mutations: editing events, commands, positions updates the data model
- Save writes through the adapter
- Export downloads the full project as JSON

### Validation
- Validation runs before save and blocks on errors
- Extended checks: unique event IDs, item references, cross-map transfers
- Live validation feedback in bottom panel

### Runtime Bridge
- RuntimeLaunchAdapter interface
- BrowserRuntimeAdapter (unavailable in browser, clearly labeled)
- DesktopRuntimeAdapter seam (for future native integration)
- Playtest SVG preview labeled as "Editor Preview (simulated)"

### Safety
- Backup before overwrite (FileSystemAdapter)
- Never write malformed JSON
- Dirty state tracking with unsaved changes warning
- `.backups/` gitignored

## Out of Scope
- New screens or UI redesign
- Real AI provider API calls
- C++ runtime modifications
- Electron/Tauri integration (only the adapter seam)
- Undo/redo (future phase)
- Real tile painting
- Asset management
- GitHub integration

## Success Criteria
1. User can edit event properties in inspector → changes persist in data model
2. User can add/remove commands → changes persist
3. Save button validates and writes through adapter
4. Export downloads valid JSON matching runtime schema
5. Import loads external JSON into editor
6. Dirty indicator works correctly
7. Validation blocks save on errors
8. Runtime bridge clearly communicates availability
9. TypeScript passes, build passes
10. No secrets or artifacts committed
