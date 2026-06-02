import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveCharacterConceptGenerationCandidate,
  buildCharacterConceptGenerationRequest,
  defaultCharacterConceptGenerationDraft,
  generateCharacterConceptCandidate,
  validateCharacterConceptGenerationCandidate,
} from '../characterConceptGenerationWorkflow';

describe('characterConceptGenerationWorkflow', () => {
  it('builds a prompt-backed offline image generation request from actor context', () => {
    const draft = {
      ...defaultCharacterConceptGenerationDraft({
        ownerKind: 'actor',
        ownerId: 'arc',
        ownerName: 'Arc',
        description: 'Level 4 hero with teal cloak and village guard background.',
      }),
      promptInputs: {
        subject: 'Arc full-body character concept with teal cloak',
        useCase: 'concept sheet to seed portraits and sprite direction',
        palette: 'teal cloth, warm leather, muted iron',
        styleNotes: 'original RPGCreatorAI character concept, no franchise copying',
      },
    };

    const built = buildCharacterConceptGenerationRequest(draft, {
      requestId: 'concept-gen-1',
      createdAt: '2026-06-02T21:00:00.000Z',
    });

    expect(built.request).toMatchObject({
      id: 'concept-gen-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      input: {
        ownerKind: 'actor',
        ownerId: 'arc',
        expectedWidth: 1024,
        expectedHeight: 1536,
        promptTemplateId: 'character-concept-v1',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('character-concept-v1');
    expect(built.request.prompt).toContain('Arc full-body character concept');
    expect(built.request.prompt).toContain('original RPGCreatorAI asset');
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending character concept candidate and requires review before assignment', async () => {
    const candidate = await generateCharacterConceptCandidate(
      createMockProviderAdapter(),
      [],
      defaultCharacterConceptGenerationDraft({
        ownerKind: 'event',
        ownerId: 'old_man',
        ownerName: 'Old Man',
        description: 'Village elder NPC for dialogue and sprite planning.',
      }),
      {
        requestId: 'concept-gen-old-man',
        createdAt: '2026-06-02T21:01:00.000Z',
      },
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.asset).toMatchObject({
      id: 'old_man_concept',
      name: 'Old Man Concept',
      kind: 'image',
      source: 'generated',
      path: 'assets/generated/concepts/old_man_concept.png',
      tags: ['generated', 'character-concept', 'event', 'ai-draft', 'pending-review'],
      generated: {
        promptTemplateId: 'character-concept-v1',
        promptTemplateKind: 'concept',
        providerId: 'local',
        modelId: 'offline-image-mock',
        operation: 'image.generate',
      },
    });
    expect(candidate.qaPreview).toMatchObject({
      assetRef: 'mock://generated/concept-gen-old-man.png',
      width: 1024,
      height: 1536,
      providerFixture: 'offline-image',
    });
    expect(validateCharacterConceptGenerationCandidate(candidate)).toEqual([]);

    const approved = approveCharacterConceptGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T21:02:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.conceptAssetId).toBe('old_man_concept');
    expect(approved.asset.tags).toEqual(expect.arrayContaining(['reviewed', 'character-concept']));
    expect(approved.asset.tags).not.toContain('pending-review');
    expect(approved.asset.notes).toContain('Reviewed character concept candidate');

    const normalized = normalizeAssetCatalog({ schemaVersion: 1, assets: [approved.asset] });
    expect(normalized.assets[0].generated).toMatchObject({
      promptTemplateId: 'character-concept-v1',
      operation: 'image.generate',
      ownerKind: 'event',
      ownerId: 'old_man',
    });
  });
});
