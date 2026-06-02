import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveTilesetGenerationCandidate,
  buildTilesetGenerationRequest,
  defaultTilesetGenerationDraft,
  generateTilesetCandidate,
  validateTilesetGenerationCandidate,
} from '../tilesetGenerationWorkflow';

describe('tilesetGenerationWorkflow', () => {
  it('builds a prompt-backed offline image generation request for tileset drafts', () => {
    const draft = {
      ...defaultTilesetGenerationDraft(1),
      tilesetId: 'snow_tiles',
      name: 'Snow Village Tiles',
      promptInputs: {
        subject: 'snow village ground, walls, roofs, lamps, paths',
        useCase: 'editable 16:9 RPG town map tileset',
        palette: 'cold blue snow, warm lamplight, dark stone outlines',
        styleNotes: 'copy in the style of Famous Studio',
      },
    };

    const built = buildTilesetGenerationRequest(draft, {
      requestId: 'tileset-gen-1',
      createdAt: '2026-06-02T18:10:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'tileset-gen-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-02T18:10:00.000Z',
      input: {
        tileSize: 32,
        columns: 8,
        tileCount: 64,
        expectedWidth: 256,
        expectedHeight: 256,
        outputFormat: 'png',
        quality: 'low',
        promptTemplateId: 'tileset-rpg-map-v1',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('tileset-rpg-map-v1');
    expect(built.request.prompt).toContain('snow village ground');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(built.request.prompt).not.toMatch(/Famous Studio|copy in the style of/i);
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending catalog and tileset candidate through the mock provider', async () => {
    const adapter = createMockProviderAdapter();
    const draft = {
      ...defaultTilesetGenerationDraft(2),
      tilesetId: 'forest_tiles',
      name: 'Forest Draft',
      tileSize: 16,
      columns: 4,
      tileCount: 10,
      foregroundStartTile: 8,
      regionMarkerCount: 2,
      promptInputs: {
        subject: 'moss forest floor, tree trunks, canopy edges',
        useCase: 'editable RPG forest map tileset',
        palette: 'moss green, bark brown, shadow blue',
        styleNotes: 'pixel-clean original tiles',
      },
    };

    const candidate = await generateTilesetCandidate(adapter, [], [], draft, {
      requestId: 'tileset-gen-forest',
      createdAt: '2026-06-02T18:11:00.000Z',
    });

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.asset).toMatchObject({
      id: 'forest_draft',
      name: 'Forest Draft',
      kind: 'tileset',
      source: 'generated',
      path: 'assets/generated/tilesets/forest_draft.png',
      width: 64,
      height: 48,
      tags: ['generated', 'tileset', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'tileset-rpg-map-v1',
        promptTemplateKind: 'tileset',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    });
    expect(candidate.tileset).toMatchObject({
      id: 'forest_tiles',
      name: 'Forest Draft',
      tileSize: 16,
    });
    expect(candidate.tileset.tiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 0, asset: 'forest_draft', group: 'A', priority: 0 }),
      expect.objectContaining({ id: 8, asset: 'forest_draft', group: 'B', priority: 1 }),
      expect.objectContaining({ id: 1000, asset: 'forest_draft', group: 'Region', terrainTag: 'region_1' }),
      expect.objectContaining({ id: 2000, asset: 'forest_draft', group: 'Collision', passability: 'blocked' }),
    ]));
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/tileset-gen-forest.png',
      width: 64,
      height: 48,
      tileSize: 16,
      columns: 4,
      tileCount: 10,
      rows: 3,
      providerFixture: 'offline-image',
    });
    expect(validateTilesetGenerationCandidate(candidate)).toEqual([]);
  });

  it('requires explicit review before returning project asset and tileset records', async () => {
    const candidate = await generateTilesetCandidate(
      createMockProviderAdapter(),
      [],
      [],
      defaultTilesetGenerationDraft(1),
      {
        requestId: 'tileset-gen-review',
        createdAt: '2026-06-02T18:12:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');

    const approved = approveTilesetGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T18:13:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.asset.tags).toContain('reviewed');
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed for editable tileset use');
    expect(approved.tileset.tiles.every(tile => tile.asset === approved.asset.id)).toBe(true);

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [approved.asset] });
    expect(normalized.assets[0].generated).toMatchObject({
      promptTemplateId: 'tileset-rpg-map-v1',
      modelId: 'offline-image-mock',
    });
  });

  it('rejects invalid dimensions and tile metadata before approval', async () => {
    const candidate = await generateTilesetCandidate(
      createMockProviderAdapter(),
      [],
      [],
      defaultTilesetGenerationDraft(1),
      {
        requestId: 'tileset-gen-invalid',
        createdAt: '2026-06-02T18:14:00.000Z',
      },
    );
    const invalid = {
      ...candidate,
      asset: {
        ...candidate.asset,
        width: 250,
      },
    };

    expect(validateTilesetGenerationCandidate(invalid)).toContain(
      'Generated tileset width must equal columns * tileSize.',
    );
    expect(() => approveTilesetGenerationCandidate(invalid, {
      reviewedAt: '2026-06-02T18:15:00.000Z',
    })).toThrow('Generated tileset candidate is invalid');
  });
});
