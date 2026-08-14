import { describe, expect, it } from 'vitest';
import { createNewProjectState } from '../projectTemplates';
import {
  buildExportBundle,
  EXPORT_BUNDLE_SCHEMA_VERSION,
  parseImportBundle,
} from '../jsonUtils';

describe('project bundle compatibility', () => {
  it('exports schema v2 and imports legacy unversioned, v1, and v2 bundles', () => {
    const state = createNewProjectState('Portable project');
    const current = buildExportBundle(state);

    expect(current.schemaVersion).toBe(EXPORT_BUNDLE_SCHEMA_VERSION);
    expect(parseImportBundle(JSON.stringify(current)).project.title).toBe('Portable project');

    const legacy = { ...current } as Record<string, unknown>;
    delete legacy.schemaVersion;
    expect(parseImportBundle(JSON.stringify(legacy)).project.title).toBe('Portable project');

    expect(parseImportBundle(JSON.stringify({ ...current, schemaVersion: 1 })).project.title)
      .toBe('Portable project');
  });

  it('rejects future and malformed schema versions instead of guessing a migration', () => {
    const bundle = buildExportBundle(createNewProjectState('Future project'));

    expect(() => parseImportBundle(JSON.stringify({ ...bundle, schemaVersion: 3 })))
      .toThrow('Unsupported project bundle schema version: 3');
    expect(() => parseImportBundle(JSON.stringify({ ...bundle, schemaVersion: '2' })))
      .toThrow('Unsupported project bundle schema version: 2');
  });

  it('redacts nested credentials on export and import while preserving ordinary story data', () => {
    const state = createNewProjectState('Secret test');
    const project = state.project as unknown as Record<string, unknown>;
    project.providerApiKey = 'sk-export';
    project.integration = {
      clientSecret: 'secret-export',
      session_token: 'token-export',
      secretPassage: 'archive-door',
    };

    const bundle = buildExportBundle(state) as unknown as Record<string, unknown>;
    const exportedProject = bundle.project as Record<string, unknown>;
    expect(exportedProject).not.toHaveProperty('providerApiKey');
    expect(exportedProject.integration).toEqual({ secretPassage: 'archive-door' });

    const hostileImport = JSON.stringify({
      ...bundle,
      project: {
        ...exportedProject,
        password: 'imported-password',
        innocuousLabel: `sk-proj-${'a'.repeat(24)}`,
      },
    });
    const imported = parseImportBundle(hostileImport).project as unknown as Record<string, unknown>;
    expect(imported).not.toHaveProperty('password');
    expect(imported.innocuousLabel).toBe('[REDACTED]');
  });

  it('rejects prototype-bearing metadata instead of cloning it into an export', () => {
    const bundle = buildExportBundle(createNewProjectState('Prototype test'));
    const serialized = JSON.stringify(bundle);
    const hostile = serialized.replace(
      '"project":{',
      '"project":{"__proto__":{"polluted":true},',
    );
    expect(hostile).not.toBe(serialized);
    expect(() => parseImportBundle(hostile)).toThrow('Unsafe metadata key');
  });
});
