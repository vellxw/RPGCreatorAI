import type {
  AssetCatalogEntry,
  ProviderImageGenerationSettings,
  ProviderImageSize,
} from '../types/project';
import {
  defaultModelCapabilityRegistry,
  getModelCapabilityDescriptor,
  modelSupportsCapability,
  type ModelCapabilityDescriptor,
} from './modelCapabilityRegistry';
import { createMockProviderAdapter } from './mockProviderAdapter';
import type { ProviderAdapter, ProviderAdapterRequest } from './providerAdapter';
import {
  buildImagePromptProvenance,
  renderImagePromptTemplate,
  type RenderedImagePrompt,
} from './imagePromptTemplates';
import {
  normalizeImageGenerationSettings,
  openAiImageGenerationOptions,
} from './providerImageGenerationSettings';

export type ImageEditVariationMode = 'edit' | 'variation';

export interface ImageEditVariationPromptInputs {
  instruction: string;
  useCase: string;
  preserve: string;
  maskNotes: string;
}

export interface ImageEditVariationDraft {
  mode: ImageEditVariationMode;
  sourceAsset: AssetCatalogEntry;
  maskAssetId?: string;
  referenceAssetIds: string[];
  promptInputs: ImageEditVariationPromptInputs;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface DefaultImageEditVariationDraftOptions {
  mode?: ImageEditVariationMode;
  maskAssetId?: string;
  referenceAssetIds?: string[];
}

export interface ImageEditVariationRequestOptions {
  requestId?: string;
  createdAt?: string;
  providerId?: string;
  modelId?: string;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface BuiltImageEditVariationRequest {
  request: ProviderAdapterRequest;
  renderedPrompt: RenderedImagePrompt;
  expectedWidth: number;
  expectedHeight: number;
  imageSettings: ProviderImageGenerationSettings;
}

export interface ImageEditVariationQaPreview {
  assetRef: string;
  width: number;
  height: number;
  providerFixture?: string;
}

export interface ImageEditVariationCandidate {
  id: string;
  reviewState: 'pending';
  sourceAsset: AssetCatalogEntry;
  asset: AssetCatalogEntry;
  qaPreview: ImageEditVariationQaPreview;
}

export interface ApprovedImageEditVariation {
  id: string;
  reviewState: 'approved';
  reviewedAt: string;
  sourceAsset: AssetCatalogEntry;
  asset: AssetCatalogEntry;
  assetId: string;
  qaPreview: ImageEditVariationQaPreview;
}

export interface ImageEditVariationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  candidate?: ImageEditVariationCandidate;
}

export interface ImageEditVariationCapability {
  canEdit: boolean;
  providerId?: string;
  modelId?: string;
  reason: string;
}

export type ImageEditVariationRunner = (
  existingAssetIds: string[],
  draft: ImageEditVariationDraft,
) => Promise<ImageEditVariationResult>;

const editableKinds = new Set(['image', 'generated', 'tileset', 'spritesheet']);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

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

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
}

function extForFormat(format: ProviderImageGenerationSettings['outputFormat']): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function parseImageSize(size: ProviderImageGenerationSettings['size']): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function sourceImageSize(sourceAsset: AssetCatalogEntry): ProviderImageSize {
  if (!sourceAsset.width || !sourceAsset.height) return '1024x1024';
  const size = `${sourceAsset.width}x${sourceAsset.height}` as ProviderImageSize;
  return openAiImageGenerationOptions.sizes.includes(size) ? size : '1024x1024';
}

export function isEditableImageAsset(asset: AssetCatalogEntry | null | undefined): asset is AssetCatalogEntry {
  return !!asset && editableKinds.has(asset.kind);
}

export function defaultImageEditVariationCapability(
  registry: ModelCapabilityDescriptor[] = defaultModelCapabilityRegistry,
): ImageEditVariationCapability {
  const descriptor = getModelCapabilityDescriptor('local', 'offline-image-edit-mock', registry);
  if (!descriptor || !modelSupportsCapability(descriptor, 'image-edit')) {
    return {
      canEdit: false,
      reason: 'No configured model declares image edit capability.',
    };
  }
  return {
    canEdit: true,
    providerId: descriptor.providerId,
    modelId: descriptor.modelId,
    reason: `${descriptor.label} ready for offline image edit fixtures.`,
  };
}

