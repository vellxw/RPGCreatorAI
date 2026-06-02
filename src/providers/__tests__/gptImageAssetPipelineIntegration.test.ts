import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import type { AssetCatalogEntry, ProviderConfig } from '../../types/project';
import {
  applyGeneratedImageVisualQaResult,
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
  type GeneratedImageVisualQaPreview,
} from '../generatedImageVisualQa';
import {
  approveImageEditVariationCandidate,
  defaultImageEditVariationDraft,
  generateImageEditVariationCandidate,
} from '../imageEditVariationWorkflow';
import {
  approveItemIconGenerationCandidate,
  defaultItemIconGenerationDraft,
  generateItemIconCandidate,
} from '../itemIconGenerationWorkflow';
import {
  approvePortraitGenerationCandidate,
  defaultPortraitGenerationDraft,
  generatePortraitCandidate,
} from '../portraitGenerationWorkflow';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  buildProviderCapabilityGates,
  defaultModelCapabilityRegistry,
} from '../modelCapabilityRegistry';
import {
  imageGenerationReadiness,
} from '../providerImageGenerationSettings';
import { providerConfigsFromRegistry } from '../providerRegistry';
import {
  approveTilesetGenerationCandidate,
  defaultTilesetGenerationDraft,
  generateTilesetCandidate,
} from '../tilesetGenerationWorkflow';

const sourceAsset: AssetCatalogEntry = {
  id: 'player_adventurer_sheet',
  name: 'Player Adventurer Sheet',
  kind: 'spritesheet',
  path: 'assets/generated/web/player_adventurer.png',
  source: 'generated',
  tags: ['player', 'runtime', 'sprite'],
  width: 384,
  height: 64,
  frameWidth: 64,
  frameHeight: 64,
  frames: 6,
};

function providerById(configs: ProviderConfig[], id: string): ProviderConfig {
  const provider = configs.find(config => config.id === id);
  if (!provider) throw new Error(`Missing provider config ${id}`);
  return provider;
}

function acceptWithVisualQa(
  asset: AssetCatalogEntry,
  preview: GeneratedImageVisualQaPreview,
): AssetCatalogEntry {
  const result = finalizeGeneratedImageVisualQaReview(
    buildGeneratedImageVisualQaDraft(asset, preview),
    {
      status: 'accepted',
      reviewedAt: '2026-06-02T20:45:00.000Z',
      notes: 'Integration gate review accepted the mock candidate.',
      tags: ['qa-reviewed', 'integration-gate'],
      checks: {
        transparency: { status: 'pass', notes: 'No visible background issue in fixture manifest.' },
        styleConsistency: { status: 'pass', notes: 'Matches RPGCreatorAI visual context.' },
        readability: { status: 'pass', notes: 'Readable at the intended editor/runtime scale.' },
        runtimeSuitability: { status: 'pass', notes: 'Ready for later export normalization.' },
      },
    },
  );
  return applyGeneratedImageVisualQaResult(asset, result);
}

