import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import type { AssetCatalogEntry } from '../../types/project';
import type { SpriteSheetGenerationCandidate } from '../spriteSheetGenerationWorkflow';
import {
  applyGeneratedAnimationQaResult,
  buildGeneratedAnimationQaDraft,
  finalizeGeneratedAnimationQaReview,
  isCharacterAnimationQaRejectedAsset,
} from '../generatedAnimationQa';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  defaultSpriteSheetGenerationDraft,
  generateSpriteSheetCandidate,
} from '../spriteSheetGenerationWorkflow';

const sourceConceptAsset: AssetCatalogEntry = {
  id: 'arc_concept',
  name: 'Arc Concept',
  kind: 'image',
  path: 'assets/generated/concepts/arc_concept.png',
  source: 'generated',
  tags: ['generated', 'character-concept', 'reviewed'],
  width: 1024,
  height: 1536,
  generated: {
    promptTemplateId: 'character-concept-v1',
    promptTemplateKind: 'concept',
    ownerKind: 'actor',
    ownerId: 'arc',
    ownerName: 'Arc',
  },
};

const REVIEWED_AT = '2026-06-02T22:30:00.000Z';

async function buildCandidate(): Promise<SpriteSheetGenerationCandidate> {
  return generateSpriteSheetCandidate(
    createMockProviderAdapter(),
    [],
    [],
    defaultSpriteSheetGenerationDraft({
      ownerKind: 'actor',
      ownerId: 'arc',
      ownerName: 'Arc',
      sourceConceptAsset,
      description: 'Reviewed hero concept for sprite production.',
    }),
    {
      requestId: 'sprite-gen-rubric',
      createdAt: '2026-06-02T22:29:00.000Z',
    },
  );
}

