// Adapter interfaces for editor persistence and runtime launch
import type {
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

export interface FullProjectState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
}

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
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
}

export interface RuntimeLaunchAdapter {
  canLaunch(): boolean;
  getExecutablePath(): string | null;
  launch(projectPath: string): Promise<RuntimeLaunchResult>;
  getStatus(): RuntimeStatus;
  kill(): Promise<void>;
  getUnavailableReason(): string | null;
}

export interface ValidationGate {
  ok: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

// Re-export the RpgBridge interface for adapter consumers and tests.
export type { RpgBridge, OpenDialogResult, ShellInfo } from '../types/rpgBridge';
