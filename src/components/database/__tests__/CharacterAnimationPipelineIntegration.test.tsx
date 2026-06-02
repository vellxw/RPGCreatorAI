import React, { act } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import type { FullProjectState } from '../../../adapters/types';
import { createMockProviderAdapter } from '../../../providers/mockProviderAdapter';
import {
  approveCharacterConceptGenerationCandidate,
  defaultCharacterConceptGenerationDraft,
  generateCharacterConceptCandidate,
} from '../../../providers/characterConceptGenerationWorkflow';
import {
  approveSpriteSheetGenerationCandidate,
  defaultSpriteSheetGenerationDraft,
  generateSpriteSheetCandidate,
} from '../../../providers/spriteSheetGenerationWorkflow';
import {
  applyGeneratedAnimationQaResult,
  buildGeneratedAnimationQaDraft,
  finalizeGeneratedAnimationQaReview,
} from '../../../providers/generatedAnimationQa';
import {
  applyGeneratedImageVisualQaResult,
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
} from '../../../providers/generatedImageVisualQa';
import type { MapData } from '../../../types/project';
import { validateProject } from '../../../validation/validateProject';
import { AnimationPreview } from '../AnimationPreview';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function makeMap(): MapData {
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 4,
    height: 4,
    tileSize: 32,
    layers: [
      { name: 'g', type: 'visual', tiles: new Array(16).fill(1) },
      { name: 'c', type: 'collision', tiles: new Array(16).fill(0) },
    ],
    events: [],
  };
}

describe('character animation AI pipeline integration gate', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('validates mock concept to accepted sprite QA through editor preview and runtime fixture paths', async () => {
    const adapter = createMockProviderAdapter();
    const conceptCandidate = await generateCharacterConceptCandidate(
      adapter,
      [],
      defaultCharacterConceptGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'gate_hero',
        ownerName: 'Gate Hero',
        description: 'Integration gate hero concept for sprite and runtime validation.',
      }),
      {
        requestId: 'cp080-concept',
        createdAt: '2026-06-02T23:20:00.000Z',
      },
    );
    const conceptApproved = approveCharacterConceptGenerationCandidate(conceptCandidate, {
      reviewedAt: '2026-06-02T23:21:00.000Z',
    });

    const spriteCandidate = await generateSpriteSheetCandidate(
      adapter,
      [conceptApproved.asset.id],
      [],
      defaultSpriteSheetGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'gate_hero',
        ownerName: 'Gate Hero',
        sourceConceptAsset: conceptApproved.asset,
        description: 'Reviewed concept for CP-080 character animation pipeline gate.',
      }),
      {
        requestId: 'cp080-sprite',
        createdAt: '2026-06-02T23:22:00.000Z',
      },
    );

    const animationQaDraft = buildGeneratedAnimationQaDraft(spriteCandidate);
    expect(Object.values(animationQaDraft.checks).every(check => check.status === 'pass')).toBe(true);
    const animationQa = finalizeGeneratedAnimationQaReview(animationQaDraft, {
      status: 'accepted',
      reviewedAt: '2026-06-02T23:23:00.000Z',
      notes: 'CP-080 integration gate accepted animation QA.',
      tags: ['animation-qa-reviewed'],
    });
    const animationQaCandidate = {
      ...spriteCandidate,
      asset: applyGeneratedAnimationQaResult(spriteCandidate.asset, animationQa),
    };
    const spriteApproved = approveSpriteSheetGenerationCandidate(animationQaCandidate, {
      reviewedAt: '2026-06-02T23:24:00.000Z',
    });
    const visualQa = finalizeGeneratedImageVisualQaReview(
      buildGeneratedImageVisualQaDraft(spriteApproved.asset, spriteApproved.qaPreview),
      {
        status: 'accepted',
        reviewedAt: '2026-06-02T23:25:00.000Z',
        notes: 'CP-080 integration gate accepted visual QA.',
        tags: ['qa-reviewed'],
        checks: {
          transparency: { status: 'pass' },
          styleConsistency: { status: 'pass' },
          readability: { status: 'pass' },
          runtimeSuitability: { status: 'pass' },
        },
      },
    );
    const acceptedSpriteAsset = applyGeneratedImageVisualQaResult(spriteApproved.asset, visualQa);

    expect(acceptedSpriteAsset).toMatchObject({
      source: 'generated',
      runtimeCompatible: true,
      generated: {
        promptTemplateId: 'character-spritesheet-v1',
        sourceAssetId: conceptApproved.asset.id,
        animationQa: { status: 'accepted' },
        visualQa: { status: 'accepted' },
      },
    });
    expect(acceptedSpriteAsset.tags).toEqual(expect.arrayContaining([
      'reviewed',
      'animation-qa-reviewed',
      'qa-reviewed',
    ]));

    const project: FullProjectState = {
      project: {
        schemaVersion: 1,
        title: 'CP-080 Gate',
        startMapId: 'town',
        startPosition: { x: 0, y: 0, direction: 'down' },
        maps: [{ id: 'town', path: 'data/maps/town.json' }],
        database: { items: 'data/database/items.json' },
      },
      maps: { town: makeMap() },
      items: { items: [{ id: 'potion', name: 'Potion', description: '', type: 'consumable' }] },
      databases: mergeDatabases({
        animations: { sets: [spriteApproved.animationSet] },
        system: {
          startingParty: [],
          startingGold: 0,
          playerAnimationSet: spriteApproved.animationSet.id,
        },
      }),
      assets: {
        schemaVersion: 1,
        assets: [conceptApproved.asset, acceptedSpriteAsset],
      },
    };
    const report = validateProject(project);
    expect(report.errors).toEqual([]);

    const clip = spriteApproved.animationSet.clips[0];
    const preview = render(
      <AnimationPreview
        clip={clip}
        display={spriteApproved.animationSet.display}
        assetPreviewUrls={{ [acceptedSpriteAsset.id]: 'assets/generated/web/player_adventurer_walk_down.png' }}
      />,
    );
    const image = preview.container.querySelector('image');
    expect(preview.container.querySelector('svg[aria-label="Animation preview"]')).not.toBeNull();
    expect(image?.getAttribute('href')).toBe('assets/generated/web/player_adventurer_walk_down.png');
    preview.unmount();

    const runtimeManifestPath = resolve(process.cwd(), 'data/assets/runtime-manifest.json');
    const runtimeManifest = JSON.parse(readFileSync(runtimeManifestPath, 'utf-8')) as {
      assets: Array<{ id: string; runtimePath: string; sourceNormalizationManifest?: string }>;
    };
    const generatedRuntimeEntry = runtimeManifest.assets.find(asset => asset.id === 'player_adventurer_walk_down');
    expect(generatedRuntimeEntry).toMatchObject({
      runtimePath: 'assets/generated/runtime/player_adventurer_walk_down.bmp',
      sourceNormalizationManifest: 'assets/generated/source/phase11_animation_normalization/player_adventurer_walk_down.json',
    });
    expect(existsSync(resolve(process.cwd(), generatedRuntimeEntry!.runtimePath))).toBe(true);

    expect(JSON.stringify([conceptCandidate, spriteCandidate, acceptedSpriteAsset])).not.toMatch(/fetch|https:\/\/api|apiKey|secret|token|sk-/i);
  });
});
