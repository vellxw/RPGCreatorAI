// Wires window.rpgBridge to Tauri's invoke() when running inside the
// desktop shell. Browser/Vite mode never imports this module.

import { invoke } from '@tauri-apps/api/core';
import type { RpgBridge } from '../types/rpgBridge';
import type {
  FullProjectState,
  PlaytestSessionRequest,
  PlaytestSessionResult,
  SaveResult,
  RuntimeStatus,
  RuntimeAvailabilityInfo,
  RuntimeDiagnosticsInfo,
  RuntimeLaunchResult,
  RuntimeLogActionResult,
  RuntimeLogInfo,
  RuntimeLogTailResult,
  RuntimeSnapshotResult,
  AudioImportMetadata,
  AudioImportResult,
  ImageImportResult,
  SpritesheetImportMetadata,
  SpritesheetImportResult,
  TilesetImportMetadata,
  TilesetImportResult,
  CredentialStatus,
  CredentialWriteResult,
} from './types';

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
      createProjectDialog: (state: FullProjectState) =>
        invoke('fs_create_project_dialog', { projectState: state }),
      readProject: (root: string) => invoke('fs_read_project', { root }) as Promise<FullProjectState>,
      writeProject: (root: string, state: FullProjectState) =>
        invoke('fs_write_project', { root, projectState: state }) as Promise<SaveResult>,
      importImageAsset: (root: string, existingAssetIds: string[]) =>
        invoke('fs_import_image_asset_dialog', { root, existingAssetIds }) as Promise<ImageImportResult>,
      importSpritesheetAsset: (root: string, existingAssetIds: string[], metadata: SpritesheetImportMetadata) =>
        invoke('fs_import_spritesheet_asset_dialog', {
          root,
          existingAssetIds,
          metadata,
        }) as Promise<SpritesheetImportResult>,
      importAudioAsset: (root: string, existingAssetIds: string[], metadata: AudioImportMetadata) =>
        invoke('fs_import_audio_asset_dialog', {
          root,
          existingAssetIds,
          metadata,
        }) as Promise<AudioImportResult>,
      importTilesetAsset: (root: string, existingAssetIds: string[], metadata: TilesetImportMetadata) =>
        invoke('fs_import_tileset_asset_dialog', {
          root,
          existingAssetIds,
          metadata,
        }) as Promise<TilesetImportResult>,
      listBackups: (root: string, file: string) =>
        invoke('fs_list_backups', { root, file }) as Promise<string[]>,
      closeProject: () => invoke('fs_close_project') as Promise<void>,
      createPlaytestSession: (
        sourceRoot: string,
        state: FullProjectState,
        request: PlaytestSessionRequest,
      ) =>
        invoke('fs_create_playtest_session', {
          sourceRoot,
          projectState: state,
          request,
        }) as Promise<PlaytestSessionResult>,
    },
    runtime: {
      availability: (executableSearchRoot?: string | null) =>
        invoke('runtime_availability', {
          executableSearchRoot: executableSearchRoot ?? null,
        }) as Promise<RuntimeAvailabilityInfo>,
      launch: (projectRoot: string, executableSearchRoot?: string) =>
        invoke('runtime_launch', {
          projectRoot,
          executableSearchRoot: executableSearchRoot ?? null,
        }) as Promise<RuntimeLaunchResult>,
      kill: () => invoke('runtime_kill') as Promise<void>,
      status: () => invoke('runtime_status') as Promise<RuntimeStatus>,
      getDiagnostics: () => invoke('runtime_diagnostics') as Promise<RuntimeDiagnosticsInfo>,
      getLatestLog: () => invoke('runtime_latest_log') as Promise<RuntimeLogInfo>,
      readLogTail: (maxBytes: number) =>
        invoke('runtime_read_log_tail', { maxBytes }) as Promise<RuntimeLogTailResult>,
      readLatestSnapshot: (maxBytes: number) =>
        invoke('runtime_read_latest_snapshot', { maxBytes }) as Promise<RuntimeSnapshotResult>,
      openLogFolder: () => invoke('runtime_open_log_folder') as Promise<RuntimeLogActionResult>,
    },
    config: {
      getRecents: () => invoke('config_get_recents') as Promise<string[]>,
      addRecent: (root: string) => invoke('config_add_recent', { root }) as Promise<string[]>,
    },
    credentials: {
      getStatus: (providerId: string) =>
        invoke('credentials_get_status', { providerId }) as Promise<CredentialStatus>,
      list: () => invoke('credentials_list') as Promise<CredentialStatus[]>,
      set: (providerId: string, secret: string) =>
        invoke('credentials_set', { providerId, secret }) as Promise<CredentialWriteResult>,
      delete: (providerId: string) =>
        invoke('credentials_delete', { providerId }) as Promise<CredentialStatus>,
    },
  };

  window.rpgBridge = bridge;
  return true;
}