describe('generatedAnimationQa rubric', () => {
  it('classifies a clean candidate as accepted with score 100 and stamps the catalog with animation-qa-reviewed', async () => {
    const candidate = await buildCandidate();
    const draft = buildGeneratedAnimationQaDraft(candidate);

    expect(draft.checks.preview.status).toBe('pass');
    expect(draft.checks.metadata.status).toBe('pass');
    expect(draft.checks.coverage.status).toBe('pass');
    expect(draft.checks.runtimeCompatibility.status).toBe('pass');
    expect(draft.unresolvedWarnings).toEqual([]);

    const result = finalizeGeneratedAnimationQaReview(draft, {
      status: 'accepted',
      reviewedAt: REVIEWED_AT,
      notes: 'Sheet is clean and runtime-ready.',
      tags: ['rubric-accepted'],
    });

    expect(result.status).toBe('accepted');
    expect(result.score).toBe(100);
    expect(result.unresolvedWarnings).toEqual([]);
    expect(result.tags).toEqual(['rubric-accepted']);

    const stamped = applyGeneratedAnimationQaResult(candidate.asset, result);
    expect(stamped.tags).toEqual(expect.arrayContaining(['animation-qa-reviewed', 'rubric-accepted']));
    expect(stamped.tags).not.toContain('animation-qa-rejected');
    expect(stamped.runtimeCompatible).toBe(true);
    expect(stamped.generated?.animationQa).toMatchObject({
      status: 'accepted',
      score: 100,
      tags: ['rubric-accepted'],
    });

    // The catalog round-trip is what the editor saves. Ensure the normalized
    // catalog entry keeps the QA result and the runtime-compatible flag.
    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [stamped] });
    expect(normalized.assets[0]).toMatchObject({
      id: 'arc_sprite_sheet',
      kind: 'spritesheet',
      runtimeCompatible: true,
      generated: {
        animationQa: {
          status: 'accepted',
          score: 100,
        },
      },
    });
    expect(normalized.assets[0].tags ?? []).toEqual(expect.arrayContaining(['animation-qa-reviewed']));
  });

  it('rejects a tampered candidate, surfaces the failure reason, and stamps the catalog as rejected', async () => {
    const candidate = await buildCandidate();
    // The QA draft must be built from a valid candidate; the tamper happens
    // after the draft so we can drive the rejection path explicitly without
    // re-deriving the candidate. The tampered object mirrors the failure
    // surfaces `buildGeneratedAnimationQaDraft` checks for.
    const tampered: SpriteSheetGenerationCandidate = {
      ...candidate,
      asset: {
        ...candidate.asset,
        width: 250, // expectedWidth = 64 * 4 = 256, so 250 fails runtimeCompatibility
        height: 80, // expectedHeight = 64, so 80 fails runtimeCompatibility + metadata
        generated: {
          ...candidate.asset.generated,
          spriteSheet: {
            ...candidate.asset.generated!.spriteSheet!,
            transparentBackgroundRequired: false, // fails metadata
            frameWidth: 63, // fails metadata (no longer matches qaPreview)
          },
        },
      },
    };

    const draft = buildGeneratedAnimationQaDraft(tampered);
    expect(draft.checks.preview.status).toBe('pass'); // qaPreview itself is still valid
    expect(draft.checks.metadata.status).toBe('fail');
    expect(draft.checks.coverage.status).toBe('pass'); // clip still aligns
    expect(draft.checks.runtimeCompatibility.status).toBe('fail');

    const result = finalizeGeneratedAnimationQaReview(draft, {
      status: 'rejected',
      reviewedAt: REVIEWED_AT,
      notes: 'Sheet width 250 does not match frameWidth * frameCount = 256; transparency flag missing.',
      tags: ['rubric-rejected', 'needs-resize'],
      rejectionReason: 'Generated sprite sheet manifest does not match the QA preview.',
    });

    expect(result.status).toBe('rejected');
    // Two passes (preview=25, coverage=25) + zero fails = 50, then -10 for rejected = 40.
    expect(result.score).toBe(40);
    expect(result.unresolvedWarnings).toEqual([]);
    expect(result.tags).toEqual(['rubric-rejected', 'needs-resize']);
    expect(result.rejectionReason).toBe('Generated sprite sheet manifest does not match the QA preview.');

    const stamped = applyGeneratedAnimationQaResult(tampered.asset, result);
    expect(stamped.tags).toEqual(expect.arrayContaining(['animation-qa-rejected', 'rubric-rejected', 'needs-resize']));
    expect(stamped.tags).not.toContain('animation-qa-reviewed');
    // Rejected assets must NOT be promoted to runtime-compatible.
    expect(stamped.runtimeCompatible).toBe(false);
    expect(stamped.generated?.animationQa).toMatchObject({
      status: 'rejected',
      score: 40,
      rejectionReason: 'Generated sprite sheet manifest does not match the QA preview.',
    });
    expect(isCharacterAnimationQaRejectedAsset(stamped)).toBe(true);

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [stamped] });
    expect(normalized.assets[0]).toMatchObject({
      id: 'arc_sprite_sheet',
      kind: 'spritesheet',
      runtimeCompatible: false,
      generated: {
        animationQa: {
          status: 'rejected',
          score: 40,
        },
      },
    });
    expect(normalized.assets[0].tags ?? []).toEqual(expect.arrayContaining(['animation-qa-rejected']));
    expect(normalized.assets[0].tags ?? []).not.toEqual(expect.arrayContaining(['animation-qa-reviewed']));
  });

  it('produces a warning result by overriding a passing check without rejecting the candidate', async () => {
    const candidate = await buildCandidate();
    const draft = buildGeneratedAnimationQaDraft(candidate);
    expect(draft.checks.preview.status).toBe('pass');
    expect(draft.checks.metadata.status).toBe('pass');
    expect(draft.checks.coverage.status).toBe('pass');
    expect(draft.checks.runtimeCompatibility.status).toBe('pass');

    // Reviewer downgrades the coverage check to `warning` because the
    // actor still needs additional directions in the project-level set.
    const result = finalizeGeneratedAnimationQaReview(draft, {
      status: 'accepted',
      reviewedAt: REVIEWED_AT,
      notes: 'Sheet is clean; coverage warning is tracked for the player set.',
      tags: ['rubric-warning'],
      checks: {
        coverage: {
          status: 'warning',
          notes: 'Player set still needs up-direction clips; this strip only covers down.',
        },
      },
    });

    expect(result.status).toBe('accepted');
    // 3 * 25 (pass: preview, metadata, runtimeCompatibility) + 12 (warning: coverage) = 87
    expect(result.score).toBe(87);
    expect(result.unresolvedWarnings).toEqual(['coverage']);
    expect(result.tags).toEqual(['rubric-warning']);
    expect(result.checks.coverage).toMatchObject({
      status: 'warning',
      notes: 'Player set still needs up-direction clips; this strip only covers down.',
    });

    const stamped = applyGeneratedAnimationQaResult(candidate.asset, result);
    // Warning results are still accepted: the catalog entry is promoted to
    // runtime-compatible and the `animation-qa-reviewed` tag is added.
    expect(stamped.tags).toEqual(expect.arrayContaining(['animation-qa-reviewed', 'rubric-warning']));
    expect(stamped.tags).not.toContain('animation-qa-rejected');
    expect(stamped.runtimeCompatible).toBe(true);
    expect(stamped.generated?.animationQa).toMatchObject({
      status: 'accepted',
      score: 87,
      unresolvedWarnings: ['coverage'],
    });

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [stamped] });
    expect(normalized.assets[0]).toMatchObject({
      id: 'arc_sprite_sheet',
      kind: 'spritesheet',
      runtimeCompatible: true,
      generated: {
        animationQa: {
          status: 'accepted',
          score: 87,
          unresolvedWarnings: ['coverage'],
        },
      },
    });
    expect(normalized.assets[0].tags ?? []).toEqual(expect.arrayContaining(['animation-qa-reviewed']));
    expect(isCharacterAnimationQaRejectedAsset(normalized.assets[0])).toBe(false);
  });
});
