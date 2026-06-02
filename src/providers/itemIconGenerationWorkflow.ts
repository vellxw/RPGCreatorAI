import type {
  AssetCatalogEntry,
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

export type ItemIconOwnerKind = 'item' | 'weapon' | 'armor';

export interface ItemIconOwner {
  kind: ItemIconOwnerKind;
  id: string;
  name: string;
}

export interface ItemIconGenerationPromptInputs {
  subject: string;
  useCase: string;
  palette: string;
  styleNotes: string;
}

export interface ItemIconGenerationDraft {
  owner: ItemIconOwner;
  description: string;
  category?: string;
  promptInputs: ItemIconGenerationPromptInputs;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface DefaultItemIconGenerationDraftOptions {
  ownerKind: ItemIconOwnerKind;
  ownerId: string;
  ownerName: string;
  description: string;
  category?: string;
}

export interface ItemIconGenerationRequestOptions {
  requestId?: string;
  createdAt?: string;
  providerId?: string;
  modelId?: string;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface BuiltItemIconGenerationRequest {
  request: ProviderAdapterRequest;
  renderedPrompt: RenderedImagePrompt;
  expectedWidth: number;
  expectedHeight: number;
  imageSettings: ProviderImageGenerationSettings;
}

export interface ItemIconGenerationQaPreview {
  assetRef: string;
  width: number;
  height: number;
  providerFixture?: string;
}

export interface ItemIconGenerationCandidate {
  id: string;
  reviewState: 'pending';
  owner: ItemIconOwner;
  asset: AssetCatalogEntry;
  qaPreview: ItemIconGenerationQaPreview;
}

export interface ApprovedItemIconGeneration {
  id: string;
  reviewState: 'approved';
  reviewedAt: string;
  owner: ItemIconOwner;
  asset: AssetCatalogEntry;
  iconAssetId: string;
  qaPreview: ItemIconGenerationQaPreview;
}

export interface ItemIconGenerationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  candidate?: ItemIconGenerationCandidate;
}

export type ItemIconGenerationRunner = (
  existingAssetIds: string[],
  draft: ItemIconGenerationDraft,
) => Promise<ItemIconGenerationResult>;

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

function parseImageSize(size: ProviderImageGenerationSettings['size']): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function defaultItemIconGenerationDraft(
  options: DefaultItemIconGenerationDraftOptions,
): ItemIconGenerationDraft {
  const label = options.ownerKind === 'item'
    ? 'item'
    : options.ownerKind === 'weapon'
      ? 'weapon'
      : 'armor';
  const name = options.ownerName.trim() || options.ownerId;
  return {
    owner: {
      kind: options.ownerKind,
      id: options.ownerId,
      name,
    },
    description: options.description,
    category: options.category,
    promptInputs: {
      subject: `${name} ${label} inventory icon`,
      useCase: `database icon candidate for ${label} "${name}"`,
      palette: 'readable RPG inventory palette with clear object contrast',
      styleNotes: [
        options.description.trim(),
        options.category ? `category ${options.category}` : '',
        'original RPGCreatorAI icon direction',
      ].filter(Boolean).join('; '),
    },
  };
}

export function validateItemIconGenerationDraft(draft: ItemIconGenerationDraft): string[] {
  const errors: string[] = [];
  if (!draft.owner.id.trim()) errors.push('Item icon owner ID is required.');
  if (!draft.owner.name.trim()) errors.push('Item icon owner name is required.');
  if (!['item', 'weapon', 'armor'].includes(draft.owner.kind)) {
    errors.push('Item icon owner kind must be item, weapon, or armor.');
  }
  for (const key of ['subject', 'useCase', 'palette', 'styleNotes'] as const) {
    if (!draft.promptInputs[key].trim()) {
      errors.push(`Item icon generation ${key} is required.`);
    }
  }
  return errors;
}

export function buildItemIconGenerationRequest(
  draft: ItemIconGenerationDraft,
  options: ItemIconGenerationRequestOptions = {},
): BuiltItemIconGenerationRequest {
  const errors = validateItemIconGenerationDraft(draft);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  const providerId = options.providerId ?? 'local';
  const modelId = options.modelId ?? 'offline-image-mock';
  const imageSettings = normalizeImageGenerationSettings({
    modelId,
    quality: 'low',
    size: '1024x1024',
    outputFormat: 'png',
    ...(draft.imageSettings ?? {}),
    ...(options.imageSettings ?? {}),
  });
  const renderedPrompt = renderImagePromptTemplate('icon-item-v1', { ...draft.promptInputs }, {
    imageSettings,
  });
  const { width: expectedWidth, height: expectedHeight } = parseImageSize(imageSettings.size);

  return {
    request: {
      id: options.requestId ?? `icon-gen-${Date.now()}`,
      operation: 'image.generate',
      providerId,
      modelId,
      createdAt: options.createdAt ?? new Date().toISOString(),
      prompt: renderedPrompt.prompt,
      input: {
        ownerKind: draft.owner.kind,
        ownerId: draft.owner.id,
        ownerName: draft.owner.name,
        category: draft.category,
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

export async function generateItemIconCandidate(
  adapter: ProviderAdapter,
  existingAssetIds: string[],
  draft: ItemIconGenerationDraft,
  options: ItemIconGenerationRequestOptions = {},
): Promise<ItemIconGenerationCandidate> {
  const built = buildItemIconGenerationRequest(draft, options);
  const response = await adapter.execute(built.request);
  if (response.status === 'cancelled') {
    throw new Error('Item icon generation was cancelled.');
  }
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Item icon generation failed.');
  }
  const assetRef = response.output?.assetRefs?.[0];
  if (!assetRef) {
    throw new Error('Item icon generation did not return an image asset reference.');
  }

  const assetId = uniqueId(existingAssetIds, slugId(`${draft.owner.name} icon`, 'generated_icon'));
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
  const asset: AssetCatalogEntry = {
    id: assetId,
    name: `${draft.owner.name.trim()} Icon`,
    kind: 'image',
    path: `assets/generated/icons/${assetId}.${extForFormat(outputFormat)}`,
    source: 'generated',
    tags: ['generated', 'item-icon', draft.owner.kind, 'ai-draft', 'pending-review'],
    provenance: 'Generated through the offline item icon workflow; requires review before database assignment.',
    runtimeCompatible: false,
    runtimeNotes: 'Generated icon metadata is editor-owned until reviewed; native runtime consumes only accepted project data.',
    width: built.expectedWidth,
    height: built.expectedHeight,
    generated: {
      ...generated,
      tool: 'ai-item-icon-generation-workflow',
    },
  };

  return {
    id: built.request.id,
    reviewState: 'pending',
    owner: clone(draft.owner),
    asset,
    qaPreview: {
      assetRef,
      width: built.expectedWidth,
      height: built.expectedHeight,
      providerFixture,
    },
  };
}

export const generateItemIconDraft: ItemIconGenerationRunner = async (
  existingAssetIds,
  draft,
) => {
  try {
    const candidate = await generateItemIconCandidate(
      createMockProviderAdapter(),
      existingAssetIds,
      draft,
    );
    return { success: true, candidate };
  } catch (error) {
    return {
      success: false,
      cancelled: (error as Error).message.toLowerCase().includes('cancelled'),
      error: (error as Error).message,
    };
  }
};

export function validateItemIconGenerationCandidate(candidate: ItemIconGenerationCandidate): string[] {
  const errors: string[] = [];
  const { asset, qaPreview } = candidate;
  if (asset.kind !== 'image') errors.push('Generated item icon asset must use kind "image".');
  if (asset.source !== 'generated') errors.push('Generated item icon asset must use source "generated".');
  if (!asset.generated?.promptTemplateId) errors.push('Generated item icon asset must keep prompt provenance.');
  if (
    !asset.width ||
    !asset.height ||
    asset.width !== qaPreview.width ||
    asset.height !== qaPreview.height
  ) {
    errors.push('Generated item icon dimensions must match the QA preview.');
  }
  if (!qaPreview.width || !qaPreview.height || qaPreview.width <= 0 || qaPreview.height <= 0) {
    errors.push('Generated item icon QA dimensions must be positive.');
  }
  if (!candidate.owner.id.trim() || !candidate.owner.name.trim()) {
    errors.push('Generated item icon owner metadata is required.');
  }
  return errors;
}

export function approveItemIconGenerationCandidate(
  candidate: ItemIconGenerationCandidate,
  options: { reviewedAt: string },
): ApprovedItemIconGeneration {
  const errors = validateItemIconGenerationCandidate(candidate);
  if (errors.length > 0) {
    throw new Error(`Generated item icon candidate is invalid: ${errors.join(' ')}`);
  }
  const tags = uniqueTags([
    ...(candidate.asset.tags ?? []).filter(tag => tag !== 'pending-review'),
    'reviewed',
  ]);
  return {
    id: candidate.id,
    reviewState: 'approved',
    reviewedAt: options.reviewedAt,
    owner: clone(candidate.owner),
    iconAssetId: candidate.asset.id,
    qaPreview: clone(candidate.qaPreview),
    asset: {
      ...clone(candidate.asset),
      tags,
      notes: [
        candidate.asset.notes,
        `Reviewed for database icon use at ${options.reviewedAt}.`,
      ].filter(Boolean).join('\n'),
    },
  };
}
