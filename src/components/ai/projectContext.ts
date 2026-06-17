export interface ProjectContextSelectedMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tilesetId: string | null;
}

export interface ProjectContextSelectedEvent {
  id: string;
  pageIndex?: number;
  trigger?: string;
}

export interface ProjectContextDatabase {
  selectedTables: readonly string[];
  selectedRecordCount: number;
  truncated: boolean;
}

export interface ProjectContext {
  projectTitle: string;
  mapCount: number;
  eventCount: number;
  validationStatus: 'valid' | 'warnings' | 'errors' | 'unknown';
  selectedMap: ProjectContextSelectedMap | null;
  selectedEvent: ProjectContextSelectedEvent | null;
  database: ProjectContextDatabase;
}

export interface ProjectContextInput {
  projectId: string | null;
  projectTitle?: string;
  mapCount?: number;
  eventCount?: number;
  validationStatus?: ProjectContext['validationStatus'];
  selectedMap?: ProjectContextSelectedMap | null;
  selectedEvent?: ProjectContextSelectedEvent | null;
  database?: ProjectContextDatabase;
}

const DEFAULT_DATABASE: ProjectContextDatabase = {
  selectedTables: [],
  selectedRecordCount: 0,
  truncated: false,
};

export function buildProjectContext(input: ProjectContextInput): ProjectContext | null {
  if (!input.projectId) return null;
  return {
    projectTitle: input.projectTitle ?? '',
    mapCount: input.mapCount ?? 0,
    eventCount: input.eventCount ?? 0,
    validationStatus: input.validationStatus ?? 'unknown',
    selectedMap: input.selectedMap ?? null,
    selectedEvent: input.selectedEvent ?? null,
    database: input.database ?? DEFAULT_DATABASE,
  };
}
