import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approvePortraitGenerationCandidate,
  buildPortraitGenerationRequest,
  defaultPortraitGenerationDraft,
  generatePortraitCandidate,
  validatePortraitGenerationCandidate,
} from '../portraitGenerationWorkflow';

describe('portraitGenerationWorkflow', () => {
  it('builds a prompt-backed offline image generation request for portraits', () => {
    const draft = {
      ...defaultPortraitGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'arc',
        ownerName: 'Arc',
        description: 'Level 1 hero actor',
      }),
      promptInputs: {
        subject: 'young hero portrait with travel cloak',
        useCase: 'dialogue portrait candidate for a playable actor',
        palette: 'warm skin tones, teal cloak, readable face contrast',
        styleNotes: 'in the style of Famous Portrait Studio',
      },
    };

    const built = buildPortraitGenerationRequest(draft, {
      requestId: 'portrait-gen-1',
      createdAt: '2026-06-02T19:20:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'portrait-gen-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-02T19:20:00.000Z',
      input: {
        ownerKind: 'actor',
        ownerId: 'arc',
        expectedWidth: 1024,
        expectedHeight: 1536,
        outputFormat: 'png',
        quality: 'low',
        promptTemplateId: 'portrait-character-v1',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('portrait-character-v1');
    expect(built.request.prompt).toContain('young hero portrait with travel cloak');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(built.request.prompt).not.toMatch(/Famous Portrait Studio|in the style of/i);
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending portrait asset candidate through the mock provider', async () => {
    const candidate = await generatePortraitCandidate(
      createMockProviderAdapter(),
      [],
      defaultPortraitGenerationDraft({
        ownerKind: 'event',
        ownerId: 'npc_1',
        ownerName: 'Old Man',
        description: 'Wise village elder NPC',
      }),
      {
        requestId: 'portrait-gen-npc',
        createdAt: '2026-06-02T19:21:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.owner).toEqual({
      kind: 'event',
      id: 'npc_1',
      name: 'Old Man',
    });
    expect(candidate.asset).toMatchObject({
      id: 'old_man_portrait',
      name: 'Old Man Portrait',
      kind: 'image',
      source: 'generated',
      path: 'assets/generated/portraits/old_man_portrait.png',
      width: 1024,
      height: 1536,
      tags: ['generated', 'portrait', 'event', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'portrait-character-v1',
        promptTemplateKind: 'portrait',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    });
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/portrait-gen-npc.png',
      width: 1024,
      height: 1536,
      providerFixture: 'offline-image',
    });
    expect(validatePortraitGenerationCandidate(candidate)).toEqual([]);
  });

  it('requires explicit review before returning an assignable portrait asset id', async () => {
    const candidate = await generatePortraitCandidate(
      createMockProviderAdapter(),
      [],
      defaultPortraitGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'arc',
        ownerName: 'Arc',
        description: 'Playable hero',
      }),
      {
        requestId: 'portrait-gen-actor',
        createdAt: '2026-06-02T19:22:00.000Z',
      },
    );

    const approved = approvePortraitGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T19:23:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.portraitAssetId).toBe('arc_portrait');
    expect(approved.asset.tags).toContain('reviewed');
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed for character portrait use');

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [approved.asset] });
    expect(normalized.assets[0].generated).toMatchObject({
      promptTemplateId: 'portrait-character-v1',
      modelId: 'offline-image-mock',
    });
  });

  it('rejects invalid portrait dimensions and missing provenance before approval', async () => {
    const candidate = await generatePortraitCandidate(
      createMockProviderAdapter(),
      [],
      defaultPortraitGenerationDraft({
        ownerKind: 'event',
        ownerId: 'npc_1',
        ownerName: 'Old Man',
        description: 'Village elder',
      }),
      {
        requestId: 'portrait-gen-invalid',
        createdAt: '2026-06-02T19:24:00.000Z',
      },
    );
    const invalid = {
      ...candidate,
      asset: {
        ...candidate.asset,
        height: 512,
        generated: undefined,
      },
    };

    expect(validatePortraitGenerationCandidate(invalid)).toEqual(expect.arrayContaining([
      'Generated portrait asset must keep prompt provenance.',
      'Generated portrait dimensions must match the QA preview.',
    ]));
    expect(() => approvePortraitGenerationCandidate(invalid, {
      reviewedAt: '2026-06-02T19:25:00.000Z',
    })).toThrow('Generated portrait candidate is invalid');
  });
});
