# Phase 4 Requirements — Editor Persistence & Runtime Bridge

## R1: ProjectDataAdapter Architecture
The editor must use a clean adapter abstraction for all data I/O. The adapter interface defines read/write operations for project data. Multiple implementations exist:
- **BrowserMemoryAdapter**: in-memory store seeded from static imports (current behavior, formalized as an adapter)
- **FileSystemAdapter / DesktopAdapter**: reads/writes actual files on disk (for Electron/Tauri/Node-backed environments)
- **JsonImportExportAdapter**: allows downloading project data as JSON and uploading/importing JSON files via browser file APIs

The active adapter is selected at startup based on environment detection.

## R2: Real Read/Write Persistence
The editor must be able to persist changes to the actual project data model:
- `data/project.json` — project metadata, start position, map references
- `data/maps/*.json` — map layers, events, dimensions
- `data/database/items.json` — item definitions

When the user clicks Save, the adapter writes the current editor state back to the data source. For BrowserMemoryAdapter, this means updating the in-memory model and offering JSON export/download. For FileSystemAdapter, this means writing actual files.

## R3: Editable Fields That Persist
The following editor interactions must update the underlying data model (not just local component state):
- Event name, type, position (x, y), trigger, solid, sprite
- Event command list (add, remove, reorder, edit command parameters)
- Event dialogue text (for showText commands)
- Map event positions (if drag-move is implemented)
- Project title, start map, start position

Changes flow: UI → store → adapter → persistence target.

## R4: Validation Before Save
Before writing data, the editor must run validation and block save if critical errors exist:
- Map layer tile count matches width × height
- Event IDs are unique within a map
- Event positions are within map bounds (0 ≤ x < width, 0 ≤ y < height)
- Event trigger is one of: interact, touch, autorun, parallel
- Event command types are known (showText, setFlag, ifFlag, addItem, transferMap, playSound)
- transferMap commands reference an existing map ID
- addItem commands reference an existing item ID
- No empty event IDs

Warnings (non-blocking): NPC without sprite, events at same position, unused flags.

## R5: Backup Before Overwrite
Before writing project data (FileSystemAdapter only), the adapter must create a timestamped backup of the file being overwritten. Backups stored in a `.backups/` directory (gitignored). BrowserMemoryAdapter does not need backups since it's ephemeral.

## R6: Runtime Bridge
The editor must provide a RuntimeLaunchAdapter interface:
- `canLaunch(): boolean` — returns whether native runtime launch is available
- `launch(projectPath: string): Promise<void>` — attempts to launch the C++ runtime executable
- `getStatus(): 'unavailable' | 'ready' | 'running'`

For the Vite/browser environment, `canLaunch()` returns false and the Playtest screen clearly indicates "Native runtime not available in browser mode. Use Open in Runtime to launch externally."

If a desktop environment is detected (Electron/Tauri), the adapter calls the runtime executable with the project path.

The SVG preview in Playtest must not claim to be the native runtime. It is labeled as "Editor Preview (simulated)".

## R7: Dirty State & Unsaved Changes
The editor must track whether the data model has been modified since last save:
- Dirty indicator in toolbar ("Unsaved changes" vs "All changes saved")
- Warn before navigating away if unsaved changes exist
- Save button enabled/disabled based on dirty state

## R8: Safety Constraints
- Never write malformed JSON (validate serialization before write)
- Never commit API keys, `.env` files, `build/`, `dist/`, `node_modules/`, or `saves/`
- `.backups/` directory added to `.gitignore`
- Adapter errors are caught and surfaced to the user via the validation/output panel

## R9: No Scope Creep
- No new screens
- No UI redesign
- No real AI provider calls
- No runtime rewrite
- No new game features
- No Electron/Tauri integration (just the adapter seam)
