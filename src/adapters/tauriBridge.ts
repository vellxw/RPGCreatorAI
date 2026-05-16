// Wires window.rpgBridge to Tauri's invoke() when running inside the
// desktop shell. Browser/Vite mode never imports this module.

import { invoke } from '@tauri-apps/api/core';
import type { RpgBridge } from '../types/rpgBridge';
import type { FullProjectState, SaveResult, RuntimeStatus, RuntimeLaunchResult } from './types';

function isTauri(): boolean {
  // Tauri 2 sets a marker on window.__TAURI_INTERNALS__.
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function installTauriBridgeIfPresent(): Promise<boolean> {
  if (!isTauri()) return false;

  const bridge: RpgBridge = {
    shell: {
      info: () => invoke('shell_info'),
    },
    fs: {
      openProjectDialog: () => invoke('fs_open_project_dialog'),
      readProject: (root: string) => invoke('fs_read_project', { root }) as Promise<FullProjectState>,
      writeProject: (root: string, state: FullProjectState) =>
        invoke('fs_write_project', { root, projectState: state }) as Promise<SaveResult>,
      listBackups: (root: string, file: string) =>
        invoke('fs_list_backups', { root, file }) as Promise<string[]>,
      closeProject: () => invoke('fs_close_project') as Promise<void>,
    },
    runtime: {
      launch: (projectRoot: string) =>
        invoke('runtime_launch', { projectRoot }) as Promise<RuntimeLaunchResult>,
      kill: () => invoke('runtime_kill') as Promise<void>,
      status: () => invoke('runtime_status') as Promise<RuntimeStatus>,
    },
    config: {
      getRecents: () => invoke('config_get_recents') as Promise<string[]>,
      addRecent: (root: string) => invoke('config_add_recent', { root }) as Promise<string[]>,
    },
  };

  window.rpgBridge = bridge;
  return true;
}
