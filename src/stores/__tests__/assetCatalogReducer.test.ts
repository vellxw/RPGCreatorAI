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
});
