import type {
  AssetCatalogEntry,
  ProviderImageGenerationSettings,
  TilePassability,
  TilesetData,
  TilesetTileMetadata,
} from '../types/project';
import { normalizeImageGenerationSettings } from './providerImageGenerationSettings';
import type { ProviderAdapter, ProviderAdapterRequest } from './providerAdapter';
import { createMockProviderAdapter } from './mockProviderAdapter';
import {
  buildImagePromptProvenance,
  renderImagePromptTemplate,
  type RenderedImagePrompt,
} from './imagePromptTemplates';

export interface TilesetGenerationPromptInputs {
  subject: string;
  useCase: string;
  palette: string;
  styleNotes: string;
}

export interface TilesetGenerationDraft {
  tilesetId: string;
  name: string;
  tileSize: number;
  columns: number;
  tileCount: number;
  defaultPassability: TilePassability;
  foregroundStartTile: number;
  regionMarkerCount: number;
  promptInputs: TilesetGenerationPromptInputs;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface TilesetGenerationRequestOptions {
  requestId?: string;
  createdAt?: string;
  providerId?: string;
  modelId?: string;
  imageSettings?: Partial<ProviderImageGenerationSettings>;
}

export interface BuiltTilesetGenerationRequest {
  request: ProviderAdapterRequest;
  renderedPrompt: RenderedImagePrompt;
  expectedWidth: number;
  expectedHeight: number;
  rows: number;
  imageSettings: ProviderImageGenerationSettings;
}

export interface TilesetGenerationQaPreview {
  assetRef: string;
  width: number;
  height: number;
  tileSize: number;
  columns: number;
  rows: number;
  tileCount: number;
  providerFixture?: string;
}

export interface TilesetGenerationCandidate {
  id: string;
  reviewState: 'pending';
  asset: AssetCatalogEntry;
  tileset: TilesetData;
  qaPreview: TilesetGenerationQaPreview;
}

export interface ApprovedTilesetGeneration {
  id: string;
  reviewState: 'approved';
  reviewedAt: string;
  asset: AssetCatalogEntry;
  tileset: TilesetData;
  qaPreview: TilesetGenerationQaPreview;
}

export interface TilesetGenerationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  candidate?: TilesetGenerationCandidate;
}

