import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectDataAdapter, _resetAdaptersForTest } from '../../adapters/adapterFactory';
import { initialProjectStoreState, projectReducer, type ProjectAction } from '../projectStore';
import { performSave } from '../saveActions';

async function loadedState() {
  const adapter = getProjectDataAdapter();
  return projectReducer(initialProjectStoreState, {
    type: 'LOAD_PROJECT',
    payload: await adapter.loadProject(),
  });
}

describe('performSave', () => {
  beforeEach(() => {
    _resetAdaptersForTest();
    vi.restoreAllMocks();
  });

  it('blocks invalid projects before the adapter can write and reports recovery context', async () => {
    const adapter = getProjectDataAdapter();
    const saveSpy = vi.spyOn(adapter, 'saveAll');
    const state = projectReducer(await loadedState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { startMapId: 'missing_map' },
    });
    const actions: ProjectAction[] = [];

    const outcome = await performSave(state, action => actions.push(action));

    expect(outcome.success).toBe(false);
    expect(outcome.blockedByValidation).toBe(true);
    expect(outcome.validationErrorCount).toBeGreaterThan(0);
    expect(outcome.recovery).toContain('Validation');
    expect(saveSpy).not.toHaveBeenCalled();
    expect(actions).toEqual([{ type: 'VALIDATE' }]);
  });

  it('marks valid dirty projects saved with a timestamp after adapter success', async () => {
    const state = projectReducer(await loadedState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { title: 'Saved Project' },
    });
    const actions: ProjectAction[] = [];

    const outcome = await performSave(state, action => {
      actions.push(action);
    });

    expect(outcome.success).toBe(true);
    expect(outcome.blockedByValidation).toBe(false);
    expect(outcome.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(actions).toEqual([{ type: 'VALIDATE' }, { type: 'MARK_SAVED', at: outcome.savedAt }]);
  });

  it('keeps dirty state when the adapter save fails and reports a retry path', async () => {
    const adapter = getProjectDataAdapter();
    vi.spyOn(adapter, 'saveAll').mockResolvedValueOnce({
      success: false,
      error: 'disk full',
    });
    const state = projectReducer(await loadedState(), {
      type: 'UPDATE_PROJECT_META',
      changes: { title: 'Still Dirty' },
    });
    const actions: ProjectAction[] = [];

    const outcome = await performSave(state, action => actions.push(action));

    expect(outcome.success).toBe(false);
    expect(outcome.blockedByValidation).toBe(false);
    expect(outcome.errors).toEqual(['disk full']);
    expect(outcome.recovery).toContain('Save again');
    expect(actions).toEqual([{ type: 'VALIDATE' }]);
  });
});
