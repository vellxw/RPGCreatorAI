// Browser-side helpers to download/upload the project JSON bundle.
// This is a stateless utility, not a full ProjectDataAdapter — it
// composes with BrowserMemoryAdapter to give users a way to persist
// their work outside the page.

import type { FullProjectState } from './types';
import { buildExportBundle, parseImportBundle, safeStringify } from './jsonUtils';

export function exportToFile(state: FullProjectState, filename = 'rpgcreator-project.json'): void {
  const bundle = buildExportBundle(state);
  const json = safeStringify(bundle);
  const blob = new Blob([json], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke async to allow click to flush.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importFromFile(file: File): Promise<FullProjectState> {
  const text = await file.text();
  return parseImportBundle(text);
}

export function importFromText(text: string): FullProjectState {
  return parseImportBundle(text);
}