describe('gptImageAssetPipelineIntegration', () => {
  it('keeps GPT Image providers optional when no OpenAI credentials are configured', () => {
    const configs = providerConfigsFromRegistry();
    const openai = providerById(configs, 'openai');
    const local = providerById(configs, 'local');

    expect(openai).toMatchObject({
      enabled: false,
      status: 'disabled',
      credentialState: 'missing',
      model: '',
    });
    expect(imageGenerationReadiness(openai, defaultModelCapabilityRegistry)).toMatchObject({
      state: 'disabled',
      canGenerate: false,
    });
    expect(buildProviderCapabilityGates(configs, defaultModelCapabilityRegistry)
      .filter(gate => gate.id === 'image-generation' || gate.id === 'image-edit')
      .every(gate => gate.available === false)).toBe(true);

    const localImageProvider: ProviderConfig = {
      ...local,
      enabled: true,
      status: 'configured',
      credentialState: 'not-required',
      model: 'offline-image-mock',
    };
    expect(imageGenerationReadiness(localImageProvider, defaultModelCapabilityRegistry)).toMatchObject({
      state: 'ready',
      canGenerate: true,
      modelId: 'offline-image-mock',
    });
  });

  it('runs every GPT Image-capable asset workflow through mock candidates, review, and visual QA metadata', async () => {
    const adapter = createMockProviderAdapter();

    const tilesetCandidate = await generateTilesetCandidate(
      adapter,
      [],
      [],
      defaultTilesetGenerationDraft(1),
      {
        requestId: 'cp072-tileset',
        createdAt: '2026-06-02T20:46:00.000Z',
      },
    );
    const itemCandidate = await generateItemIconCandidate(
      adapter,
      [],
      defaultItemIconGenerationDraft({
        ownerKind: 'item',
        ownerId: 'potion',
        ownerName: 'Potion',
        description: 'Restores a small amount of HP.',
        category: 'consumable',
      }),
      {
        requestId: 'cp072-icon',
        createdAt: '2026-06-02T20:47:00.000Z',
      },
    );
    const portraitCandidate = await generatePortraitCandidate(
      adapter,
      [],
      defaultPortraitGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'hero',
        ownerName: 'Hero',
        description: 'Reliable village adventurer.',
      }),
      {
        requestId: 'cp072-portrait',
        createdAt: '2026-06-02T20:48:00.000Z',
      },
    );
    const editCandidate = await generateImageEditVariationCandidate(
      adapter,
      [sourceAsset.id],
      defaultImageEditVariationDraft(sourceAsset, { mode: 'variation' }),
      {
        requestId: 'cp072-edit',
        createdAt: '2026-06-02T20:49:00.000Z',
      },
    );

    const candidates = [
      tilesetCandidate.asset,
      itemCandidate.asset,
      portraitCandidate.asset,
      editCandidate.asset,
    ];
    expect(candidates.every(asset => asset.tags?.includes('pending-review'))).toBe(true);
    expect(candidates.every(asset => asset.generated?.providerId === 'local')).toBe(true);
    expect(candidates.map(asset => asset.generated?.operation)).toEqual([
      'image.generate',
      'image.generate',
      'image.generate',
      'image.edit',
    ]);
    expect(JSON.stringify(candidates)).not.toMatch(/apiKey|https:\/\/api|sk-/i);

    const approvedAssets = [
      acceptWithVisualQa(
        approveTilesetGenerationCandidate(tilesetCandidate, {
          reviewedAt: '2026-06-02T20:50:00.000Z',
        }).asset,
        tilesetCandidate.qaPreview,
      ),
      acceptWithVisualQa(
        approveItemIconGenerationCandidate(itemCandidate, {
          reviewedAt: '2026-06-02T20:51:00.000Z',
        }).asset,
        itemCandidate.qaPreview,
      ),
      acceptWithVisualQa(
        approvePortraitGenerationCandidate(portraitCandidate, {
          reviewedAt: '2026-06-02T20:52:00.000Z',
        }).asset,
        portraitCandidate.qaPreview,
      ),
      acceptWithVisualQa(
        approveImageEditVariationCandidate(editCandidate, {
          reviewedAt: '2026-06-02T20:53:00.000Z',
        }).asset,
        editCandidate.qaPreview,
      ),
    ];

    expect(approvedAssets.every(asset => !asset.tags?.includes('pending-review'))).toBe(true);
    expect(approvedAssets.every(asset => asset.tags?.includes('reviewed'))).toBe(true);
    expect(approvedAssets.every(asset => asset.tags?.includes('qa-reviewed'))).toBe(true);
    expect(approvedAssets.every(asset => asset.generated?.visualQa?.status === 'accepted')).toBe(true);
    expect(approvedAssets.every(asset => asset.generated?.visualQa?.score === 100)).toBe(true);
    expect(approvedAssets.every(asset => asset.generated?.visualQa?.unresolvedWarnings.length === 0)).toBe(true);

    const normalized = normalizeAssetCatalog({
      schemaVersion: 1,
      assets: [sourceAsset, ...approvedAssets],
    });

    expect(normalized.assets.slice(1).every(asset => asset.generated?.visualQa?.tags.includes('integration-gate')))
      .toBe(true);
    expect(normalized.assets.slice(1).map(asset => asset.generated?.promptTemplateId)).toEqual([
      'tileset-rpg-map-v1',
      'icon-item-v1',
      'portrait-character-v1',
      'asset-edit-v1',
    ]);
  });
});
