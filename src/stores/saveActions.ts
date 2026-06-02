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
import { createNewProjectState } from '../adapters/projectTemplates';
import type { FullProjectState } from '../adapters/types';

export interface SaveOutcome {
  success: boolean;
  exported: boolean;
  errors: string[];
  warnings: string[];
  adapterName: string;
  blockedByValidation: boolean;
  validationErrorCount: number;
  validationWarningCount: number;
  recovery: string;
  savedAt?: string;
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
    assets: state.assets,
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
      blockedByValidation: true,
      validationErrorCount: report.errors.length,
      validationWarningCount: report.warnings.length,
      recovery: 'Open Validation, fix the blocking errors, then Save again.',
    };
  }

  const result = await adapter.saveAll(fullState);
  if (!result.success) {
    return {
      success: false,
      exported: false,
      errors: [formatProjectFolderError(result.error ?? 'Unknown save error')],
      warnings: report.warnings.map(w => w.message),
      adapterName: adapter.getCapabilities().adapterName,
      blockedByValidation: false,
      validationErrorCount: 0,
      validationWarningCount: report.warnings.length,
      recovery: 'No saved state was recorded; the editor remains dirty. Resolve the write problem, review .backups if a desktop write partially failed, then Save again.',
    };
  }

  const savedAt = new Date().toISOString();
  dispatch({ type: 'MARK_SAVED', at: savedAt });

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
    blockedByValidation: false,
    validationErrorCount: 0,
    validationWarningCount: report.warnings.length,
    recovery:
      report.warnings.length > 0
        ? 'Warnings remain visible in Validation, but they did not block Save.'
        : 'Project passed validation and was saved.',
    savedAt,
  };
}

export async function performExport(state: ProjectStoreState): Promise<void> {
  const fullState = {
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
    assets: state.assets,
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
    return { success: false, error: formatProjectFolderError((e as Error).message) };
  }
}

// ----------------------------- Desktop-only flows -----------------------------

export interface OpenProjectOutcome {
  success: boolean;
  cancelled: boolean;
  root?: string;
  error?: string;
}

export interface CreateProjectOutcome extends OpenProjectOutcome {
  browserOnly: boolean;
  state?: FullProjectState;
  warning?: string;
}

export function formatProjectFolderError(message: string): string {
  const lower = message.toLowerCase();
  if (message.includes('already contains data/project.json')) {
    return `${message}. Create New Project needs an empty folder. Use Open Project for an existing RPGCreatorAI project.`;
  }
  if (message.includes('does not contain data/project.json')) {
    return `${message}. Choose an RPGCreatorAI project root, or use Create New Project to initialize an empty folder.`;
  }
  if (message.includes('non-empty data directory')) {
    return `${message}. Create New Project will not overwrite an existing data folder. Pick an empty folder or move those files first.`;
  }
  if (lower.includes('desktop shell not available') || lower.includes('desktop shell bridge not available')) {
    return 'Desktop filesystem is unavailable. Run the desktop app to open or save project folders, or use browser Import/Export for a JSON bundle.';
  }
  if (lower.includes('permission denied') || lower.includes('access is denied') || lower.includes('eacces')) {
    return 'Permission denied while accessing project files. Check folder permissions. Close apps that may be locking project files, then try again.';
  }
  if (lower.includes('disk full') || lower.includes('no space') || lower.includes('enospc')) {
    return 'Disk full while writing project files. Free disk space, then try again.';
  }
  if (lower.includes('being used by another process') || lower.includes('file in use') || lower.includes('ebusy')) {
    return 'Project file is in use by another program. Close the other app or runtime, then try again.';
  }
  if (lower.includes('no project is open')) {
    return 'No project is open. Open or create a project before saving.';
  }
  return message;
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
    return {
      success: false,
      cancelled: false,
      error: formatProjectFolderError((e as Error).message),
    };
  }
}

export async function performCreateProject(
  dispatch: Dispatch<ProjectAction>,
  options: { title?: string } = {},
): Promise<CreateProjectOutcome> {
  const state = createNewProjectState(options.title);

  if (!isDesktopShell() || !window.rpgBridge) {
    dispatch({ type: 'LOAD_PROJECT', payload: state });
    return {
      success: true,
      cancelled: false,
      browserOnly: true,
      state,
      warning: 'Created in browser memory. Export the project bundle to keep a copy on disk.',
    };
  }

  try {
    const dlg = await window.rpgBridge.fs.createProjectDialog(state);
    if (dlg.cancelled || !dlg.root || !dlg.state) {
      return { success: false, cancelled: true, browserOnly: false };
    }

    const fsAdapter = getFileSystemAdapter();
    fsAdapter?.setProjectRoot(dlg.root);

    dispatch({ type: 'LOAD_PROJECT', payload: dlg.state });
    await window.rpgBridge.config.addRecent(dlg.root);

    return {
      success: true,
      cancelled: false,
      browserOnly: false,
      root: dlg.root,
      state: dlg.state,
    };
  } catch (e) {
    return {
      success: false,
      cancelled: false,
      browserOnly: false,
      error: formatProjectFolderError((e as Error).message),
    };
  }
}

export async function performOpenRecent(
  root: string,
  dispatch: Dispatch<ProjectAction>,
): Promise<OpenProjectOutcome> {
  if (!isDesktopShell() || !window.rpgBridge) {
    return { success: false, cancelled: false, error: formatProjectFolderError('Desktop shell not available') };
  }
  try {
    const data = await window.rpgBridge.fs.readProject(root);
    const fsAdapter = getFileSystemAdapter();
    fsAdapter?.setProjectRoot(root);
    dispatch({ type: 'LOAD_PROJECT', payload: data });
    await window.rpgBridge.config.addRecent(root);
    return { success: true, cancelled: false, root };
  } catch (e) {
    return { success: false, cancelled: false, error: formatProjectFolderError((e as Error).message) };
  }
}