export function defaultImageEditVariationDraft(
  sourceAsset: AssetCatalogEntry,
  options: DefaultImageEditVariationDraftOptions = {},
): ImageEditVariationDraft {
  const mode = options.mode ?? 'variation';
  return {
    mode,
    sourceAsset: clone(sourceAsset),
    maskAssetId: options.maskAssetId,
    referenceAssetIds: [...(options.referenceAssetIds ?? [])],
    promptInputs: {
      instruction: mode === 'variation'
        ? `Create a reviewed visual variation of ${sourceAsset.name}.`
        : `Apply a reviewed edit to ${sourceAsset.name}.`,
      useCase: 'project-owned asset iteration candidate',
      preserve: 'source composition, RPGCreatorAI readability, and project visual scale',
      maskNotes: options.maskAssetId ? `Use mask asset ${options.maskAssetId}.` : 'no mask; whole-image edit or variation',
    },
    imageSettings: {
      size: sourceImageSize(sourceAsset),
    },
  };
}

export function validateImageEditVariationDraft(draft: ImageEditVariationDraft): string[] {
  const errors: string[] = [];
  if (!isEditableImageAsset(draft.sourceAsset)) {
    errors.push('Image edit requires an image, generated, tileset, or spritesheet source asset.');
  }
  if (!draft.sourceAsset.id.trim()) errors.push('Image edit source asset ID is required.');
  if (!draft.sourceAsset.path.trim()) errors.push('Image edit source asset path is required.');
  if (!['edit', 'variation'].includes(draft.mode)) {
    errors.push('Image edit mode must be edit or variation.');
  }
  for (const key of ['instruction', 'useCase', 'preserve', 'maskNotes'] as const) {
    if (!draft.promptInputs[key].trim()) {
      errors.push(`Image edit ${key} is required.`);
    }
  }
  return errors;
}

export function buildImageEditVariationRequest(
  draft: ImageEditVariationDraft,
  options: ImageEditVariationRequestOptions = {},
): BuiltImageEditVariationRequest {
  const errors = validateImageEditVariationDraft(draft);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  const providerId = options.providerId ?? 'local';
  const modelId = options.modelId ?? 'offline-image-edit-mock';
  const imageSettings = normalizeImageGenerationSettings({
    modelId,
    quality: 'low',
    size: sourceImageSize(draft.sourceAsset),
    outputFormat: 'png',
    ...(draft.imageSettings ?? {}),
    ...(options.imageSettings ?? {}),
  });
  const renderedPrompt = renderImagePromptTemplate('asset-edit-v1', {
    subject: `${draft.sourceAsset.name} (${draft.sourceAsset.id}) at ${draft.sourceAsset.path}`,
    useCase: draft.promptInputs.useCase,
    palette: draft.promptInputs.preserve,
    styleNotes: `${draft.promptInputs.instruction}; ${draft.promptInputs.maskNotes}`,
  }, { imageSettings });
  const { width: expectedWidth, height: expectedHeight } = parseImageSize(imageSettings.size);

  return {
    request: {
      id: options.requestId ?? `image-edit-${Date.now()}`,
      operation: 'image.edit',
      providerId,
      modelId,
      createdAt: options.createdAt ?? new Date().toISOString(),
      prompt: renderedPrompt.prompt,
      input: {
        mode: draft.mode,
        sourceAssetId: draft.sourceAsset.id,
        sourceAssetPath: draft.sourceAsset.path,
        sourceAssetKind: draft.sourceAsset.kind,
        maskAssetId: draft.maskAssetId,
        referenceAssetIds: [...draft.referenceAssetIds],
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
        reviewRequired: true,
      },
    },
    renderedPrompt,
    expectedWidth,
    expectedHeight,
    imageSettings,
  };
}

