import { describe, expect, it } from 'vitest';
import { mergeDatabases } from '../../adapters/defaultDatabases';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveMapDraftGenerationCandidate,
  buildMapDraftGenerationRequest,
  generateMapDraftCandidate,
  validateMapDraftGenerationCandidate,
} from '../mapDraftGenerationWorkflow';

const projectContext = {
  existingMapIds: ['town'],
  tilesets: mergeDatabases({
    tilesets: {
      tilesets: [
        {
          id: 'sample-town',
          name: 'Sample Town',
          tileSize: 32,
          tiles: [
            { id: 0, name: 'Transparent', asset: 'voidWarning', group: 'A', passability: 'blocked', priority: 0 },
            { id: 1, name: 'Grass', asset: 'grass', group: 'A', passability: 'passable', priority: 0 },
            { id: 2, name: 'Path', asset: 'path', group: 'A', passability: 'passable', priority: 0 },
            { id: 3, name: 'Water', asset: 'water', group: 'A', passability: 'blocked', priority: 0 },
            { id: 4, name: 'Snow', asset: 'snow', group: 'A', passability: 'passable', priority: 0 },
            { id: 5, name: 'Tree', asset: 'tree', group: 'B', passability: 'blocked', priority: 1 },
            { id: 7, name: 'Interior Wall', asset: 'interiorWall', group: 'A', passability: 'blocked', priority: 1 },
          ],
        },
      ],
    },
  }).tilesets,
  defaultTilesetId: 'sample-town',
};

describe('mapDraftGenerationWorkflow', () => {
  it('builds a text-generation request for structured offline map drafts', () => {
    const built = buildMapDraftGenerationRequest(
      {
        prompt: 'Draft a snowy village with a warm central path and two NPC hooks.',
        mapId: 'snow_village_draft',
        mapName: 'Snow Village Draft',
        templateId: 'snowy-village-16x9',
      },
      projectContext,
      {
        requestId: 'map-draft-1',
        createdAt: '2026-06-03T00:20:00.000Z',
      },
    );

    expect(built.request).toMatchObject({
      id: 'map-draft-1',
      operation: 'text.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: '2026-06-03T00:20:00.000Z',
      input: {
        responseFormat: 'rpgcreatorai.mapDraft.v1',
        fixture: 'map-draft',
        mapId: 'snow_village_draft',
        mapName: 'Snow Village Draft',
        templateId: 'snowy-village-16x9',
        tilesetId: 'sample-town',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('Draft a snowy village');
    expect(built.request.prompt).toContain('sample-town');
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending editable map candidate through a structured mock response', async () => {
    const candidate = await generateMapDraftCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Draft a snowy village with a warm central path and two NPC hooks.',
        mapId: 'snow_village_draft',
        mapName: 'Snow Village Draft',
        templateId: 'snowy-village-16x9',
      },
      {
        requestId: 'map-draft-snow',
        createdAt: '2026-06-03T00:21:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.map).toMatchObject({
      id: 'snow_village_draft',
      name: 'Snow Village Draft',
      displayName: 'Snow Village Draft',
      tilesetId: 'sample-town',
      width: 40,
      height: 23,
      tileSize: 32,
    });
    expect(candidate.map.layers.map(layer => `${layer.name}:${layer.type}:${layer.role}`)).toEqual([
      'ground:visual:ground',
      'decoration:visual:decoration',
      'foreground:visual:foreground',
      'collision:collision:collision',
      'region:region:region',
    ]);
    expect(candidate.map.layers.every(layer => layer.tiles.length === candidate.map.width * candidate.map.height)).toBe(true);
    expect(candidate.map.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'draft_greeter', trigger: 'interact' }),
      expect.objectContaining({ id: 'draft_hook', trigger: 'interact' }),
    ]));
    expect(candidate.summary).toContain('structured offline map draft');
    expect(candidate.provenance).toMatchObject({
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.mapDraft.v1',
      requestId: 'map-draft-snow',
    });
    expect(validateMapDraftGenerationCandidate(candidate, projectContext)).toEqual([]);
  });

  it('rejects invalid structured map drafts before approval', async () => {
    const candidate = await generateMapDraftCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Draft a town map with intentionally broken fixture layers.',
        mapId: 'broken_draft',
        mapName: 'Broken Draft',
        templateId: 'town-street-16x9',
      },
      {
        requestId: 'map-draft-broken',
        createdAt: '2026-06-03T00:22:00.000Z',
        fixtureInvalidMap: 'bad-layer-length',
      },
    ).catch(error => error as Error);

    expect(candidate).toBeInstanceOf(Error);
    expect((candidate as Error).message).toContain('Layer "ground" has');
  });

  it('requires explicit review before returning an approved editable map', async () => {
    const candidate = await generateMapDraftCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Draft a forest clearing with a chest and an NPC.',
        mapId: 'forest_draft',
        mapName: 'Forest Draft',
        templateId: 'forest-clearing-16x9',
      },
      {
        requestId: 'map-draft-review',
        createdAt: '2026-06-03T00:23:00.000Z',
      },
    );

    const approved = approveMapDraftGenerationCandidate(candidate, projectContext, {
      reviewedAt: '2026-06-03T00:24:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.reviewedAt).toBe('2026-06-03T00:24:00.000Z');
    expect(approved.map.id).toBe('forest_draft');
    expect(approved.map.events.length).toBeGreaterThan(0);
    expect(approved.provenance.reviewedAt).toBe('2026-06-03T00:24:00.000Z');
  });
});
