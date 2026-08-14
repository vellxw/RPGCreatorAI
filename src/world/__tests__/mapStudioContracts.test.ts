import { describe, expect, it } from 'vitest';
import type { GameBundleV1 } from '../../runtime-core/contracts';
import type { MapData } from '../../types/project';
import {
  applyMapStudioDocumentToBundle,
  compileMapStudioDocument,
  type MapStudioDocumentV1,
  validateMapStudioDocument,
} from '../mapStudioContracts';

function mapFixture(): MapData {
  return {
    schemaVersion: 1,
    id: 'ward-1',
    name: 'Ward',
    width: 3,
    height: 2,
    tileSize: 48,
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', tiles: [1, 1, 1, 1, 1, 1] },
      { name: 'collision', type: 'collision', role: 'collision', tiles: [0, 0, 9, 0, 0, 0] },
      { name: 'regions', type: 'region', role: 'region', tiles: [0, 2, 2, 0, 0, 0] },
    ],
    events: [],
  };
}

function documentFixture(): MapStudioDocumentV1 {
  return {
    schemaVersion: 1,
    map: mapFixture(),
    spawns: [{ id: 'entry', kind: 'player', x: 0, y: 0, direction: 'down' }],
    hotspots: [{
      id: 'whisper',
      x: 1,
      y: 0,
      width: 1,
      height: 2,
      trigger: 'touch',
      commands: [{ type: 'showText', text: 'Do not turn around.' }],
    }],
  };
}

describe('Map Studio world contracts', () => {
  it('validates tile layers, collision values, regions, and blocked spawns', () => {
    const document = documentFixture();
    document.map.layers[1].tiles[0] = 3;
    document.map.layers[2].tiles[1] = 300;
    document.spawns[0].x = 2;

    const issues = validateMapStudioDocument(document);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-layer-tile', path: 'map.layers[1].tiles[0]' }),
      expect.objectContaining({ code: 'invalid-layer-tile', path: 'map.layers[2].tiles[1]' }),
      expect.objectContaining({ code: 'blocked-spawn', path: 'spawns[0]' }),
    ]));
  });

  it('compiles rectangular hotspots to ordinary GameBundle events', () => {
    const document = documentFixture();
    const result = compileMapStudioDocument(document);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map.events.map(event => event.id)).toEqual(['whisper@1,0', 'whisper@1,1']);
    expect(result.value.startOverrides.entry).toEqual({
      mapId: 'ward-1', x: 0, y: 0, direction: 'down',
    });
    expect(document.map.events).toEqual([]);
  });

  it('rejects event id conflicts and unknown event spawns', () => {
    const document = documentFixture();
    document.hotspots = [{ ...document.hotspots[0], width: 1, height: 1 }];
    document.map.events.push({
      id: 'whisper', type: 'object', x: 0, y: 1, solid: false, trigger: 'interact', commands: [],
    });
    document.spawns.push({
      id: 'missing-event', kind: 'event', eventId: 'absent', x: 0, y: 1, direction: 'left',
    });

    const result = compileMapStudioDocument(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining([
      'event-id-conflict', 'unknown-event',
    ]));
  });

  it('applies a compiled map to a bundle without mutating the original', () => {
    const document = documentFixture();
    const bundle = {
      schemaVersion: 1,
      project: { schemaVersion: 1, title: 'Test', startMapId: 'ward-1', startPosition: { x: 0, y: 0, direction: 'down' }, maps: [], database: { items: 'data/items.json' } },
      maps: { 'ward-1': mapFixture() },
      items: { items: [] },
      databases: {},
    } as unknown as GameBundleV1;

    const result = applyMapStudioDocumentToBundle(bundle, document);

    expect(result?.bundle.maps['ward-1'].events).toHaveLength(2);
    expect(bundle.maps['ward-1'].events).toHaveLength(0);
  });
});
