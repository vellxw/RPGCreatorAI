// Typed renderer-side declaration of the desktop shell IPC surface.
// The Tauri Rust core provides matching #[tauri::command] handlers.
// In browser/Vite mode `window.rpgBridge` is undefined.

import type { FullProjectState, SaveResult, RuntimeStatus, RuntimeLaunchResult } from '../adapters/types';

export interface OpenDialogResult {
  root: string | null;
  cancelled: boolean;
  state: FullProjectState | null;
}

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
    readProject(root: string): Promise<FullProjectState>;
    writeProject(root: string, state: FullProjectState): Promise<SaveResult>;
    listBackups(root: string, file: string): Promise<string[]>;
    closeProject(): Promise<void>;
  };
  runtime: {
    launch(projectRoot: string): Promise<RuntimeLaunchResult>;
    kill(): Promise<void>;
    status(): Promise<RuntimeStatus>;
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