export type TilesetGenerationRunner = (
  existingAssetIds: string[],
  existingTilesetIds: string[],
  draft: TilesetGenerationDraft,
) => Promise<TilesetGenerationResult>;

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

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function sheetGeometry(draft: Pick<TilesetGenerationDraft, 'tileSize' | 'columns' | 'tileCount'>) {
  const rows = Math.ceil(draft.tileCount / draft.columns);
  return {
    rows,
    expectedWidth: draft.columns * draft.tileSize,
    expectedHeight: rows * draft.tileSize,
  };
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

export function defaultTilesetGenerationDraft(index: number): TilesetGenerationDraft {
  return {
    tilesetId: `generated_tileset_${index}`,
    name: `Generated Tileset ${index}`,
    tileSize: 32,
    columns: 8,
    tileCount: 64,
    defaultPassability: 'passable',
    foregroundStartTile: 0,
    regionMarkerCount: 0,
    promptInputs: {
      subject: 'original village ground, wall, path, boundary, and decor tiles',
      useCase: 'editable RPG map tileset draft for local project review',
      palette: 'balanced greens, warm stone, readable shadow accents',
      styleNotes: 'pixel-clean original RPGCreatorAI tile direction',
    },
  };
}

export function validateTilesetGenerationDraft(draft: TilesetGenerationDraft): string[] {
  const errors: string[] = [];
  if (!draft.tilesetId.trim()) errors.push('Tileset generation ID is required.');
  if (!draft.name.trim()) errors.push('Tileset generation name is required.');
  if (!positiveInteger(draft.tileSize)) errors.push('Tile size must be a positive integer.');
  if (!positiveInteger(draft.columns)) errors.push('Column count must be a positive integer.');
  if (!positiveInteger(draft.tileCount)) errors.push('Tile count must be a positive integer.');
  if (!nonNegativeInteger(draft.foregroundStartTile)) {
    errors.push('Foreground start tile must be zero or a positive integer.');
  } else if (draft.foregroundStartTile > draft.tileCount) {
    errors.push('Foreground start tile cannot be greater than tile count.');
  }
  if (!nonNegativeInteger(draft.regionMarkerCount)) {
    errors.push('Region marker count must be zero or a positive integer.');
  }

  for (const key of ['subject', 'useCase', 'palette', 'styleNotes'] as const) {
    if (!draft.promptInputs[key].trim()) {
      errors.push(`Tileset generation ${key} is required.`);
    }
  }
  return errors;
}

export function buildTilesetGenerationRequest(
  draft: TilesetGenerationDraft,
  options: TilesetGenerationRequestOptions = {},
): BuiltTilesetGenerationRequest {
  const errors = validateTilesetGenerationDraft(draft);
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
  const renderedPrompt = renderImagePromptTemplate('tileset-rpg-map-v1', { ...draft.promptInputs }, {
    imageSettings,
  });
  const { rows, expectedWidth, expectedHeight } = sheetGeometry(draft);

  return {
    request: {
      id: options.requestId ?? `tileset-gen-${Date.now()}`,
      operation: 'image.generate',
      providerId,
      modelId,
      createdAt: options.createdAt ?? new Date().toISOString(),
      prompt: renderedPrompt.prompt,
      input: {
        tileSize: draft.tileSize,
        columns: draft.columns,
        rows,
        tileCount: draft.tileCount,
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
    rows,
    imageSettings,
  };
}

function buildGeneratedTileset(id: string, assetId: string, draft: TilesetGenerationDraft): TilesetData {
  const visualTiles = Array.from({ length: draft.tileCount }, (_, tileId): TilesetTileMetadata => {
    const foreground = draft.foregroundStartTile > 0 && tileId >= draft.foregroundStartTile;
    return {
      id: tileId,
      name: `Tile ${tileId}`,
      asset: assetId,
      group: foreground ? 'B' : 'A',
      passability: draft.defaultPassability,
      terrainTag: foreground ? 'foreground' : 'ground',
      priority: foreground ? 1 : 0,
    };
  });
  const regionTiles = Array.from({ length: draft.regionMarkerCount }, (_, index): TilesetTileMetadata => ({
    id: 1000 + index,
    name: `Region ${index + 1}`,
    asset: assetId,
    group: 'Region',
    passability: 'passable',
    terrainTag: `region_${index + 1}`,
    priority: 0,
  }));
  const collisionTile: TilesetTileMetadata = {
    id: 2000,
    name: 'Collision Block',
    asset: assetId,
    group: 'Collision',
    passability: 'blocked',
    terrainTag: 'collision',
    priority: 0,
  };
  return {
    id,
    name: draft.name.trim(),
    tileSize: draft.tileSize,
    tiles: [...visualTiles, ...regionTiles, collisionTile],
  };
}

export async function generateTilesetCandidate(
  adapter: ProviderAdapter,
  existingAssetIds: string[],
  existingTilesetIds: string[],
  draft: TilesetGenerationDraft,
  options: TilesetGenerationRequestOptions = {},
): Promise<TilesetGenerationCandidate> {
  const built = buildTilesetGenerationRequest(draft, options);
  const response = await adapter.execute(built.request);
  if (response.status === 'cancelled') {
    throw new Error('Tileset generation was cancelled.');
  }
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Tileset generation failed.');
  }
  const assetRef = response.output?.assetRefs?.[0];
  if (!assetRef) {
    throw new Error('Tileset generation did not return an image asset reference.');
  }

  const assetId = uniqueId(existingAssetIds, slugId(draft.name, 'generated_tileset'));
  const tilesetId = uniqueId(existingTilesetIds, slugId(draft.tilesetId, assetId));
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
    name: draft.name.trim(),
    kind: 'tileset',
    path: `assets/generated/tilesets/${assetId}.${extForFormat(outputFormat)}`,
    source: 'generated',
    tags: ['generated', 'tileset', 'ai-draft', 'pending-review'],
    provenance: 'Generated through the offline tileset workflow; requires review before project use.',
    runtimeCompatible: false,
    runtimeNotes: 'Generated draft metadata is editor-owned until reviewed with project tileset validation.',
    width: built.expectedWidth,
    height: built.expectedHeight,
    generated: {
      ...generated,
      tool: 'ai-tileset-generation-workflow',
      operation: built.request.operation,
    },
  };
  const tileset = buildGeneratedTileset(tilesetId, assetId, draft);

  return {
    id: built.request.id,
    reviewState: 'pending',
    asset,
    tileset,
    qaPreview: {
      assetRef,
      width: built.expectedWidth,
      height: built.expectedHeight,
      tileSize: draft.tileSize,
      columns: draft.columns,
      rows: built.rows,
      tileCount: draft.tileCount,
      providerFixture,
    },
  };
}

export const generateTilesetDraft: TilesetGenerationRunner = async (
  existingAssetIds,
  existingTilesetIds,
  draft,
) => {
  try {
    const candidate = await generateTilesetCandidate(
      createMockProviderAdapter(),
      existingAssetIds,
      existingTilesetIds,
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

export function validateTilesetGenerationCandidate(candidate: TilesetGenerationCandidate): string[] {
  const errors: string[] = [];
  const { asset, tileset, qaPreview } = candidate;
  if (asset.kind !== 'tileset') errors.push('Generated tileset asset must use kind "tileset".');
  if (asset.source !== 'generated') errors.push('Generated tileset asset must use source "generated".');
  if (!asset.generated?.promptTemplateId) errors.push('Generated tileset asset must keep prompt provenance.');
  if (asset.width !== qaPreview.columns * qaPreview.tileSize) {
    errors.push('Generated tileset width must equal columns * tileSize.');
  }
  if (asset.height !== qaPreview.rows * qaPreview.tileSize) {
    errors.push('Generated tileset height must equal rows * tileSize.');
  }
  if (!asset.width || asset.width % qaPreview.tileSize !== 0) {
    errors.push('Generated tileset width must align to tile size.');
  }
  if (!asset.height || asset.height % qaPreview.tileSize !== 0) {
    errors.push('Generated tileset height must align to tile size.');
  }
  if (tileset.tileSize !== qaPreview.tileSize) {
    errors.push('Generated tileset database tileSize must match preview tileSize.');
  }
  if (tileset.tiles.length === 0) {
    errors.push('Generated tileset database must include tile metadata.');
  }
  for (const tile of tileset.tiles) {
    if (tile.asset !== asset.id) {
      errors.push(`Generated tile "${tile.id}" must reference generated asset "${asset.id}".`);
      break;
    }
  }
  return errors;
}

export function approveTilesetGenerationCandidate(
  candidate: TilesetGenerationCandidate,
  options: { reviewedAt: string },
): ApprovedTilesetGeneration {
  const errors = validateTilesetGenerationCandidate(candidate);
  if (errors.length > 0) {
    throw new Error(`Generated tileset candidate is invalid: ${errors.join(' ')}`);
  }
  const tags = uniqueTags([
    ...(candidate.asset.tags ?? []).filter(tag => tag !== 'pending-review'),
    'reviewed',
  ]);
  return {
    id: candidate.id,
    reviewState: 'approved',
    reviewedAt: options.reviewedAt,
    qaPreview: clone(candidate.qaPreview),
    asset: {
      ...clone(candidate.asset),
      tags,
      notes: [
        candidate.asset.notes,
        `Reviewed for editable tileset use at ${options.reviewedAt}.`,
      ].filter(Boolean).join('\n'),
    },
    tileset: clone(candidate.tileset),
  };
}
