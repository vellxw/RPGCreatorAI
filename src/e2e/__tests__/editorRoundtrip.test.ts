import { describe, expect, it } from 'vitest';
import { getProjectDataAdapter, _resetAdaptersForTest } from '../../adapters/adapterFactory';
import { initialProjectStoreState, projectReducer, type ProjectAction } from '../../stores/projectStore';
import { performSave } from '../../stores/saveActions';

describe('editor roundtrip', () => {
  it('persists editor map edits through the active save adapter', async () => {
    _resetAdaptersForTest();
    const adapter = getProjectDataAdapter();
    let state = projectReducer(initialProjectStoreState, {
      type: 'LOAD_PROJECT',
      payload: await adapter.loadProject(),
    });

    const dispatch = (action: ProjectAction) => {
      state = projectReducer(state, action);
    };

    state = projectReducer(state, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'collision',
      x: 1,
      y: 1,
      tile: 9,
    });
    state = projectReducer(state, {
      type: 'ADD_EVENT',
      mapId: 'town',
      event: {
        id: 'roundtrip_event',
        type: 'trigger',
        x: 4,
        y: 4,
        solid: false,
        trigger: 'touch',
        commands: [],
      },
    });

    const outcome = await performSave(state, dispatch);
    const reloaded = await adapter.loadProject();
    const collision = reloaded.maps.town.layers.find(layer => layer.type === 'collision');

    expect(outcome.success).toBe(true);
    expect(collision?.tiles[1 * reloaded.maps.town.width + 1]).toBe(9);
    expect(reloaded.maps.town.events.some(event => event.id === 'roundtrip_event')).toBe(true);
  });
});
