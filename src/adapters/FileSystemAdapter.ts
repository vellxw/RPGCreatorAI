// FileSystemAdapter — interface seam for desktop integration (Electron/Tauri/Node).
// In a pure browser/Vite environment, no filesystem APIs exist, so every method
// returns an explicit "not available" error. The class exists as the documented
// integration point where a desktop shell would plug in real fs.* calls.

import type {
  AdapterCapabilities,
  FullProjectState,
  ProjectDataAdapter,
  SaveResult,
} from './types';
import type { ItemDatabase, MapData, ProjectData } from '../types/project';
import { BrowserMemoryAdapter } from './BrowserMemoryAdapter';

const NOT_AVAILABLE_ERROR = 'FileSystemAdapter not available in browser environment.';

export class FileSystemAdapter implements ProjectDataAdapter {
  // We delegate read/load to the in-memory adapter so the editor still has
  // something coherent to display when this adapter is selected for testing
  // or when running inside a browser harness.
  private fallback = new BrowserMemoryAdapter();

  getCapabilities(): AdapterCapabilities {
    return {
      canReadFiles: false,
      canWriteFiles: false,
      canCreateBackups: false,
      adapterName: 'FileSystemAdapter (seam)',
    };
  }

  async loadProject(): Promise<FullProjectState> {
    // A real desktop implementation would read JSON files from disk.
    // For the seam we reuse the in-memory snapshot.
    return this.fallback.loadProject();
  }

  async saveProject(_data: ProjectData): Promise<SaveResult> {
    return { success: false, error: NOT_AVAILABLE_ERROR };
  }

  async saveMap(_mapId: string, _data: MapData): Promise<SaveResult> {
    return { success: false, error: NOT_AVAILABLE_ERROR };
  }

  async saveItems(_data: ItemDatabase): Promise<SaveResult> {
    return { success: false, error: NOT_AVAILABLE_ERROR };
  }

  async saveAll(_state: FullProjectState): Promise<SaveResult> {
    return { success: false, error: NOT_AVAILABLE_ERROR };
  }

  async exportAll(state: FullProjectState): Promise<Blob> {
    return this.fallback.exportAll(state);
  }

  async importAll(input: string | Blob): Promise<FullProjectState> {
    return this.fallback.importAll(input);
  }

  // ---------------------------------------------------------------------
  // Documentation seam: where a desktop shell plugs in
  // ---------------------------------------------------------------------
  //
  // A real Electron/Tauri implementation would replace the bodies above with:
  //
  //   await fs.promises.writeFile(path.join(projectRoot, 'data/project.json'),
  //                                safeStringify(data), 'utf-8');
  //
  // and createBackup() would copy the existing file to
  //   .backups/<filename>.<timestamp>.json
  //
  // before the write. .backups/ is gitignored.
  // ---------------------------------------------------------------------
}
