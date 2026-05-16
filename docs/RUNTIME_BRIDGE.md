# Runtime Bridge

## Overview
The Runtime Bridge connects the editor UI to the C++ runtime executable. It provides a clean interface for launching the native runtime from the editor, checking its availability, and communicating status.

## Architecture

```
┌──────────────────────┐
│   Playtest Screen    │
│   "Open in Runtime"  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ RuntimeLaunchAdapter │  (interface)
│  - canLaunch()       │
│  - launch(path)      │
│  - getStatus()       │
│  - getExecutablePath │
└──────┬───────┬───────┘
       │       │
       ▼       ▼
┌──────────┐ ┌────────────────┐
│ Browser  │ │ Desktop        │
│ Adapter  │ │ Adapter        │
│          │ │                │
│ canLaunch│ │ canLaunch=true │
│ = false  │ │ spawns process │
└──────────┘ └────────────────┘
```

## Interface

```typescript
interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(projectPath: string): Promise<{ success: boolean; error?: string; pid?: number }>;
  getStatus(): 'unavailable' | 'ready' | 'running';
  kill(): Promise<void>;
}
```

## BrowserRuntimeAdapter
Used when running in a pure browser/Vite environment:
- `canLaunch()` → `false`
- `getExecutablePath()` → `null`
- `launch()` → `{ success: false, error: 'Native runtime not available in browser mode' }`
- `getStatus()` → `'unavailable'`

The Playtest screen shows a clear message explaining the limitation and suggests:
1. Build the runtime with `build_bootstrap.bat` or CMake
2. Run `build/rpg_creator_runtime` manually
3. Use the Editor Preview (simulated) for basic testing

## DesktopRuntimeAdapter
Used when running in Electron/Tauri or a Node-backed environment:
- `canLaunch()` → `true` (if executable exists at expected path)
- `getExecutablePath()` → `'build/rpg_creator_runtime'` (or platform-specific path)
- `launch(projectPath)` → spawns child process, returns PID
- `getStatus()` → checks if process is alive
- `kill()` → terminates the runtime process

**Status in Phase 4**: Seam only. The class exists with the full interface but the actual process spawning requires a desktop shell (Electron/Tauri) which is not yet integrated.

## Playtest Screen Integration

### "Open in Runtime" Button
- Calls `adapter.canLaunch()`
- If true: calls `adapter.launch(projectPath)`, shows "Runtime launched" in logs
- If false: shows modal/toast explaining the limitation

### SVG Preview Labeling
The existing SVG-based game preview in the Playtest screen is explicitly labeled:
- Header: "Editor Preview (simulated)"
- Tooltip: "This is a simplified preview. Use 'Open in Runtime' for the full native experience."
- The preview does NOT claim to be the native runtime

### Status Indicator
- Toolbar shows runtime status: "Runtime: unavailable" / "Runtime: ready" / "Runtime: running"
- When running: Stop button kills the process via adapter

## Future Integration Points
When Electron or Tauri is added:
1. Implement `DesktopRuntimeAdapter.launch()` using `child_process.spawn` or Tauri command
2. Add IPC for runtime ↔ editor communication (state sync, breakpoints)
3. Embed runtime window inside editor (optional)
4. Hot-reload project data in running runtime

## Limitations (Phase 4)
- No actual process spawning in browser
- No IPC between editor and runtime
- No embedded runtime view
- No hot-reload
- These are documented honestly in the UI


---

## Phase 4 Implementation Status (May 2026)

### Implemented
- `RuntimeLaunchAdapter` interface in `src/adapters/types.ts`
- `BrowserRuntimeAdapter` returns `unavailable`, `null` executable path, and a real error from `launch()`. It does not fabricate success.
- `DesktopRuntimeAdapter` is a documented seam that feature-detects `window.runtimeBridge`. When that bridge is absent (default browser/Vite environment), `canLaunch()` is `false` and `launch()` returns an explanatory error rather than pretending to spawn a process.
- `adapterFactory.getRuntimeLaunchAdapter()` selects the adapter at runtime.

### UI Integration
- The Playtest screen displays a `RuntimeBridgePanel` that shows:
  - Current status (`unavailable` / `ready` / `running`)
  - The unavailable reason when applicable
  - An "Open in Runtime" button that is disabled in browser mode
- The simulated game preview now displays a yellow banner: **"Editor Preview (simulated) — not the native runtime"**.

### Limitations Documented Honestly
Browser mode cannot spawn processes — full stop. To launch the C++ runtime today the user runs `build/rpg_creator_runtime` themselves after building with `build_bootstrap.bat`. A future Electron/Tauri shell can implement `window.runtimeBridge.launch()` and the editor will pick it up automatically through the existing factory.
