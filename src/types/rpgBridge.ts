// Typed renderer-side declaration of the desktop shell IPC surface.
// The Tauri Rust core provides matching #[tauri::command] handlers.
// In browser/Vite mode `window.rpgBridge` is undefined.

import type {
  FullProjectState,
  AudioImportMetadata,
  AudioImportResult,
  ImageImportResult,
  SpritesheetImportMetadata,
  SpritesheetImportResult,
  TilesetImportMetadata,
  TilesetImportResult,
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
  CredentialStatus,
  CredentialWriteResult,
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
    importImageAsset(root: string, existingAssetIds: string[]): Promise<ImageImportResult>;
    importSpritesheetAsset(
      root: string,
      existingAssetIds: string[],
      metadata: SpritesheetImportMetadata,
    ): Promise<SpritesheetImportResult>;
    importAudioAsset(
      root: string,
      existingAssetIds: string[],
      metadata: AudioImportMetadata,
    ): Promise<AudioImportResult>;
    importTilesetAsset(
      root: string,
      existingAssetIds: string[],
      metadata: TilesetImportMetadata,
    ): Promise<TilesetImportResult>;
    listBackups(root: string, file: string): Promise<string[]>;
    closeProject(): Promise<void>;
    createPlaytestSession(
      sourceRoot: string,
      state: FullProjectState,
      request: PlaytestSessionRequest,
    ): Promise<PlaytestSessionResult>;
  };
  runtime: {
    availability?(executableSearchRoot?: string | null): Promise<RuntimeAvailabilityInfo>;
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
  credentials?: {
    getStatus(providerId: string): Promise<CredentialStatus>;
    list(): Promise<CredentialStatus[]>;
    set(providerId: string, secret: string): Promise<CredentialWriteResult>;
    delete(providerId: string): Promise<CredentialStatus>;
  };
}

declare global {
  interface Window {
    rpgBridge?: RpgBridge;
  }
}
