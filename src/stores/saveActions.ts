// Save / open / export flows. Validates first, then calls the active adapter.

import type { Dispatch } from 'react';
import type { ProjectAction, ProjectStoreState } from './projectStore';
import { validateProject } from '../validation/validateProject';
import {
  getProjectDataAdapter,
  getFileSystemAdapter,
  isDesktopShell,
} from '../adapters/adapterFactory';
import { exportToFile, importFromFile } from '../adapters/JsonImportExportAdapter';

export interface SaveOutcome {
  success: boolean;
  exported: boolean;
  errors: string[];
  warnings: string[];
  adapterName: string;
}

export async function performSave(
  state: ProjectStoreState,
  dispatch: Dispatch<ProjectAction>,
  options: { exportAfterSave?: boolean } = {},
): Promise<SaveOutcome> {
  const adapter = getProjectDataAdapter();
  const fullState = {
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
  };

  const report = validateProject(fullState);
  dispatch({ type: 'VALIDATE' });

  if (report.errors.length > 0) {
    return {
      success: false,
      exported: false,
      errors: report.errors.map(e => e.message),
      warnings: report.warnings.map(w => w.message),
      adapterName: adapter.getCapabilities().adapterName,
    };
  }

  const result = await adapter.saveAll(fullState);
  if (!result.success) {
    return {
      success: false,
      exported: false,
      errors: [result.error ?? 'Unknown save error'],
      warnings: report.warnings.map(w => w.message),
      adapterName: adapter.getCapabilities().adapterName,
    };
  }

  dispatch({ type: 'MARK_SAVED' });

  // In browser mode the save is in-memory only; offer a download as a backstop.
  let exported = false;
  if (options.exportAfterSave && !adapter.getCapabilities().canWriteFiles) {
    exportToFile(fullState);
    exported = true;
  }

  return {
    success: true,
    exported,
    errors: [],
    warnings: report.warnings.map(w => w.message),
    adapterName: adapter.getCapabilities().adapterName,
  };
}

export async function performExport(state: ProjectStoreState): Promise<void> {
  const fullState = {
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
  };
  exportToFile(fullState);
}

export async function performImport(
  file: File,
  dispatch: Dispatch<ProjectAction>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await importFromFile(file);
    dispatch({ type: 'LOAD_PROJECT', payload: data });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ----------------------------- Desktop-only flows -----------------------------

export interface OpenProjectOutcome {
  success: boolean;
  cancelled: boolean;
  root?: string;
  error?: string;
}

export async function performOpenProject(
  dispatch: Dispatch<ProjectAction>,
): Promise<OpenProjectOutcome> {
  if (!isDesktopShell() || !window.rpgBridge) {
    return {
      success: false,
      cancelled: false,
      error: 'Open Project is only available in the desktop shell.',
    };
  }

  try {
    const dlg = await window.rpgBridge.fs.openProjectDialog();
    if (dlg.cancelled || !dlg.root || !dlg.state) {
      return { success: false, cancelled: true };
    }

    // Update the FileSystemAdapter's idea of the active root so subsequent
    // saveAll() calls write to the right place.
    const fsAdapter = getFileSystemAdapter();
    fsAdapter?.setProjectRoot(dlg.root);

    dispatch({ type: 'LOAD_PROJECT', payload: dlg.state });
    await window.rpgBridge.config.addRecent(dlg.root);

    return { success: true, cancelled: false, root: dlg.root };
  } catch (e) {
    return { success: false, cancelled: false, error: (e as Error).message };
  }
}

export async function performOpenRecent(
  root: string,
  dispatch: Dispatch<ProjectAction>,
): Promise<OpenProjectOutcome> {
  if (!isDesktopShell() || !window.rpgBridge) {
    return { success: false, cancelled: false, error: 'Desktop shell not available' };
  }
  try {
    const data = await window.rpgBridge.fs.readProject(root);
    const fsAdapter = getFileSystemAdapter();
    fsAdapter?.setProjectRoot(root);
    dispatch({ type: 'LOAD_PROJECT', payload: data });
    await window.rpgBridge.config.addRecent(root);
    return { success: true, cancelled: false, root };
  } catch (e) {
    return { success: false, cancelled: false, error: (e as Error).message };
  }
}
