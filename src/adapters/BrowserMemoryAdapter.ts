// In-memory adapter seeded from the bundled JSON. The "save" methods update
// the in-memory snapshot so the rest of the editor sees consistent data, and
// can produce a downloadable export. It never claims to write to disk.

import type {
  AdapterCapabilities,
  FullProjectState,
  ProjectDataAdapter,
  SaveResult,
} from './types';
import type { ItemDatabase, MapData, ProjectData } from '../types/project';
import { buildExportBundle, parseImportBundle, safeStringify } from './jsonUtils';

import projectJson from '../../data/project.json';
import townJson from '../../data/maps/town.json';
import houseJson from '../../data/maps/house.json';
import itemsJson from '../../data/database/items.json';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function seedFromBundle(): FullProjectState {
  return {
    project: deepClone(projectJson) as ProjectData,
    maps: {
      town: deepClone(townJson) as unknown as MapData,
      house: deepClone(houseJson) as unknown as MapData,
    },
    items: deepClone(itemsJson) as ItemDatabase,
  };
}

export class BrowserMemoryAdapter implements ProjectDataAdapter {
  private snapshot: FullProjectState;

  constructor(initial?: FullProjectState) {
    this.snapshot = initial ? deepClone(initial) : seedFromBundle();
  }

  getCapabilities(): AdapterCapabilities {
    return {
      canReadFiles: false,
      canWriteFiles: false,
      canCreateBackups: false,
      adapterName: 'BrowserMemoryAdapter',
    };
  }

  async loadProject(): Promise<FullProjectState> {
    return deepClone(this.snapshot);
  }

  async saveProject(data: ProjectData): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.project = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveMap(mapId: string, data: MapData): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.maps[mapId] = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveItems(data: ItemDatabase): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.items = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveAll(state: FullProjectState): Promise<SaveResult> {
    try {
      // Validate serialization for every shard before committing any of them.
      safeStringify(state.project);
      for (const [, m] of Object.entries(state.maps)) safeStringify(m);
      safeStringify(state.items);

      this.snapshot = deepClone(state);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async exportAll(state: FullProjectState): Promise<Blob> {
    const bundle = buildExportBundle(state);
    const json = safeStringify(bundle);
    return new Blob([json], { type: 'application/json' });
  }

  async importAll(input: string | Blob): Promise<FullProjectState> {
    const text = typeof input === 'string' ? input : await input.text();
    const parsed = parseImportBundle(text);
    this.snapshot = deepClone(parsed);
    return deepClone(parsed);
  }
}
