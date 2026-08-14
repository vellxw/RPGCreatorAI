// Browser-side helpers to download/upload the project JSON bundle.
// This is a stateless utility, not a full ProjectDataAdapter — it
// composes with BrowserMemoryAdapter to give users a way to persist
// their work outside the page.

import type { FullProjectState } from './types';
import { buildExportBundle, parseImportBundle, safeStringify } from './jsonUtils';
import {
  compileGameBundleV1,
  serializeGameBundleV1,
  type GameBundleCompileIssue,
} from '../runtime-core/gameBundleCompiler';

export type RuntimeBundleExportPreparation =
  | {
      ok: true;
      json: string;
      warnings: GameBundleCompileIssue[];
    }
  | {
      ok: false;
      errors: GameBundleCompileIssue[];
      warnings: GameBundleCompileIssue[];
    };

/**
 * Compiles an editor project into the runtime-only GameBundle payload without
 * touching the filesystem or starting a browser download.
 */
export function prepareRuntimeBundleExport(state: FullProjectState): RuntimeBundleExportPreparation {
  const result = compileGameBundleV1(state);
  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }
  return {
    ok: true,
    json: serializeGameBundleV1(result.bundle),
    warnings: result.warnings,
  };
}

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportToFile(state: FullProjectState, filename = 'rpgcreator-project.json'): void {
  const bundle = buildExportBundle(state);
  const json = safeStringify(bundle);
  downloadJson(json, filename);
}

/** Downloads only after compilation succeeds; invalid projects cause no side effect. */
export function exportRuntimeBundleToFile(
  state: FullProjectState,
  filename = 'game-bundle.v1.json',
): RuntimeBundleExportPreparation {
  const prepared = prepareRuntimeBundleExport(state);
  if (prepared.ok) downloadJson(prepared.json, filename);
  return prepared;
}

export async function importFromFile(file: File): Promise<FullProjectState> {
  const text = await file.text();
  return parseImportBundle(text);
}

export function importFromText(text: string): FullProjectState {
  return parseImportBundle(text);
}
