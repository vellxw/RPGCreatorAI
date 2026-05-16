// FileSystemAdapter — real implementation backed by the desktop shell's
// IPC bridge (window.rpgBridge.fs). When the bridge is present, every
// save/load goes through restricted Tauri commands that sandbox paths to
// the active project root.
//
// The class still falls back to BrowserMemoryAdapter behaviour for
// loadProject() and exportAll()/importAll() so the editor can render
// something coherent if it is somehow instantiated outside the shell.

import type {
  AdapterCapabilities,
  FullProjectState,
  ProjectDataAdapter,
  SaveResult,
} from './types';
import type { ItemDatabase, MapData, ProjectData } from '../types/project';
import { BrowserMemoryAdapter } from './BrowserMemoryAdapter';

export class FileSystemAdapter implements ProjectDataAdapter {
  // Falls back for loadProject/export/import when the renderer hasn't yet
  // told us which project root is active.
  private fallback = new BrowserMemoryAdapter();

  // The active project root — set by the renderer after openProjectDialog
  // or readProject. Without it we cannot write anywhere.
  private projectRoot: string | null = null;

  setProjectRoot(root: string | null): void {
    this.projectRoot = root;
  }

  getProjectRoot(): string | null {
    return this.projectRoot;
  }

  getCapabilities(): AdapterCapabilities {
    const hasBridge = typeof window !== 'undefined' && !!window.rpgBridge;
    return {
      canReadFiles: hasBridge,
      canWriteFiles: hasBridge,
      canCreateBackups: hasBridge,
      adapterName: hasBridge ? 'FileSystemAdapter (Tauri)' : 'FileSystemAdapter (seam)',
    };
  }

  async loadProject(): Promise<FullProjectState> {
    if (this.projectRoot && window.rpgBridge) {
      return window.rpgBridge.fs.readProject(this.projectRoot);
    }
    return this.fallback.loadProject();
  }

  async saveProject(_data: ProjectData): Promise<SaveResult> {
    return {
      success: false,
      error: 'Use saveAll() in desktop mode; per-file save is not exposed by the shell.',
    };
  }

  async saveMap(_mapId: string, _data: MapData): Promise<SaveResult> {
    return {
      success: false,
      error: 'Use saveAll() in desktop mode; per-file save is not exposed by the shell.',
    };
  }

  async saveItems(_data: ItemDatabase): Promise<SaveResult> {
    return {
      success: false,
      error: 'Use saveAll() in desktop mode; per-file save is not exposed by the shell.',
    };
  }

  async saveAll(state: FullProjectState): Promise<SaveResult> {
    if (!window.rpgBridge) {
      return {
        success: false,
        error: 'Desktop shell bridge not available; cannot write to disk.',
      };
    }
    if (!this.projectRoot) {
      return {
        success: false,
        error: 'No project is open. Use Open Project first.',
      };
    }
    try {
      return await window.rpgBridge.fs.writeProject(this.projectRoot, state);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async exportAll(state: FullProjectState): Promise<Blob> {
    return this.fallback.exportAll(state);
  }

  async importAll(input: string | Blob): Promise<FullProjectState> {
    return this.fallback.importAll(input);
  }
}
