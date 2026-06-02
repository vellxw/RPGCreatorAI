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

export type CharacterConceptOwnerKind = 'actor' | 'event';

export interface CharacterConceptOwner {
  kind: CharacterConceptOwnerKind;
  id: string;
  name: string;
}

export interface CharacterConceptGenerationPromptInputs {
  subject: string;
  useCase: string;
  palette: string;
  styleNotes: string;
}

export interface CharacterConceptGenerationDraft {
  owner: CharacterConceptOwner;
  description: string;
  promptInputs: CharacterConceptGenerationPromptInputs;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface DefaultCharacterConceptGenerationDraftOptions {
  ownerKind: CharacterConceptOwnerKind;
  ownerId: string;
  ownerName: string;
  description: string;
}

export interface CharacterConceptGenerationRequestOptions {
  requestId?: string;
  createdAt?: string;
  providerId?: string;
  modelId?: string;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface BuiltCharacterConceptGenerationRequest {
  request: ProviderAdapterRequest;
  renderedPrompt: RenderedImagePrompt;
  expectedWidth: number;
  expectedHeight: number;
  imageSettings: ProviderImageGenerationSettings;
}

export interface CharacterConceptGenerationQaPreview {
  assetRef: string;
  width: number;
  height: number;
  providerFixture?: string;
}

export interface CharacterConceptGenerationCandidate {
  id: string;
  reviewState: 'pending';
  owner: CharacterConceptOwner;
  asset: AssetCatalogEntry;
  qaPreview: CharacterConceptGenerationQaPreview;
}

export interface ApprovedCharacterConceptGeneration {
  id: string;
  reviewState: 'approved';
  reviewedAt: string;
  owner: CharacterConceptOwner;
  asset: AssetCatalogEntry;
  conceptAssetId: string;
  qaPreview: CharacterConceptGenerationQaPreview;
}

export interface CharacterConceptGenerationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  candidate?: CharacterConceptGenerationCandidate;
}

export type CharacterConceptGenerationRunner = (
  existingAssetIds: string[],
  draft: CharacterConceptGenerationDraft,
) => Promise<CharacterConceptGenerationResult>;

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
  if (!match) return { width: 1024, height: 1536 };
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function defaultCharacterConceptGenerationDraft(
  options: DefaultCharacterConceptGenerationDraftOptions,
): CharacterConceptGenerationDraft {
  const label = options.ownerKind === 'actor' ? 'actor' : 'event NPC';
  const name = options.ownerName.trim() || options.ownerId;
  return {
    owner: {
      kind: options.ownerKind,
      id: options.ownerId,
      name,
    },
    description: options.description,
    promptInputs: {
      subject: `${name} full-body character concept`,
      useCase: `reviewable character concept for ${label} "${name}" that can seed portraits and sprites`,
      palette: 'readable costume colors, clear silhouette accents, restrained RPG palette',
      styleNotes: [
        options.description.trim(),
        'original RPGCreatorAI character concept direction',
      ].filter(Boolean).join('; '),
    },
  };
}

export function validateCharacterConceptGenerationDraft(draft: CharacterConceptGenerationDraft): string[] {
  const errors: string[] = [];
  if (!draft.owner.id.trim()) errors.push('Character concept owner ID is required.');
  if (!draft.owner.name.trim()) errors.push('Character concept owner name is required.');
  if (!['actor', 'event'].includes(draft.owner.kind)) {
    errors.push('Character concept owner kind must be actor or event.');
  }
  for (const key of ['subject', 'useCase', 'palette', 'styleNotes'] as const) {
    if (!draft.promptInputs[key].trim()) {
      errors.push(`Character concept generation ${key} is required.`);
    }
  }
  return errors;
}

export function buildCharacterConceptGenerationRequest(
  draft: CharacterConceptGenerationDraft,
  options: CharacterConceptGenerationRequestOptions = {},
): BuiltCharacterConceptGenerationRequest {
  const errors = validateCharacterConceptGenerationDraft(draft);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  const providerId = options.providerId ?? 'local';
  const modelId = options.modelId ?? 'offline-image-mock';
  const imageSettings = normalizeImageGenerationSettings({
    modelId,
    quality: 'low',
    size: '1024x1536',
    outputFormat: 'png',
    ...(draft.imageSettings ?? {}),
    ...(options.imageSettings ?? {}),
  });
  const renderedPrompt = renderImagePromptTemplate('character-concept-v1', { ...draft.promptInputs }, {
    imageSettings,
  });
  const { width: expectedWidth, height: expectedHeight } = parseImageSize(imageSettings.size);

  return {
    request: {
      id: options.requestId ?? `concept-gen-${Date.now()}`,
      operation: 'image.generate',
      providerId,
      modelId,
      createdAt: options.createdAt ?? new Date().toISOString(),
      prompt: renderedPrompt.prompt,
      input: {
        ownerKind: draft.owner.kind,
        ownerId: draft.owner.id,
        ownerName: draft.owner.name,
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

export async function generateCharacterConceptCandidate(
  adapter: ProviderAdapter,
  existingAssetIds: string[],
  draft: CharacterConceptGenerationDraft,
  options: CharacterConceptGenerationRequestOptions = {},
): Promise<CharacterConceptGenerationCandidate> {
  const built = buildCharacterConceptGenerationRequest(draft, options);
  const response = await adapter.execute(built.request);
  if (response.status === 'cancelled') {
    throw new Error('Character concept generation was cancelled.');
  }
  if (response.status !== 'succeeded') {
    throw new Error(response.failure?.message ?? response.error ?? 'Character concept generation failed.');
  }
  const assetRef = response.output?.assetRefs?.[0];
  if (!assetRef) {
    throw new Error('Character concept generation did not return an image asset reference.');
  }

  const assetId = uniqueId(existingAssetIds, slugId(`${draft.owner.name} concept`, 'generated_character_concept'));
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
    name: `${draft.owner.name.trim()} Concept`,
    kind: 'image',
    path: `assets/generated/concepts/${assetId}.${extForFormat(outputFormat)}`,
    source: 'generated',
    tags: ['generated', 'character-concept', draft.owner.kind, 'ai-draft', 'pending-review'],
    provenance: 'Generated through the offline character concept workflow; requires review before actor/event assignment.',
    runtimeCompatible: false,
    runtimeNotes: 'Character concept metadata is editor-owned; native runtime consumes only accepted project data.',
    width: built.expectedWidth,
    height: built.expectedHeight,
    generated: {
      ...generated,
      tool: 'ai-character-concept-generation-workflow',
      operation: built.request.operation,
      ownerKind: draft.owner.kind,
      ownerId: draft.owner.id,
      ownerName: draft.owner.name,
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

export const generateCharacterConceptDraft: CharacterConceptGenerationRunner = async (
  existingAssetIds,
  draft,
) => {
  try {
    return {
      success: true,
      candidate: await generateCharacterConceptCandidate(
        createMockProviderAdapter(),
        existingAssetIds,
        draft,
      ),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export function validateCharacterConceptGenerationCandidate(candidate: CharacterConceptGenerationCandidate): string[] {
  const errors: string[] = [];
  const { asset } = candidate;
  if (candidate.reviewState !== 'pending') errors.push('Character concept candidate must be pending review.');
  if (!candidate.owner.id.trim()) errors.push('Character concept owner ID is required.');
  if (asset.kind !== 'image' && asset.kind !== 'generated') {
    errors.push('Generated character concept asset must be an image asset.');
  }
  if (asset.source !== 'generated') errors.push('Generated character concept asset must have generated source.');
  if (asset.generated?.promptTemplateId !== 'character-concept-v1') {
    errors.push('Generated character concept asset must keep character concept prompt provenance.');
  }
  if (asset.generated?.operation !== 'image.generate') {
    errors.push('Generated character concept asset must record the image.generate operation.');
  }
  if (asset.generated?.ownerId !== candidate.owner.id || asset.generated?.ownerKind !== candidate.owner.kind) {
    errors.push('Generated character concept asset must record owner provenance.');
  }
  if (asset.width !== candidate.qaPreview.width || asset.height !== candidate.qaPreview.height) {
    errors.push('Generated character concept dimensions must match the QA preview.');
  }
  return errors;
}

export function approveCharacterConceptGenerationCandidate(
  candidate: CharacterConceptGenerationCandidate,
  options: { reviewedAt: string },
): ApprovedCharacterConceptGeneration {
  const errors = validateCharacterConceptGenerationCandidate(candidate);
  if (errors.length > 0) {
    throw new Error(`Generated character concept candidate is invalid: ${errors.join(' ')}`);
  }
  const asset = clone(candidate.asset);
  return {
    id: candidate.id,
    reviewState: 'approved',
    reviewedAt: options.reviewedAt,
    owner: clone(candidate.owner),
    conceptAssetId: asset.id,
    qaPreview: clone(candidate.qaPreview),
    asset: {
      ...asset,
      tags: uniqueTags([...(asset.tags ?? []).filter(tag => tag !== 'pending-review'), 'reviewed']),
      notes: [
        asset.notes,
        `Reviewed character concept candidate at ${options.reviewedAt}.`,
      ].filter(Boolean).join('\n'),
    },
  };
}