export async function generateImageEditVariationCandidate(
  adapter: ProviderAdapter,
  existingAssetIds: string[],
  draft: ImageEditVariationDraft,
  options: ImageEditVariationRequestOptions = {},
): Promise<ImageEditVariationCandidate> {
  const built = buildImageEditVariationRequest(draft, options);
  const response = await adapter.execute(built.request);
  if (response.status === 'cancelled') {
    throw new Error('Image edit cancelled.');
  }
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Image edit failed.');
  }
  const assetRef = response.output?.assetRefs?.[0];
  if (!assetRef) {
    throw new Error('Image edit did not return an image asset reference.');
  }

  const sourceBase = slugId(draft.sourceAsset.id || draft.sourceAsset.name, 'source_asset');
  const assetId = uniqueId(existingAssetIds, `${sourceBase}_${draft.mode}`);
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
  const modeLabel = draft.mode === 'variation' ? 'Variation' : 'Edit';
  const asset: AssetCatalogEntry = {
    id: assetId,
    name: `${draft.sourceAsset.name.trim() || draft.sourceAsset.id} ${modeLabel}`,
    kind: 'image',
    path: `assets/generated/edits/${assetId}.${extForFormat(outputFormat)}`,
    source: 'generated',
    tags: ['generated', 'image-edit', draft.mode, 'ai-draft', 'pending-review'],
    provenance: 'Generated through the offline image edit/variation workflow; source asset is preserved.',
    runtimeCompatible: false,
    runtimeNotes: 'Generated image edit metadata is editor-owned until reviewed; native runtime consumes only accepted project data.',
    width: built.expectedWidth,
    height: built.expectedHeight,
    generated: {
      ...generated,
      tool: 'image-edit-variation-workflow',
      operation: built.request.operation,
      sourceAssetId: draft.sourceAsset.id,
      sourceAssetPath: draft.sourceAsset.path,
      maskAssetId: draft.maskAssetId,
      referenceAssetIds: [...draft.referenceAssetIds],
      editMode: draft.mode,
    },
  };

  return {
    id: built.request.id,
    reviewState: 'pending',
    sourceAsset: clone(draft.sourceAsset),
    asset,
    qaPreview: {
      assetRef,
      width: built.expectedWidth,
      height: built.expectedHeight,
      providerFixture,
    },
  };
}

export const generateImageEditVariationDraft: ImageEditVariationRunner = async (
  existingAssetIds,
  draft,
) => {
  try {
    const candidate = await generateImageEditVariationCandidate(
      createMockProviderAdapter(),
      existingAssetIds,
      draft,
    );
    return { success: true, candidate };
  } catch (error) {
    return {
      success: false,
      cancelled: (error as Error).message.toLowerCase().includes('cancel'),
      error: (error as Error).message,
    };
  }
};

export function validateImageEditVariationCandidate(candidate: ImageEditVariationCandidate): string[] {
  const errors: string[] = [];
  const { asset, qaPreview } = candidate;
  if (asset.kind !== 'image') errors.push('Generated image edit asset must use kind "image".');
  if (asset.source !== 'generated') errors.push('Generated image edit asset must use source "generated".');
  if (!asset.generated?.promptTemplateId || !asset.generated?.sourceAssetId || !asset.generated?.sourceAssetPath) {
    errors.push('Generated image edit asset must keep source asset provenance.');
  }
  if (asset.generated?.operation !== 'image.edit') {
    errors.push('Generated image edit asset must record the image.edit operation.');
  }
  if (asset.generated?.editMode !== 'edit' && asset.generated?.editMode !== 'variation') {
    errors.push('Generated image edit asset must record edit or variation mode.');
  }
  if (
    !asset.width ||
    !asset.height ||
    asset.width !== qaPreview.width ||
    asset.height !== qaPreview.height
  ) {
    errors.push('Generated image edit dimensions must match the QA preview.');
  }
  if (!qaPreview.width || !qaPreview.height || qaPreview.width <= 0 || qaPreview.height <= 0) {
    errors.push('Generated image edit QA dimensions must be positive.');
  }
  if (!candidate.sourceAsset.id.trim() || !candidate.sourceAsset.path.trim()) {
    errors.push('Generated image edit source asset metadata is required.');
  }
  return errors;
}

export function approveImageEditVariationCandidate(
  candidate: ImageEditVariationCandidate,
  options: { reviewedAt: string },
): ApprovedImageEditVariation {
  const errors = validateImageEditVariationCandidate(candidate);
  if (errors.length > 0) {
    throw new Error(`Generated image edit candidate is invalid: ${errors.join(' ')}`);
  }
  const tags = uniqueTags([
    ...(candidate.asset.tags ?? []).filter(tag => tag !== 'pending-review'),
    'reviewed',
  ]);
  return {
    id: candidate.id,
    reviewState: 'approved',
    reviewedAt: options.reviewedAt,
    sourceAsset: clone(candidate.sourceAsset),
    assetId: candidate.asset.id,
    qaPreview: clone(candidate.qaPreview),
    asset: {
      ...clone(candidate.asset),
      tags,
      notes: [
        candidate.asset.notes,
        `Reviewed image edit/variation candidate at ${options.reviewedAt}.`,
      ].filter(Boolean).join('\n'),
    },
  };
}
