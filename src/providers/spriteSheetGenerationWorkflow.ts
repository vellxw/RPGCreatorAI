import type {
  AnimationSetData,
  AssetCatalogEntry,
  Direction,
  ProviderImageGenerationSettings,
} from '../types/project';
import { createMockProviderAdapter } from './mockProviderAdapter';
import type { ProviderAdapter, ProviderAdapterRequest } from './providerAdapter';
import { normalizeImageGenerationSettings } from './providerImageGenerationSettings';
import {
  buildImagePromptProvenance,
  renderImagePromptTemplate,
  type RenderedImagePrompt,
} from './imagePromptTemplates';

export type SpriteSheetOwnerKind = 'actor' | 'event' | 'animation';
export type SpriteSheetFrameLayout = 'horizontal-strip';

export interface SpriteSheetOwner {
  kind: SpriteSheetOwnerKind;
  id: string;
  name: string;
}

export interface SpriteSheetGenerationPromptInputs {
  subject: string;
  useCase: string;
  palette: string;
  styleNotes: string;
}

export interface SpriteSheetGenerationDraft {
  owner: SpriteSheetOwner;
  sourceConceptAsset?: AssetCatalogEntry;
  referenceAssets: AssetCatalogEntry[];
  animationSetId: string;
  name: string;
  action: string;
  direction: Direction | 'any';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  anchorX: number;
  anchorY: number;
  displayHeightTiles: number;
  displayWidthTiles: number;
  displayYOffsetPx: number;
  promptInputs: SpriteSheetGenerationPromptInputs;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface DefaultSpriteSheetGenerationDraftOptions {
  ownerKind: SpriteSheetOwnerKind;
  ownerId: string;
  ownerName: string;
  sourceConceptAsset?: AssetCatalogEntry;
  referenceAssets?: AssetCatalogEntry[];
  description?: string;
}

export interface SpriteSheetGenerationRequestOptions {
  requestId?: string;
  createdAt?: string;
  providerId?: string;
  modelId?: string;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface BuiltSpriteSheetGenerationRequest {
  request: ProviderAdapterRequest;
  renderedPrompt: RenderedImagePrompt;
  expectedWidth: number;
  expectedHeight: number;
  frameLayout: SpriteSheetFrameLayout;
  imageSettings: ProviderImageGenerationSettings;
}

export interface SpriteSheetGenerationQaPreview {
  assetRef: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameLayout: SpriteSheetFrameLayout;
  transparentBackgroundRequired: boolean;
  providerFixture?: string;
}

export interface SpriteSheetGenerationCandidate {
  id: string;
  reviewState: 'pending';
  owner: SpriteSheetOwner;
  sourceConceptAsset?: AssetCatalogEntry;
  referenceAssets: AssetCatalogEntry[];
  asset: AssetCatalogEntry;
  animationSet: AnimationSetData;
  qaPreview: SpriteSheetGenerationQaPreview;
}

export interface ApprovedSpriteSheetGeneration {
  id: string;
  reviewState: 'approved';
  reviewedAt: string;
  owner: SpriteSheetOwner;
  sourceConceptAsset?: AssetCatalogEntry;
  referenceAssets: AssetCatalogEntry[];
  asset: AssetCatalogEntry;
  animationSet: AnimationSetData;
  qaPreview: SpriteSheetGenerationQaPreview;
}

export interface SpriteSheetGenerationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  candidate?: SpriteSheetGenerationCandidate;
}

export type SpriteSheetGenerationRunner = (
  existingAssetIds: string[],
  existingAnimationSetIds: string[],
  draft: SpriteSheetGenerationDraft,
) => Promise<SpriteSheetGenerationResult>;

const VALID_DIRECTIONS = new Set<Direction | 'any'>(['down', 'left', 'right', 'up', 'any']);

function uniqueId(existingIds: Iterable<string>, base: string): string {
  const existing = new Set(existingIds);
  let id = base;
  let i = 1;
  while (existing.has(id)) {
    i += 1;
    id = `${base}_${i}`;
  }
  return id;
}

function slugId(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
}

function extForFormat(format: ProviderImageGenerationSettings['outputFormat']): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function ownerLabel(owner: SpriteSheetOwner): string {
  if (owner.kind === 'actor') return `actor "${owner.name}"`;
  if (owner.kind === 'event') return `event "${owner.name}"`;
  return `animation set "${owner.name}"`;
}

function sourceConceptNotes(sourceConceptAsset?: AssetCatalogEntry): string {
  if (!sourceConceptAsset) return 'No source concept selected; generate an original RPGCreatorAI character sprite direction.';
  return `Use reviewed concept ${sourceConceptAsset.name} (${sourceConceptAsset.id}) as source direction without copying external references.`;
}

export function defaultSpriteSheetGenerationDraft(
  options: DefaultSpriteSheetGenerationDraftOptions,
): SpriteSheetGenerationDraft {
  const name = options.ownerName.trim() || options.ownerId;
  const baseId = slugId(name, 'character');
  return {
    owner: {
      kind: options.ownerKind,
      id: options.ownerId,
      name,
    },
    sourceConceptAsset: options.sourceConceptAsset ? clone(options.sourceConceptAsset) : undefined,
    referenceAssets: (options.referenceAssets ?? []).map(clone),
    animationSetId: `${baseId}_sprite`,
    name: `${name} Sprite Sheet`,
    action: 'idle',
    direction: 'down',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 4,
    fps: 8,
    loop: true,
    anchorX: 32,
    anchorY: 54,
    displayHeightTiles: 1.5,
    displayWidthTiles: 1,
    displayYOffsetPx: 0,
    promptInputs: {
      subject: `${name} idle down horizontal sprite sheet`,
      useCase: `reviewable character sprite sheet for ${ownerLabel({ kind: options.ownerKind, id: options.ownerId, name })} that can enter the animation database after QA`,
      palette: 'transparent background, readable costume colors, consistent silhouette accents',
      styleNotes: [
        options.description?.trim(),
        sourceConceptNotes(options.sourceConceptAsset),
        'single horizontal strip; strict 64px frame boundaries; bottom-center feet anchor',
      ].filter(Boolean).join('; '),
    },
  };
}

export function validateSpriteSheetGenerationDraft(draft: SpriteSheetGenerationDraft): string[] {
  const errors: string[] = [];
  if (!draft.owner.id.trim()) errors.push('Sprite sheet owner ID is required.');
  if (!draft.owner.name.trim()) errors.push('Sprite sheet owner name is required.');
  if (!['actor', 'event', 'animation'].includes(draft.owner.kind)) {
    errors.push('Sprite sheet owner kind must be actor, event, or animation.');
  }
  if (!draft.animationSetId.trim()) errors.push('Sprite sheet animation set ID is required.');
  if (!draft.name.trim()) errors.push('Sprite sheet name is required.');
  if (!draft.action.trim()) errors.push('Sprite sheet action is required.');
  if (!VALID_DIRECTIONS.has(draft.direction)) errors.push(`Sprite sheet direction "${draft.direction}" is invalid.`);
  if (!Number.isInteger(draft.frameWidth) || draft.frameWidth <= 0) errors.push('Sprite sheet frame width must be a positive integer.');
  if (!Number.isInteger(draft.frameHeight) || draft.frameHeight <= 0) errors.push('Sprite sheet frame height must be a positive integer.');
  if (!Number.isInteger(draft.frameCount) || draft.frameCount <= 0) errors.push('Sprite sheet frame count must be a positive integer.');
  if (!Number.isFinite(draft.fps) || draft.fps <= 0) errors.push('Sprite sheet FPS must be a positive finite number.');
  if (!Number.isFinite(draft.anchorX) || draft.anchorX < 0 || draft.anchorX > draft.frameWidth) {
    errors.push('Sprite sheet anchor X must sit inside the frame.');
  }
  if (!Number.isFinite(draft.anchorY) || draft.anchorY < 0 || draft.anchorY > draft.frameHeight) {
    errors.push('Sprite sheet anchor Y must sit inside the frame.');
  }
  if (!Number.isFinite(draft.displayHeightTiles) || draft.displayHeightTiles <= 0) {
    errors.push('Sprite sheet display height tiles must be positive.');
  }
  if (!Number.isFinite(draft.displayWidthTiles) || draft.displayWidthTiles <= 0) {
    errors.push('Sprite sheet display width tiles must be positive.');
  }
  if (!Number.isFinite(draft.displayYOffsetPx)) errors.push('Sprite sheet display Y offset must be finite.');
  if (draft.sourceConceptAsset && (!draft.sourceConceptAsset.id.trim() || !draft.sourceConceptAsset.path.trim())) {
    errors.push('Sprite sheet source concept asset must have an ID and path.');
  }
  for (const key of ['subject', 'useCase', 'palette', 'styleNotes'] as const) {
    if (!draft.promptInputs[key].trim()) {
      errors.push(`Sprite sheet generation ${key} is required.`);
    }
  }
  return errors;
}

export function buildSpriteSheetGenerationRequest(
  draft: SpriteSheetGenerationDraft,
  options: SpriteSheetGenerationRequestOptions = {},
): BuiltSpriteSheetGenerationRequest {
  const errors = validateSpriteSheetGenerationDraft(draft);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  const providerId = options.providerId ?? 'local';
  const modelId = options.modelId ?? 'offline-image-mock';
  const imageSettings = normalizeImageGenerationSettings({
    modelId,
    quality: 'low',
    size: '1024x1024',
    style: 'pixel-art',
    outputFormat: 'png',
    background: 'auto',
    ...(draft.imageSettings ?? {}),
    ...(options.imageSettings ?? {}),
  });
  const expectedWidth = draft.frameWidth * draft.frameCount;
  const expectedHeight = draft.frameHeight;
  const frameLayout: SpriteSheetFrameLayout = 'horizontal-strip';
  const renderedPrompt = renderImagePromptTemplate('character-spritesheet-v1', { ...draft.promptInputs }, {
    imageSettings,
  });
  const referenceAssetIds = draft.referenceAssets.map(asset => asset.id);

  return {
    request: {
      id: options.requestId ?? `sprite-gen-${Date.now()}`,
      operation: 'image.generate',
      providerId,
      modelId,
      createdAt: options.createdAt ?? new Date().toISOString(),
      prompt: renderedPrompt.prompt,
      input: {
        ownerKind: draft.owner.kind,
        ownerId: draft.owner.id,
        ownerName: draft.owner.name,
        sourceConceptAssetId: draft.sourceConceptAsset?.id,
        sourceConceptAssetPath: draft.sourceConceptAsset?.path,
        referenceAssetIds,
        animationSetId: draft.animationSetId,
        action: draft.action,
        direction: draft.direction,
        frameWidth: draft.frameWidth,
        frameHeight: draft.frameHeight,
        frameCount: draft.frameCount,
        fps: draft.fps,
        anchorX: draft.anchorX,
        anchorY: draft.anchorY,
        expectedWidth,
        expectedHeight,
        outputFormat: imageSettings.outputFormat,
        quality: imageSettings.quality,
        size: imageSettings.size,
        background: imageSettings.background,
        moderation: imageSettings.moderation,
        styleGuidance: imageSettings.style,
        promptTemplateId: renderedPrompt.templateId,
        promptTemplateVersion: renderedPrompt.templateVersion,
        transparentBackgroundRequired: true,
        frameLayout,
        reviewRequired: true,
      },
    },
    renderedPrompt,
    expectedWidth,
    expectedHeight,
    frameLayout,
    imageSettings,
  };
}

function buildAnimationSet(id: string, assetId: string, draft: SpriteSheetGenerationDraft): AnimationSetData {
  return {
    id,
    display: {
      heightTiles: draft.displayHeightTiles,
      widthTiles: draft.displayWidthTiles,
      yOffsetPx: draft.displayYOffsetPx,
    },
    clips: [
      {
        action: draft.action.trim(),
        direction: draft.direction,
        asset: assetId,
        frameSize: {
          width: draft.frameWidth,
          height: draft.frameHeight,
        },
        frameCount: draft.frameCount,
        fps: draft.fps,
        loop: draft.loop,
        anchor: {
          x: draft.anchorX,
          y: draft.anchorY,
        },
      },
    ],
  };
}

export async function generateSpriteSheetCandidate(
  adapter: ProviderAdapter,
  existingAssetIds: string[],
  existingAnimationSetIds: string[],
  draft: SpriteSheetGenerationDraft,
  options: SpriteSheetGenerationRequestOptions = {},
): Promise<SpriteSheetGenerationCandidate> {
  const built = buildSpriteSheetGenerationRequest(draft, options);
  const response = await adapter.execute(built.request);
  if (response.status === 'cancelled') {
    throw new Error('Sprite sheet generation was cancelled.');
  }
  if (response.status !== 'succeeded') {
    throw new Error(response.failure?.message ?? response.error ?? 'Sprite sheet generation failed.');
  }
  const assetRef = response.output?.assetRefs?.[0];
  if (!assetRef) {
    throw new Error('Sprite sheet generation did not return an image asset reference.');
  }

  const assetId = uniqueId(existingAssetIds, slugId(draft.name, 'generated_sprite_sheet'));
  const animationSetId = uniqueId(existingAnimationSetIds, slugId(draft.animationSetId, `${assetId}_set`));
  const providerFixture = typeof response.output?.data?.fixture === 'string'
    ? response.output.data.fixture
    : undefined;
  const createdAt = built.request.createdAt;
  const generated = buildImagePromptProvenance(built.renderedPrompt, {
    providerId: built.request.providerId,
    modelId: built.request.modelId ?? built.imageSettings.modelId,
    createdAt,
  });
  const outputFormat = built.imageSettings.outputFormat;
  const referenceAssetIds = draft.referenceAssets.map(asset => asset.id);
  const asset: AssetCatalogEntry = {
    id: assetId,
    name: draft.name.trim(),
    kind: 'spritesheet',
    path: `assets/generated/spritesheets/${assetId}.${extForFormat(outputFormat)}`,
    source: 'generated',
    tags: uniqueTags([
      'generated',
      'spritesheet',
      'character-spritesheet',
      draft.owner.kind,
      draft.action,
      draft.direction,
      'ai-draft',
      'pending-review',
    ]),
    provenance: 'Generated through the offline character sprite sheet workflow; requires review before animation database insertion.',
    runtimeCompatible: false,
    runtimeNotes: 'Generated sprite sheet metadata is editor-owned until reviewed with frame and visual QA.',
    width: built.expectedWidth,
    height: built.expectedHeight,
    frameWidth: draft.frameWidth,
    frameHeight: draft.frameHeight,
    frames: draft.frameCount,
    generated: {
      ...generated,
      tool: 'ai-sprite-sheet-generation-workflow',
      operation: built.request.operation,
      ownerKind: draft.owner.kind,
      ownerId: draft.owner.id,
      ownerName: draft.owner.name,
      sourceAssetId: draft.sourceConceptAsset?.id,
      sourceAssetPath: draft.sourceConceptAsset?.path,
      referenceAssetIds,
      spriteSheet: {
        frameWidth: draft.frameWidth,
        frameHeight: draft.frameHeight,
        frameCount: draft.frameCount,
        action: draft.action,
        direction: draft.direction,
        frameLayout: built.frameLayout,
        transparentBackgroundRequired: true,
        animationSetId,
        fps: draft.fps,
        anchor: { x: draft.anchorX, y: draft.anchorY },
      },
    },
  };
  const animationSet = buildAnimationSet(animationSetId, assetId, draft);

  return {
    id: built.request.id,
    reviewState: 'pending',
    owner: clone(draft.owner),
    sourceConceptAsset: draft.sourceConceptAsset ? clone(draft.sourceConceptAsset) : undefined,
    referenceAssets: draft.referenceAssets.map(clone),
    asset,
    animationSet,
    qaPreview: {
      assetRef,
      width: built.expectedWidth,
      height: built.expectedHeight,
      frameWidth: draft.frameWidth,
      frameHeight: draft.frameHeight,
      frameCount: draft.frameCount,
      frameLayout: built.frameLayout,
      transparentBackgroundRequired: true,
      providerFixture,
    },
  };
}

export const generateSpriteSheetDraft: SpriteSheetGenerationRunner = async (
  existingAssetIds,
  existingAnimationSetIds,
  draft,
) => {
  try {
    return {
      success: true,
      candidate: await generateSpriteSheetCandidate(
        createMockProviderAdapter(),
        existingAssetIds,
        existingAnimationSetIds,
        draft,
      ),
    };
  } catch (error) {
    return {
      success: false,
      cancelled: (error as Error).message.toLowerCase().includes('cancelled'),
      error: (error as Error).message,
    };
  }
};

export function validateSpriteSheetGenerationCandidate(candidate: SpriteSheetGenerationCandidate): string[] {
  const errors: string[] = [];
  const { asset, animationSet, qaPreview } = candidate;
  const manifest = asset.generated?.spriteSheet;
  if (candidate.reviewState !== 'pending') errors.push('Generated sprite sheet candidate must be pending review.');
  if (asset.kind !== 'spritesheet') errors.push('Generated sprite sheet asset must use kind "spritesheet".');
  if (asset.source !== 'generated') errors.push('Generated sprite sheet asset must use source "generated".');
  if (asset.generated?.promptTemplateId !== 'character-spritesheet-v1') {
    errors.push('Generated sprite sheet asset must keep sprite sheet prompt provenance.');
  }
  if (asset.generated?.operation !== 'image.generate') {
    errors.push('Generated sprite sheet asset must record the image.generate operation.');
  }
  if (!manifest) {
    errors.push('Generated sprite sheet manifest is required.');
  } else {
    if (manifest.frameLayout !== 'horizontal-strip') {
      errors.push('Generated sprite sheet manifest must use horizontal-strip frame layout.');
    }
    if (manifest.transparentBackgroundRequired !== true) {
      errors.push('Generated sprite sheet manifest must require transparent-background review.');
    }
    if (manifest.frameWidth !== qaPreview.frameWidth || asset.frameWidth !== qaPreview.frameWidth) {
      errors.push('Generated sprite sheet frame width must match the QA preview.');
    }
    if (manifest.frameHeight !== qaPreview.frameHeight || asset.frameHeight !== qaPreview.frameHeight) {
      errors.push('Generated sprite sheet frame height must match the QA preview.');
    }
    if (manifest.frameCount !== qaPreview.frameCount || asset.frames !== qaPreview.frameCount) {
      errors.push('Generated sprite sheet frame count must match the QA preview.');
    }
  }
  if (asset.width !== qaPreview.frameWidth * qaPreview.frameCount) {
    errors.push('Generated sprite sheet width must equal frameWidth * frameCount.');
  }
  if (asset.height !== qaPreview.frameHeight) {
    errors.push('Generated sprite sheet height must equal frameHeight.');
  }
  if (asset.width !== qaPreview.width || asset.height !== qaPreview.height) {
    errors.push('Generated sprite sheet dimensions must match the QA preview.');
  }
  const clip = animationSet.clips[0];
  if (!animationSet.id.trim()) errors.push('Generated sprite sheet animation set ID is required.');
  if (!clip) {
    errors.push('Generated sprite sheet animation set must include a clip.');
  } else {
    if (clip.asset !== asset.id) errors.push(`Generated sprite sheet clip must reference generated asset "${asset.id}".`);
    if (clip.frameSize.width !== qaPreview.frameWidth) errors.push('Generated sprite sheet clip frame width must match preview metadata.');
    if (clip.frameSize.height !== qaPreview.frameHeight) errors.push('Generated sprite sheet clip frame height must match preview metadata.');
    if (clip.frameCount !== qaPreview.frameCount) errors.push('Generated sprite sheet clip frame count must match preview metadata.');
    if (!Number.isFinite(clip.fps) || clip.fps <= 0) errors.push('Generated sprite sheet clip FPS must be positive.');
    if (!Number.isFinite(clip.anchor.x) || clip.anchor.x < 0 || clip.anchor.x > qaPreview.frameWidth) {
      errors.push('Generated sprite sheet clip anchor X must sit inside the frame.');
    }
    if (!Number.isFinite(clip.anchor.y) || clip.anchor.y < 0 || clip.anchor.y > qaPreview.frameHeight) {
      errors.push('Generated sprite sheet clip anchor Y must sit inside the frame.');
    }
  }
  if (candidate.sourceConceptAsset) {
    if (asset.generated?.sourceAssetId !== candidate.sourceConceptAsset.id) {
      errors.push('Generated sprite sheet manifest must keep the source concept asset id.');
    }
    if (asset.generated?.sourceAssetPath !== candidate.sourceConceptAsset.path) {
      errors.push('Generated sprite sheet manifest must keep the source concept asset path.');
    }
  }
  return errors;
}

export function approveSpriteSheetGenerationCandidate(
  candidate: SpriteSheetGenerationCandidate,
  options: { reviewedAt: string },
): ApprovedSpriteSheetGeneration {
  const errors = validateSpriteSheetGenerationCandidate(candidate);
  if (errors.length > 0) {
    throw new Error(`Generated sprite sheet candidate is invalid: ${errors.join(' ')}`);
  }
  const asset = clone(candidate.asset);
  return {
    id: candidate.id,
    reviewState: 'approved',
    reviewedAt: options.reviewedAt,
    owner: clone(candidate.owner),
    sourceConceptAsset: candidate.sourceConceptAsset ? clone(candidate.sourceConceptAsset) : undefined,
    referenceAssets: candidate.referenceAssets.map(clone),
    qaPreview: clone(candidate.qaPreview),
    animationSet: clone(candidate.animationSet),
    asset: {
      ...asset,
      tags: uniqueTags([...(asset.tags ?? []).filter(tag => tag !== 'pending-review'), 'reviewed']),
      notes: [
        asset.notes,
        `Reviewed sprite sheet candidate at ${options.reviewedAt}.`,
      ].filter(Boolean).join('\n'),
    },
  };
}
