// JSON serialization helpers — guarantee valid JSON before write/export
import type { FullProjectState, ExportBundle } from './types';
import type { ProjectData, MapData, ItemDatabase } from '../types/project';

export function safeStringify(value: unknown): string {
  // JSON.stringify never produces malformed JSON for plain values, but we round-trip
  // to confirm it parses back, so we never emit corrupt data.
  const text = JSON.stringify(value, null, 2);
  JSON.parse(text); // throws on invalid; lets caller surface error
  return text;
}

export function buildExportBundle(state: FullProjectState): ExportBundle {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: state.project,
    maps: state.maps,
    items: state.items,
  };
}

export function parseImportBundle(input: string): FullProjectState {
  const parsed = JSON.parse(input);

  // Accept either a bundle (has exportedAt + project + maps + items) or a raw FullProjectState
  if (parsed && typeof parsed === 'object' && 'project' in parsed && 'maps' in parsed && 'items' in parsed) {
    return validateBundleShape(parsed);
  }

  throw new Error('Imported JSON does not match expected project bundle shape');
}

function validateBundleShape(obj: Record<string, unknown>): FullProjectState {
  const project = obj.project as ProjectData | undefined;
  const maps = obj.maps as Record<string, MapData> | undefined;
  const items = obj.items as ItemDatabase | undefined;

  if (!project || typeof project !== 'object') {
    throw new Error('Imported bundle is missing valid project metadata');
  }
  if (!maps || typeof maps !== 'object') {
    throw new Error('Imported bundle is missing valid maps');
  }
  if (!items || typeof items !== 'object' || !Array.isArray(items.items)) {
    throw new Error('Imported bundle is missing valid items database');
  }

  return { project, maps, items };
}
