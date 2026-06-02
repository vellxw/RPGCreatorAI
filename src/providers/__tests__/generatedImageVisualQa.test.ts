import { describe, expect, it } from 'vitest';
import type { AssetCatalogEntry } from '../../types/project';
import {
  applyGeneratedImageVisualQaResult,
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
} from '../generatedImageVisualQa';

const generatedAsset: AssetCatalogEntry = {
  id: 'forest_concept_variation',
  name: 'Forest Concept Variation',
  kind: 'image',
  path: 'assets/generated/edits/forest_concept_variation.png',
  source: 'generated',
  tags: ['generated', 'image-edit', 'variation'],
  width: 1536,
  height: 1024,
  runtimeCompatible: false,
  generated: {
    promptTemplateId: 'asset-edit-v1',
    providerId: 'local',
    modelId: 'offline-image-edit-mock',
    operation: 'image.edit',
    sourceAssetId: 'forest_concept',
  },
};

describe('generatedImageVisualQa', () => {
  it('builds deterministic QA draft checks from candidate dimensions and metadata', () => {
    const draft = buildGeneratedImageVisualQaDraft(generatedAsset, {
      width: 1536,
      height: 1024,
      assetRef: 'mock://generated/forest.png',
      providerFixture: 'offline-image-edit',
    });

    expect(draft.checks.dimensions).toMatchObject({
      id: 'dimensions',
      status: 'pass',
      actual: '1536x1024',
      expected: '1536x1024',
    });
    expect(draft.checks.transparency.status).toBe('warning');
    expect(draft.checks.styleConsistency.status).toBe('warning');
    expect(draft.checks.readability.status).toBe('warning');
    expect(draft.checks.runtimeSuitability.status).toBe('warning');
    expect(draft.unresolvedWarnings).toEqual([
      'transparency',
      'styleConsistency',
      'readability',
      'runtimeSuitability',
    ]);
  });

  it('finalizes accept/reject QA results with score, notes, tags, and rejection reason', () => {
    const draft = buildGeneratedImageVisualQaDraft(generatedAsset, {
      width: 1536,
      height: 1024,
      assetRef: 'mock://generated/forest.png',
    });
    const accepted = finalizeGeneratedImageVisualQaReview(draft, {
      status: 'accepted',
      reviewedAt: '2026-06-02T20:20:00.000Z',
      notes: 'Readable enough for the asset library after manual review.',
      tags: ['qa-reviewed', 'manual-pass'],
      checks: {
        styleConsistency: { status: 'pass', notes: 'Matches current generated forest palette.' },
        readability: { status: 'pass', notes: 'Silhouette remains clear.' },
      },
    });

    expect(accepted).toMatchObject({
      status: 'accepted',
      reviewedAt: '2026-06-02T20:20:00.000Z',
      score: 80,
      notes: 'Readable enough for the asset library after manual review.',
      tags: ['qa-reviewed', 'manual-pass'],
      unresolvedWarnings: ['transparency', 'runtimeSuitability'],
    });
    expect(accepted.checks.styleConsistency).toMatchObject({
      status: 'pass',
      notes: 'Matches current generated forest palette.',
    });

    const rejected = finalizeGeneratedImageVisualQaReview(draft, {
      status: 'rejected',
      reviewedAt: '2026-06-02T20:21:00.000Z',
      notes: 'Too noisy.',
      tags: ['qa-rejected'],
      rejectionReason: 'Readability failed at inventory scale.',
      checks: {
        readability: { status: 'fail', notes: 'Shape breaks down at small size.' },
      },
    });

    expect(rejected).toMatchObject({
      status: 'rejected',
      score: 40,
      rejectionReason: 'Readability failed at inventory scale.',
      unresolvedWarnings: ['transparency', 'styleConsistency', 'runtimeSuitability'],
    });
  });

  it('stores accepted QA result in generated asset metadata without dropping provenance', () => {
    const draft = buildGeneratedImageVisualQaDraft(generatedAsset, {
      width: 1536,
      height: 1024,
      assetRef: 'mock://generated/forest.png',
    });
    const result = finalizeGeneratedImageVisualQaReview(draft, {
      status: 'accepted',
      reviewedAt: '2026-06-02T20:22:00.000Z',
      notes: 'Accepted with remaining runtime export warning.',
      tags: ['qa-reviewed'],
    });

    const stamped = applyGeneratedImageVisualQaResult(generatedAsset, result);

    expect(stamped.generated).toMatchObject({
      promptTemplateId: 'asset-edit-v1',
      operation: 'image.edit',
      sourceAssetId: 'forest_concept',
      visualQa: {
        status: 'accepted',
        reviewedAt: '2026-06-02T20:22:00.000Z',
        score: 60,
        tags: ['qa-reviewed'],
      },
    });
    expect(stamped.tags).toEqual(expect.arrayContaining(['generated', 'qa-reviewed']));
  });
});
