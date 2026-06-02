import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveItemIconGenerationCandidate,
  buildItemIconGenerationRequest,
  defaultItemIconGenerationDraft,
  generateItemIconCandidate,
  validateItemIconGenerationCandidate,
} from '../itemIconGenerationWorkflow';

describe('itemIconGenerationWorkflow', () => {
  it('builds a prompt-backed offline image generation request for item icons', () => {
    const draft = {
      ...defaultItemIconGenerationDraft({
        ownerKind: 'item',
        ownerId: 'ether_crystal',
        ownerName: 'Ether Crystal',
        description: 'Restores MP',
        category: 'consumable',
      }),
      promptInputs: {
        subject: 'ether crystal inventory icon',
        useCase: 'inventory icon for a consumable item',
        palette: 'cyan crystal, silver rim, high contrast transparent edge',
        styleNotes: 'copy in the style of Famous Studio',
      },
    };

    const built = buildItemIconGenerationRequest(draft, {
      requestId: 'icon-gen-1',
      createdAt: '2026-06-02T18:45:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'icon-gen-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-02T18:45:00.000Z',
      input: {
        ownerKind: 'item',
        ownerId: 'ether_crystal',
        expectedWidth: 1024,
        expectedHeight: 1024,
        outputFormat: 'png',
        quality: 'low',
        promptTemplateId: 'icon-item-v1',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('icon-item-v1');
    expect(built.request.prompt).toContain('ether crystal inventory icon');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(built.request.prompt).not.toMatch(/Famous Studio|copy in the style of/i);
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending catalog icon candidate through the mock provider', async () => {
    const candidate = await generateItemIconCandidate(
      createMockProviderAdapter(),
      [],
      defaultItemIconGenerationDraft({
        ownerKind: 'weapon',
        ownerId: 'iron_sword',
        ownerName: 'Iron Sword',
        description: 'Reliable starter blade',
        category: 'sword',
      }),
      {
        requestId: 'icon-gen-sword',
        createdAt: '2026-06-02T18:46:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.owner).toEqual({
      kind: 'weapon',
      id: 'iron_sword',
      name: 'Iron Sword',
    });
    expect(candidate.asset).toMatchObject({
      id: 'iron_sword_icon',
      name: 'Iron Sword Icon',
      kind: 'image',
      source: 'generated',
      path: 'assets/generated/icons/iron_sword_icon.png',
      width: 1024,
      height: 1024,
      tags: ['generated', 'item-icon', 'weapon', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'icon-item-v1',
        promptTemplateKind: 'icon',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    });
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/icon-gen-sword.png',
      width: 1024,
      height: 1024,
      providerFixture: 'offline-image',
    });
    expect(validateItemIconGenerationCandidate(candidate)).toEqual([]);
  });

  it('requires explicit review before returning an assignable icon asset id', async () => {
    const candidate = await generateItemIconCandidate(
      createMockProviderAdapter(),
      [],
      defaultItemIconGenerationDraft({
        ownerKind: 'armor',
        ownerId: 'leather_armor',
        ownerName: 'Leather Armor',
        description: 'Light body armor',
        category: 'light',
      }),
      {
        requestId: 'icon-gen-armor',
        createdAt: '2026-06-02T18:47:00.000Z',
      },
    );

    const approved = approveItemIconGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T18:48:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.iconAssetId).toBe('leather_armor_icon');
    expect(approved.asset.tags).toContain('reviewed');
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed for database icon use');

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [approved.asset] });
    expect(normalized.assets[0].generated).toMatchObject({
      promptTemplateId: 'icon-item-v1',
      modelId: 'offline-image-mock',
    });
  });

  it('rejects invalid icon dimensions and missing provenance before approval', async () => {
    const candidate = await generateItemIconCandidate(
      createMockProviderAdapter(),
      [],
      defaultItemIconGenerationDraft({
        ownerKind: 'item',
        ownerId: 'potion',
        ownerName: 'Potion',
        description: 'Heals HP',
        category: 'consumable',
      }),
      {
        requestId: 'icon-gen-invalid',
        createdAt: '2026-06-02T18:49:00.000Z',
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

    expect(validateItemIconGenerationCandidate(invalid)).toEqual(expect.arrayContaining([
      'Generated item icon asset must keep prompt provenance.',
      'Generated item icon dimensions must match the QA preview.',
    ]));
    expect(() => approveItemIconGenerationCandidate(invalid, {
      reviewedAt: '2026-06-02T18:50:00.000Z',
    })).toThrow('Generated item icon candidate is invalid');
  });
});
