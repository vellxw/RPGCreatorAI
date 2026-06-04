import { describe, expect, it } from 'vitest';
import { initialProjectStoreState, projectReducer, type ProjectStoreState } from '../projectStore';

describe('asset catalog reducer', () => {
  it('adds imported image entries without accepting duplicate ids', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'existing_image',
            name: 'Existing Image',
            kind: 'image',
            path: 'assets/imported/images/existing.png',
            source: 'imported',
          },
        ],
      },
    };

    const imported = projectReducer(state, {
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'castle_gate',
        name: 'Castle Gate',
        kind: 'image',
        path: 'assets/imported/images/castle_gate.png',
        source: 'imported',
        tags: ['imported'],
      },
    });

    expect(imported.assets.assets.map(asset => asset.id)).toEqual(['existing_image', 'castle_gate']);
    expect(imported.dirty).toBe(true);

    const duplicate = projectReducer(imported, {
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'castle_gate',
        name: 'Duplicate Castle Gate',
        kind: 'image',
        path: 'assets/imported/images/castle_gate_2.png',
        source: 'imported',
      },
    });

    expect(duplicate).toBe(imported);
  });

  it('updates mutable asset metadata without changing identity fields', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [
          {
            id: 'hero_run_sheet',
            name: 'Hero Run Sheet',
            kind: 'spritesheet',
            path: 'assets/imported/spritesheets/hero-run-sheet.png',
            source: 'imported',
            tags: ['hero'],
          },
        ],
      },
    };

    const updated = projectReducer(state, {
      type: 'UPDATE_ASSET_CATALOG_METADATA',
      id: 'hero_run_sheet',
      changes: {
        name: 'Hero Run Revised',
        source: 'local',
        tags: ['hero', 'runtime'],
        width: 384,
        height: 64,
        runtimeCompatible: true,
        runtimeNotes: 'Runtime ready.',
        provenance: 'Local test import',
        notes: 'Reviewed.',
        protected: true,
      },
    });

    expect(updated.assets.assets[0]).toEqual({
      id: 'hero_run_sheet',
      name: 'Hero Run Revised',
      kind: 'spritesheet',
      path: 'assets/imported/spritesheets/hero-run-sheet.png',
      source: 'local',
      tags: ['hero', 'runtime'],
      width: 384,
      height: 64,
      runtimeCompatible: true,
      runtimeNotes: 'Runtime ready.',
      provenance: 'Local test import',
      notes: 'Reviewed.',
      protected: true,
    });
    expect(updated.dirty).toBe(true);
  });

  it('records accepted generated asset provenance in project generation history', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      assets: {
        schemaVersion: 1,
        assets: [],
      },
    };

    const updated = projectReducer(state, {
      type: 'ADD_ASSET_CATALOG_ENTRY',
      asset: {
        id: 'forest_tileset_generated',
        name: 'Forest Tileset',
        kind: 'generated',
        path: 'assets/generated/forest_tileset.png',
        source: 'generated',
        generated: {
          prompt: 'Create a forest tileset with token fixture-token-value',
          promptInputs: { biome: 'forest', apiKey: 'sk-test-secret' },
          promptTemplateId: 'tileset-rpg-map-v1',
          promptTemplateVersion: 1,
          promptTemplateKind: 'tileset',
          providerId: 'local',
          modelId: 'offline-image-mock',
          createdAt: '2026-06-04T04:40:00.000Z',
          operation: 'image.generate',
        },
      },
    });

    expect(updated.project.generationHistory?.records).toHaveLength(1);
    expect(updated.project.generationHistory?.records[0]).toMatchObject({
      kind: 'asset',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      reviewState: 'accepted',
      linkedOutputs: [
        {
          kind: 'asset',
          id: 'forest_tileset_generated',
          path: 'assets/generated/forest_tileset.png',
          label: 'Forest Tileset',
        },
      ],
    });
    expect(JSON.stringify(updated.project.generationHistory)).not.toMatch(/fixture-token-value|sk-test-secret/i);
  });
});
