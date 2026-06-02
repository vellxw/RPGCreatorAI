// Adapter interfaces for editor persistence and runtime launch
import type {
  AssetCatalogData,
  AssetCatalogEntry,
  DatabaseEntries,
  ItemDatabase,
  MapData,
  ProjectData,
  ValidationMessage,
} from '../types/project';

export interface AdapterCapabilities {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canCreateBackups: boolean;
  adapterName: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  backupPath?: string;
}

export interface ImageImportResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  asset?: AssetCatalogEntry;
}

export interface SpritesheetImportMetadata {
  idBase: string;
  name: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface SpritesheetImportResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  asset?: AssetCatalogEntry;
}

export type AudioImportUsage = 'bgm' | 'sfx';

export interface AudioImportMetadata {
  usage: AudioImportUsage;
}

export interface AudioImportResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  asset?: AssetCatalogEntry;
}

export interface FullProjectState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  assets?: AssetCatalogData;
}

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  assets?: AssetCatalogData;
}

export interface ProjectDataAdapter {
  getCapabilities(): AdapterCapabilities;
  loadProject(): Promise<FullProjectState>;
  saveProject(data: ProjectData): Promise<SaveResult>;
  saveMap(mapId: string, data: MapData): Promise<SaveResult>;
  saveItems(data: ItemDatabase): Promise<SaveResult>;
  saveAll(state: FullProjectState): Promise<SaveResult>;
  exportAll(state: FullProjectState): Promise<Blob>;
  importAll(input: string | Blob): Promise<FullProjectState>;
}

export type RuntimeStatus = 'unavailable' | 'ready' | 'running';

export interface RuntimeLaunchResult {
  success: boolean;
  error?: string;
  pid?: number;
  executablePath?: string;
  logPath?: string;
}

export interface RuntimeLaunchOptions {
  executableSearchRoot?: string;
}

export interface RuntimeLogInfo {
  success: boolean;
  path?: string;
  error?: string;
}

export interface RuntimeLogTailResult {
  success: boolean;
  path?: string;
  content?: string;
  truncated?: boolean;
  maxBytes?: number;
  error?: string;
}

export interface RuntimeSnapshotResult {
  success: boolean;
  path?: string;
  content?: string;
  truncated?: boolean;
  maxBytes?: number;
  error?: string;
}

export interface RuntimeDiagnosticsInfo {
  success: boolean;
  diagnosticsDir?: string;
  latestLogPath?: string;
  latestSnapshotPath?: string;
  logTailMaxBytes: number;
  snapshotMaxBytes: number;
  error?: string;
}

export interface RuntimeLogActionResult {
  success: boolean;
  error?: string;
}

export interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(projectPath: string, options?: RuntimeLaunchOptions): Promise<RuntimeLaunchResult>;
  getStatus(): RuntimeStatus;
  kill(): Promise<void>;
  getDiagnostics(): Promise<RuntimeDiagnosticsInfo>;
  getLatestLog(): Promise<RuntimeLogInfo>;
  readLatestLogTail(maxBytes: number): Promise<RuntimeLogTailResult>;
  readLatestSnapshot(maxBytes: number): Promise<RuntimeSnapshotResult>;
  openLogFolder(): Promise<RuntimeLogActionResult>;
  getUnavailableReason(): string | null;
}

export type PlaytestSessionMode = 'projectStart' | 'currentMap' | 'selectedEvent';

export interface PlaytestSessionRequest {
  mode: PlaytestSessionMode;
  currentMapId?: string;
  selectedEventMapId?: string;
  selectedEventId?: string;
}

export interface PlaytestSessionResult {
  success: boolean;
  error?: string;
  sessionRoot?: string;
  prunedSessionRoots?: string[];
}

export interface PlaytestSessionAdapter {
  canCreateSession(): boolean;
  createSession(
    sourceRoot: string,
    state: FullProjectState,
    request: PlaytestSessionRequest,
  ): Promise<PlaytestSessionResult>;
  getUnavailableReason(): string | null;
}

export interface ValidationGate {
  ok: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

// Re-export the RpgBridge interface for adapter consumers and tests.
export type { RpgBridge, OpenDialogResult, ShellInfo } from '../types/rpgBridge';
