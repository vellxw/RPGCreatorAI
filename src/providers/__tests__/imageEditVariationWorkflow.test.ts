import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import type { AssetCatalogEntry } from '../../types/project';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveImageEditVariationCandidate,
  buildImageEditVariationRequest,
  defaultImageEditVariationDraft,
  generateImageEditVariationCandidate,
  validateImageEditVariationCandidate,
} from '../imageEditVariationWorkflow';

const sourceAsset: AssetCatalogEntry = {
  id: 'forest_concept',
  name: 'Forest Concept',
  kind: 'image',
  path: 'assets/imported/images/forest_concept.png',
  source: 'imported',
  tags: ['concept', 'forest'],
  width: 1536,
  height: 1024,
};

describe('imageEditVariationWorkflow', () => {
  it('builds a capability-gated image edit request with source asset provenance', () => {
    const draft = {
      ...defaultImageEditVariationDraft(sourceAsset, { mode: 'variation' }),
      promptInputs: {
        instruction: 'Create a dusk lighting variation for this forest concept.',
        useCase: 'reviewed map concept iteration',
        preserve: 'composition, tile scale, and playable-space readability',
        maskNotes: 'no mask; whole-image variation',
      },
      referenceAssetIds: ['palette_reference'],
    };

    const built = buildImageEditVariationRequest(draft, {
      requestId: 'edit-var-1',
      createdAt: '2026-06-02T19:55:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'edit-var-1',
      operation: 'image.edit',
      providerId: 'local',
      modelId: 'offline-image-edit-mock',
      createdAt: '2026-06-02T19:55:00.000Z',
      input: {
        mode: 'variation',
        sourceAssetId: 'forest_concept',
        sourceAssetPath: 'assets/imported/images/forest_concept.png',
        sourceAssetKind: 'image',
        referenceAssetIds: ['palette_reference'],
        expectedWidth: 1536,
        expectedHeight: 1024,
        outputFormat: 'png',
        quality: 'low',
        promptTemplateId: 'asset-edit-v1',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('asset-edit-v1');
    expect(built.request.prompt).toContain('Forest Concept');
    expect(built.request.prompt).toContain('dusk lighting variation');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending non-destructive variation candidate through the mock provider', async () => {
    const candidate = await generateImageEditVariationCandidate(
      createMockProviderAdapter(),
      ['forest_concept'],
      defaultImageEditVariationDraft(sourceAsset, {
        mode: 'variation',
        referenceAssetIds: ['palette_reference'],
      }),
      {
        requestId: 'edit-var-2',
        createdAt: '2026-06-02T19:56:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.sourceAsset).toEqual(sourceAsset);
    expect(candidate.asset).toMatchObject({
      id: 'forest_concept_variation',
      name: 'Forest Concept Variation',
      kind: 'image',
      source: 'generated',
      path: 'assets/generated/edits/forest_concept_variation.png',
      width: 1536,
      height: 1024,
      tags: ['generated', 'image-edit', 'variation', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'asset-edit-v1',
        promptTemplateKind: 'edit',
        providerId: 'local',
        modelId: 'offline-image-edit-mock',
        operation: 'image.edit',
        sourceAssetId: 'forest_concept',
        sourceAssetPath: 'assets/imported/images/forest_concept.png',
        editMode: 'variation',
        referenceAssetIds: ['palette_reference'],
      },
    });
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/edit-var-2.png',
      width: 1536,
      height: 1024,
      providerFixture: 'offline-image-edit',
    });
    expect(validateImageEditVariationCandidate(candidate)).toEqual([]);
  });

  it('requires explicit review before an edited asset can enter the manifest', async () => {
    const candidate = await generateImageEditVariationCandidate(
      createMockProviderAdapter(),
      ['forest_concept'],
      defaultImageEditVariationDraft(sourceAsset, { mode: 'edit', maskAssetId: 'forest_mask' }),
      {
        requestId: 'edit-var-3',
        createdAt: '2026-06-02T19:57:00.000Z',
      },
    );

    const approved = approveImageEditVariationCandidate(candidate, {
      reviewedAt: '2026-06-02T19:58:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.assetId).toBe('forest_concept_edit');
    expect(approved.asset.tags).toContain('reviewed');
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed image edit/variation candidate');
    expect(approved.sourceAsset.id).toBe('forest_concept');

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [sourceAsset, approved.asset] });
    expect(normalized.assets[0]).toEqual(sourceAsset);
    expect(normalized.assets[1].generated).toMatchObject({
      promptTemplateId: 'asset-edit-v1',
      modelId: 'offline-image-edit-mock',
      sourceAssetId: 'forest_concept',
      maskAssetId: 'forest_mask',
      editMode: 'edit',
    });
  });

  it('rejects invalid edit candidates before approval', async () => {
    const candidate = await generateImageEditVariationCandidate(
      createMockProviderAdapter(),
      ['forest_concept'],
      defaultImageEditVariationDraft(sourceAsset, { mode: 'variation' }),
      {
        requestId: 'edit-var-invalid',
        createdAt: '2026-06-02T19:59:00.000Z',
      },
    );
    const invalid = {
      ...candidate,
      asset: {
        ...candidate.asset,
        width: 512,
        generated: undefined,
      },
    };

    expect(validateImageEditVariationCandidate(invalid)).toEqual(expect.arrayContaining([
      'Generated image edit asset must keep source asset provenance.',
      'Generated image edit dimensions must match the QA preview.',
    ]));
    expect(() => approveImageEditVariationCandidate(invalid, {
      reviewedAt: '2026-06-02T20:00:00.000Z',
    })).toThrow('Generated image edit candidate is invalid');
  });
});
