import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import type { AssetCatalogEntry } from '../../types/project';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveSpriteSheetGenerationCandidate,
  buildSpriteSheetGenerationRequest,
  defaultSpriteSheetGenerationDraft,
  generateSpriteSheetCandidate,
  validateSpriteSheetGenerationCandidate,
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

describe('spriteSheetGenerationWorkflow', () => {
  it('builds a prompt-backed offline request with sprite sheet metadata and source concept links', () => {
    const draft = {
      ...defaultSpriteSheetGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'arc',
        ownerName: 'Arc',
        sourceConceptAsset,
        description: 'Reviewed hero concept for sprite production.',
      }),
      animationSetId: 'arc_idle',
      name: 'Arc Idle Sheet',
      action: 'idle',
      direction: 'down' as const,
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 4,
      promptInputs: {
        subject: 'Arc idle down horizontal sprite sheet',
        useCase: 'four-frame RPG Maker-style idle animation strip',
        palette: 'teal cloak, warm leather, muted iron',
        styleNotes: 'transparent background, strict 64px frame boundaries',
      },
    };

    const built = buildSpriteSheetGenerationRequest(draft, {
      requestId: 'sprite-gen-1',
      createdAt: '2026-06-02T22:00:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'sprite-gen-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-02T22:00:00.000Z',
      input: {
        ownerKind: 'actor',
        ownerId: 'arc',
        sourceConceptAssetId: 'arc_concept',
        animationSetId: 'arc_idle',
        action: 'idle',
        direction: 'down',
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 4,
        expectedWidth: 256,
        expectedHeight: 64,
        promptTemplateId: 'character-spritesheet-v1',
        transparentBackgroundRequired: true,
        frameLayout: 'horizontal-strip',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('character-spritesheet-v1');
    expect(built.request.prompt).toContain('Arc idle down horizontal sprite sheet');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending spritesheet asset and animation set that require review before project insertion', async () => {
    const candidate = await generateSpriteSheetCandidate(
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
        requestId: 'sprite-gen-arc',
        createdAt: '2026-06-02T22:01:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.asset).toMatchObject({
      id: 'arc_sprite_sheet',
      name: 'Arc Sprite Sheet',
      kind: 'spritesheet',
      source: 'generated',
      path: 'assets/generated/spritesheets/arc_sprite_sheet.png',
      width: 256,
      height: 64,
      frameWidth: 64,
      frameHeight: 64,
      frames: 4,
      tags: ['generated', 'spritesheet', 'character-spritesheet', 'actor', 'idle', 'down', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'character-spritesheet-v1',
        promptTemplateKind: 'spritesheet',
        providerId: 'local',
        modelId: 'offline-image-mock',
        operation: 'image.generate',
        ownerKind: 'actor',
        ownerId: 'arc',
        sourceAssetId: 'arc_concept',
        sourceAssetPath: 'assets/generated/concepts/arc_concept.png',
        spriteSheet: {
          frameWidth: 64,
          frameHeight: 64,
          frameCount: 4,
          action: 'idle',
          direction: 'down',
          frameLayout: 'horizontal-strip',
          transparentBackgroundRequired: true,
        },
      },
    });
    expect(candidate.animationSet).toMatchObject({
      id: 'arc_sprite',
      display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
      clips: [
        {
          action: 'idle',
          direction: 'down',
          asset: 'arc_sprite_sheet',
          frameSize: { width: 64, height: 64 },
          frameCount: 4,
          fps: 8,
          loop: true,
          anchor: { x: 32, y: 54 },
        },
      ],
    });
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/sprite-gen-arc.png',
      width: 256,
      height: 64,
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 4,
      frameLayout: 'horizontal-strip',
      transparentBackgroundRequired: true,
      providerFixture: 'offline-image',
    });
    expect(validateSpriteSheetGenerationCandidate(candidate)).toEqual([]);

    const approved = approveSpriteSheetGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T22:02:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.asset.tags).toEqual(expect.arrayContaining(['reviewed', 'character-spritesheet']));
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed sprite sheet candidate');
    expect(approved.animationSet.clips[0].asset).toBe(approved.asset.id);

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [approved.asset] });
    expect(normalized.assets[0]).toMatchObject({
      kind: 'spritesheet',
      frameWidth: 64,
      frameHeight: 64,
      frames: 4,
      generated: {
        promptTemplateId: 'character-spritesheet-v1',
        sourceAssetId: 'arc_concept',
      },
    });
  });

  it('rejects bad frame boundaries and missing transparency metadata before approval', async () => {
    const candidate = await generateSpriteSheetCandidate(
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
        requestId: 'sprite-gen-invalid',
        createdAt: '2026-06-02T22:03:00.000Z',
      },
    );
    const invalid = {
      ...candidate,
      asset: {
        ...candidate.asset,
        width: 250,
        generated: {
        ...candidate.asset.generated,
        spriteSheet: {
            ...candidate.asset.generated!.spriteSheet!,
            transparentBackgroundRequired: false,
          },
        },
      },
    };

    expect(validateSpriteSheetGenerationCandidate(invalid)).toEqual(expect.arrayContaining([
      'Generated sprite sheet width must equal frameWidth * frameCount.',
      'Generated sprite sheet manifest must require transparent-background review.',
    ]));
    expect(() => approveSpriteSheetGenerationCandidate(invalid, {
      reviewedAt: '2026-06-02T22:04:00.000Z',
    })).toThrow('Generated sprite sheet candidate is invalid');
  });
});
