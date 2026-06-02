// Typed renderer-side declaration of the desktop shell IPC surface.
// The Tauri Rust core provides matching #[tauri::command] handlers.
// In browser/Vite mode `window.rpgBridge` is undefined.

import type {
  FullProjectState,
  PlaytestSessionRequest,
  PlaytestSessionResult,
  SaveResult,
  RuntimeStatus,
  RuntimeDiagnosticsInfo,
  RuntimeLaunchResult,
  RuntimeLogActionResult,
  RuntimeLogInfo,
  RuntimeLogTailResult,
  RuntimeSnapshotResult,
} from '../adapters/types';

export interface OpenDialogResult {
  root: string | null;
  cancelled: boolean;
  state: FullProjectState | null;
}

export type CreateProjectDialogResult = OpenDialogResult;

export interface ShellInfo {
  name: 'tauri' | 'electron';
  version: string;
}

export interface RpgBridge {
  shell: {
    info(): Promise<ShellInfo>;
  };
  fs: {
    openProjectDialog(): Promise<OpenDialogResult>;
    createProjectDialog(state: FullProjectState): Promise<CreateProjectDialogResult>;
    readProject(root: string): Promise<FullProjectState>;
    writeProject(root: string, state: FullProjectState): Promise<SaveResult>;
    listBackups(root: string, file: string): Promise<string[]>;
    closeProject(): Promise<void>;
    createPlaytestSession(
      sourceRoot: string,
      state: FullProjectState,
      request: PlaytestSessionRequest,
    ): Promise<PlaytestSessionResult>;
  };
  runtime: {
    launch(projectRoot: string, executableSearchRoot?: string): Promise<RuntimeLaunchResult>;
    kill(): Promise<void>;
    status(): Promise<RuntimeStatus>;
    getDiagnostics(): Promise<RuntimeDiagnosticsInfo>;
    getLatestLog(): Promise<RuntimeLogInfo>;
    readLogTail(maxBytes: number): Promise<RuntimeLogTailResult>;
    readLatestSnapshot(maxBytes: number): Promise<RuntimeSnapshotResult>;
    openLogFolder(): Promise<RuntimeLogActionResult>;
  };
  config: {
    getRecents(): Promise<string[]>;
    addRecent(root: string): Promise<string[]>;
  };
}

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}
