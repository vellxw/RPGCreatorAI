// Save flow: validate, then call adapter to persist, then mark saved.
// All side effects (export download, error toast) live here so screen
// components stay simple.

import type { Dispatch } from 'react';
import type { ProjectAction, ProjectStoreState } from './projectStore';
import { validateProject } from '../validation/validateProject';
import { getProjectDataAdapter } from '../adapters/adapterFactory';
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
  const fullState = { project: state.project, maps: state.maps, items: state.items };

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

  let exported = false;
  if (options.exportAfterSave && !adapter.getCapabilities().canWriteFiles) {
    // Browser mode: also offer a download so the save isn't lost on refresh.
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
  const fullState = { project: state.project, maps: state.maps, items: state.items };
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
