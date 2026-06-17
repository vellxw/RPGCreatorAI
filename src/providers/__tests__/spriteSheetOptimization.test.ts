import { describe, expect, it, vi } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import { imagePromptTemplates } from '../imagePromptTemplates';
import {
  approveSpriteSheetGenerationCandidate,
  buildSpriteSheetGenerationRequest,
  defaultSpriteSheetGenerationDraft,
  generateSpriteSheetCandidate,
  validateSpriteSheetGenerationCandidate,
  validateSpriteSheetGenerationDraft,
} from '../spriteSheetGenerationWorkflow';

function baseDraft() {
  return defaultSpriteSheetGenerationDraft({
    ownerKind: 'actor',
    ownerId: 'arc',
    ownerName: 'Arc',
    description: 'Reviewed hero concept for sprite production.',
  });
}

describe('spriteSheetOptimization', () => {
  it('rejects drafts that are missing frameWidth, frameHeight, or frameCount', () => {
    const draft = baseDraft();
    const missingWidth = { ...draft, frameWidth: undefined as unknown as number };
    const missingHeight = { ...draft, frameHeight: undefined as unknown as number };
    const missingCount = { ...draft, frameCount: undefined as unknown as number };
    const zeroWidth = { ...draft, frameWidth: 0 };
    const negativeHeight = { ...draft, frameHeight: -32 };
    const fractional = { ...draft, frameCount: 4.5 };

    expect(validateSpriteSheetGenerationDraft(missingWidth).length).toBeGreaterThan(0);
    expect(validateSpriteSheetGenerationDraft(missingHeight).length).toBeGreaterThan(0);
    expect(validateSpriteSheetGenerationDraft(missingCount).length).toBeGreaterThan(0);
    expect(validateSpriteSheetGenerationDraft(zeroWidth).length).toBeGreaterThan(0);
    expect(validateSpriteSheetGenerationDraft(negativeHeight).length).toBeGreaterThan(0);
    expect(validateSpriteSheetGenerationDraft(fractional).length).toBeGreaterThan(0);
  });

  it('forces transparentBackgroundRequired: true and frameLayout: horizontal-strip on every built request', () => {
    const draft = baseDraft();
    const built = buildSpriteSheetGenerationRequest(draft, {
      requestId: 'sprite-m11-built',
      createdAt: '2026-06-02T22:30:00.000Z',
    });
    expect(built.frameLayout).toBe('horizontal-strip');
    expect(built.request.input).toMatchObject({
      transparentBackgroundRequired: true,
      frameLayout: 'horizontal-strip',
    });
  });

  it('default draft is a horizontal strip with 1024x1024 image size and 64x64 frame size', () => {
    const draft = baseDraft();
    expect(draft.frameWidth).toBe(64);
    expect(draft.frameHeight).toBe(64);
    expect(draft.frameCount).toBe(4);
    const built = buildSpriteSheetGenerationRequest(draft, {
      requestId: 'sprite-m11-defaults',
      createdAt: '2026-06-02T22:31:00.000Z',
    });
    expect(built.frameLayout).toBe('horizontal-strip');
    expect(built.expectedWidth).toBe(draft.frameWidth * draft.frameCount);
    expect(built.expectedHeight).toBe(draft.frameHeight);
    expect(built.request.input).toMatchObject({
      size: '1024x1024',
      outputFormat: 'png',
    });
  });

  it('mock round-trip produces an approved candidate with width === frameWidth * frameCount and height === frameHeight', async () => {
    const adapter = createMockProviderAdapter();
    const executeSpy = vi.spyOn(adapter, 'execute');
    const draft = baseDraft();
    const candidate = await generateSpriteSheetCandidate(
      adapter,
      [],
      [],
      draft,
      {
        requestId: 'sprite-m11-roundtrip',
        createdAt: '2026-06-02T22:32:00.000Z',
      },
    );
    expect(candidate.asset.width).toBe(draft.frameWidth * draft.frameCount);
    expect(candidate.asset.height).toBe(draft.frameHeight);
    expect(candidate.asset.frameWidth).toBe(draft.frameWidth);
    expect(candidate.asset.frameHeight).toBe(draft.frameHeight);
    expect(candidate.asset.frames).toBe(draft.frameCount);
    expect(validateSpriteSheetGenerationCandidate(candidate)).toEqual([]);
    const approved = approveSpriteSheetGenerationCandidate(candidate, {
      reviewedAt: '2026-06-02T22:33:00.000Z',
    });
    expect(approved.asset.width).toBe(draft.frameWidth * draft.frameCount);
    expect(approved.asset.height).toBe(draft.frameHeight);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('uses character-spritesheet-v1 as the only sprite sheet prompt template', () => {
    const spritesheetTemplates = imagePromptTemplates.filter(t => t.kind === 'spritesheet');
    expect(spritesheetTemplates).toHaveLength(1);
    expect(spritesheetTemplates[0].id).toBe('character-spritesheet-v1');

    const draft = baseDraft();
    const built = buildSpriteSheetGenerationRequest(draft, {
      requestId: 'sprite-m11-template',
      createdAt: '2026-06-02T22:34:00.000Z',
    });
    expect(built.request.input).toMatchObject({ promptTemplateId: 'character-spritesheet-v1' });
  });

  it('never reaches a live provider: every adapter call goes through the offline mock', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    const adapter = createMockProviderAdapter();
    const executeSpy = vi.spyOn(adapter, 'execute');
    const draft = baseDraft();
    await generateSpriteSheetCandidate(adapter, [], [], draft, {
      requestId: 'sprite-m11-no-live',
      createdAt: '2026-06-02T22:35:00.000Z',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledTimes(1);
    const request = executeSpy.mock.calls[0][0];
    expect(request.providerId).toBe('local');
    expect(request.modelId).toBe('offline-image-mock');
    expect(JSON.stringify(request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
    fetchSpy.mockRestore();
  });
});
