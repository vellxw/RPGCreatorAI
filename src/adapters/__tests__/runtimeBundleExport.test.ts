import { describe, expect, it } from 'vitest';
import { prepareRuntimeBundleExport } from '../JsonImportExportAdapter';
import { createNewProjectState } from '../projectTemplates';

describe('runtime bundle export preparation', () => {
  it('compiles the editor state into a GameBundle v1 JSON document', () => {
    const prepared = prepareRuntimeBundleExport(createNewProjectState('Runtime export'));

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const bundle = JSON.parse(prepared.json);
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.project.title).toBe('Runtime export');
    expect(bundle.exportedAt).toBeUndefined();
    expect(bundle.templateId).toBeUndefined();
  });

  it('reports unsafe paths without producing downloadable JSON', () => {
    const state = createNewProjectState('Unsafe runtime export');
    state.project.maps[0].path = '../outside.json';

    const prepared = prepareRuntimeBundleExport(state);

    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsafe-path', path: 'project.maps[0].path' }),
    ]));
    expect('json' in prepared).toBe(false);
  });
});
