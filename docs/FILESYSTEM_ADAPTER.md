# FileSystemAdapter

## Status After Phase 5
The `FileSystemAdapter` becomes a real implementation backed by Tauri commands. The Phase 4 seam (which delegated to `BrowserMemoryAdapter` and returned `not available` errors on writes) is replaced by IPC calls into the desktop shell.

## Surface

```ts
interface ProjectDataAdapter {
  getCapabilities(): AdapterCapabilities;
  loadProject(): Promise<FullProjectState>;
  saveProject(data: ProjectData): Promise<SaveResult>;
  saveMap(mapId: string, data: MapData): Promise<SaveResult>;
  saveItems(data: ItemDatabase): Promise<SaveResult>;
  saveAll(state: FullProjectState): Promise<SaveResult>;
  exportAll(state: FullProjectState): Promise<Blob>;
  importAll(input: string | Blob): Promise<FullProjectState>;
}
```

In desktop mode `getCapabilities()` reports:
```json
{
  "canReadFiles": true,
  "canWriteFiles": true,
  "canCreateBackups": true,
  "adapterName": "FileSystemAdapter (Tauri)"
}
```

In browser mode the existing `BrowserMemoryAdapter` is used; capabilities remain `false`/`false`/`false`.

## Read Flow

1. User picks a folder via `fs.openProjectDialog()` (native picker).
2. Renderer calls `adapter.loadProject()`, which delegates to `window.rpgBridge.fs.readProject(root)`.
3. The shell:
   - Canonicalises `root` (rejects non-USERPROFILE paths, follows symlinks).
   - Verifies `<root>/data/project.json` exists.
   - Reads and parses each file mentioned in `project.maps[]`.
   - Returns `FullProjectState`.
4. Renderer dispatches `LOAD_PROJECT` to the project store. `dirty=false`.
5. Validation runs once on load and surfaces in the bottom panel.

## Write Flow

1. User clicks Save. `performSave()` runs `validateProject()` first (renderer-side, same gate that Phase 4 introduced).
2. On `errors.length > 0` save is blocked. The user sees the error list in the bottom panel.
3. On clean validation, `adapter.saveAll(state)` is called.
4. The shell:
   - For each tracked file (project.json, every map, items.json):
     1. If the file already exists, copy it to `<root>/.backups/<basename>.<ISO-timestamp>.json`.
     2. Serialise the new contents with `serde_json::to_string_pretty`.
     3. Write to `<file>.tmp` in the same directory.
     4. `std::fs::rename(<file>.tmp, <file>)` — atomic on the same filesystem.
   - After all writes succeed, prune `.backups/` to the last N per file (default 10).
   - Auto-add `.backups/` to the project's `.gitignore` if it isn't already listed.
5. `SaveResult { success: true }` is returned to the renderer.
6. Renderer dispatches `MARK_SAVED`.

If any single write fails partway through, the writes that already succeeded remain on disk. The user is told which file failed. The atomic-rename pattern ensures no half-written JSON is ever left behind for the file that failed; the previous version is still on disk.

## Path Sandbox

Every `fs.*` command goes through two guards in the shell:

1. `canonicalize_inside_user_space(input)`:
   - `std::fs::canonicalize` resolves symlinks.
   - The result must start with `%USERPROFILE%` (Windows) or `$HOME` (macOS/Linux).
   - Rejects with `Err("path outside user space")` otherwise.
2. `ensure_inside(root, path)`:
   - For per-file operations, the resolved file path must be a descendant of the canonicalised project root.
   - Rejects with `Err("path escapes project root")` otherwise.

Symlink-escape attempts (`<root>/data/maps/escape.json` -> `C:\Windows\System32\config\SAM`) are rejected because canonicalisation runs first.

## Backups

Layout under the project root:

```
<projectRoot>/
  data/
    project.json
    maps/town.json
    maps/house.json
    database/items.json
  .backups/
    project.2026-05-16T03-12-44Z.json
    project.2026-05-16T03-15-02Z.json
    town.2026-05-16T03-15-02Z.json
    items.2026-05-16T03-15-02Z.json
  .gitignore   (auto-amended to include .backups/)
```

- Filename pattern: `<basename-without-ext>.<ISO-timestamp>.json`
- Timestamp uses UTC, `:` replaced with `-` to be Windows-safe.
- Pruning keeps the last 10 entries per `<basename>` by mtime.
- Backup write failures are non-fatal: the save proceeds, and a warning is appended to `SaveResult.warnings`.

## Errors Surfaced to the Renderer

| Source | Editor Display |
|--------|----------------|
| Path outside user space | "Save failed: selected folder is outside your user directory." |
| Path escapes project root | "Save failed: file path escapes the project root." |
| Permission denied | "Save failed: permission denied (try closing the runtime or files first)." |
| Disk full | "Save failed: disk full." |
| File locked by another process | "Save failed: file in use by another program." |
| JSON serialisation error | Should never happen; treated as an internal bug and reported as such. |

All of these come back through the existing `SaveResult { success: false, error }` channel and are rendered in the toolbar status toast plus the bottom panel.

## Browser Fallback

When `window.rpgBridge` is absent the factory returns `BrowserMemoryAdapter` instead. Behaviour matches Phase 4.1: in-memory edits, JSON Import/Export only, no real filesystem access. The Phase 5 paths above never execute in browser mode.
