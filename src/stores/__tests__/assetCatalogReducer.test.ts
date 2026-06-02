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
});
